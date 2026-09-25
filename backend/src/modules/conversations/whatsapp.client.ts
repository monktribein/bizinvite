import { randomUUID } from "crypto";
import { isWhatsAppDryRun, whatsappConfig } from "../../config/whatsapp";
import { Errors } from "../../common/errors/app-error";
import { logger } from "../../common/utils/logger";

/**
 * Minimal client for the official WhatsApp Business Cloud API (Graph API).
 * No unofficial automation is used anywhere in BizInvite.
 */

/** Errors after which retrying the same message cannot succeed. */
const PERMANENT_ERROR_CODES = new Set([
  100, // invalid parameter
  131008, // required parameter missing
  131009, // parameter value invalid
  131021, // recipient cannot be sender
  131026, // message undeliverable (number not on WhatsApp / cannot receive)
  131047, // re-engagement required (outside 24h window for free-form)
  131049, // Meta withheld the message to protect this user's engagement (per-user marketing limit)
  131050, // user stopped receiving marketing messages from this business
  131051, // unsupported message type
  132000, // template param count mismatch
  132001, // template does not exist
  132005, // template hydrated text too long
  132007, // template format policy violated
  132012, // template parameter format mismatch
  132015, // template paused
  132016, // template disabled
]);

/** Codes meaning the phone number itself cannot receive WhatsApp messages. */
export const INVALID_RECIPIENT_CODES = new Set([131026, 131021]);

/** Codes meaning the recipient has told WhatsApp to stop messages from this business: treated as an opt-out. */
export const OPT_OUT_ERROR_CODES = new Set([131050]);

/**
 * Errors about the sending account, not the recipient: every further send fails the same way
 * until someone fixes the configuration, so a campaign is paused instead of failing each guest.
 */
export const ACCOUNT_ERROR_CODES = new Set([
  3, // app lacks the capability
  10, // permission denied
  190, // access token invalid or expired
  200, // permission error
  368, // temporarily blocked for policy violations
  131031, // business account locked
  131042, // business eligibility / payment issue
  133010, // phone number not registered on the Cloud API
]);

export class WhatsAppSendError extends Error {
  constructor(
    message: string,
    public readonly code: number | undefined,
    public readonly permanent: boolean,
    /** The sending account is misconfigured or blocked (see ACCOUNT_ERROR_CODES). */
    public readonly accountLevel = false
  ) {
    super(message);
    this.name = "WhatsAppSendError";
  }
}

export interface TemplateComponent {
  type: "header" | "body" | "button";
  sub_type?: "quick_reply" | "url";
  index?: string;
  parameters: Array<Record<string, unknown>>;
}

interface GraphError {
  error?: { message?: string; code?: number; error_subcode?: number; error_data?: { details?: string } };
}

async function graphRequest<T>(path: string, init: RequestInit = {}, timeoutMs = 15000): Promise<T> {
  if (!whatsappConfig.accessToken) throw Errors.whatsapp("WhatsApp Cloud API is not configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${whatsappConfig.graphBaseUrl}/${whatsappConfig.apiVersion}/${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${whatsappConfig.accessToken}`,
        // fetch sets the multipart boundary itself for FormData bodies
        ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(init.headers ?? {}),
      },
    });
    const body = (await response.json().catch(() => ({}))) as T & GraphError;
    if (!response.ok) {
      const code = body.error?.code;
      const message = body.error?.error_data?.details ?? body.error?.message ?? `Graph API HTTP ${response.status}`;
      const accountLevel = code !== undefined ? ACCOUNT_ERROR_CODES.has(code) : response.status === 401 || response.status === 403;
      const permanent =
        !accountLevel && (code !== undefined ? PERMANENT_ERROR_CODES.has(code) : response.status >= 400 && response.status < 500 && response.status !== 429);
      throw new WhatsAppSendError(code !== undefined ? `${message} (WhatsApp error ${code})` : message, code, permanent, accountLevel);
    }
    return body;
  } catch (err) {
    if (err instanceof WhatsAppSendError) throw err;
    throw new WhatsAppSendError(`WhatsApp request failed: ${(err as Error).message}`, undefined, false);
  } finally {
    clearTimeout(timer);
  }
}

export async function sendTemplateMessage(input: {
  phoneNumberId?: string;
  to: string;
  templateName: string;
  languageCode: string;
  components: TemplateComponent[];
}): Promise<{ waMessageId: string; dryRun: boolean }> {
  if (isWhatsAppDryRun()) {
    const waMessageId = `dryrun.${randomUUID()}`;
    logger.info({ template: input.templateName, waMessageId }, "WhatsApp dry-run: message not sent");
    return { waMessageId, dryRun: true };
  }
  const phoneNumberId = input.phoneNumberId ?? whatsappConfig.phoneNumberId;
  if (!phoneNumberId) throw new WhatsAppSendError("No WhatsApp sender phone number id is configured", undefined, false, true);

  const body = await graphRequest<{ messages?: Array<{ id: string }> }>(`${phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: "template",
      template: { name: input.templateName, language: { code: input.languageCode }, components: input.components },
    }),
  });
  const waMessageId = body.messages?.[0]?.id;
  if (!waMessageId) throw new WhatsAppSendError("WhatsApp did not return a message id", undefined, false);
  return { waMessageId, dryRun: false };
}

/** Uploads a file to WhatsApp and returns its media id (valid for 30 days). */
export async function uploadMedia(input: { phoneNumberId?: string; buffer: Buffer; mimeType: string; filename: string }): Promise<string> {
  if (isWhatsAppDryRun()) {
    const mediaId = `dryrun-media.${randomUUID()}`;
    logger.info({ mediaId, mimeType: input.mimeType, bytes: input.buffer.length }, "WhatsApp dry-run: media not uploaded");
    return mediaId;
  }
  const phoneNumberId = input.phoneNumberId ?? whatsappConfig.phoneNumberId;
  if (!phoneNumberId) throw new WhatsAppSendError("No WhatsApp sender phone number id is configured", undefined, false, true);

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", input.mimeType);
  form.append("file", new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }), input.filename);
  const body = await graphRequest<{ id?: string }>(`${phoneNumberId}/media`, { method: "POST", body: form }, 60000);
  if (!body.id) throw new WhatsAppSendError("WhatsApp did not return a media id", undefined, false);
  return body.id;
}

export interface RemoteTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: Array<{
    type: string;
    format?: string;
    text?: string;
    buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
  }>;
}

export interface RemotePhoneNumber {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
}

/** Phone numbers registered to a WhatsApp Business Account. */
export async function fetchPhoneNumbers(wabaId: string): Promise<RemotePhoneNumber[]> {
  const body = await graphRequest<{ data?: RemotePhoneNumber[] }>(
    `${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&limit=100`
  );
  return body.data ?? [];
}

export interface RemotePhoneNumberDetails extends RemotePhoneNumber {
  /** CLOUD_API when the number can send through the Cloud API. */
  platform_type?: string;
  code_verification_status?: string;
}

/** One sender number's registration details; also proves the access token can use it. */
export async function fetchPhoneNumber(phoneNumberId: string): Promise<RemotePhoneNumberDetails> {
  return graphRequest<RemotePhoneNumberDetails>(
    `${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name,quality_rating,platform_type,code_verification_status`,
    {},
    8000
  );
}

/**
 * Apps subscribed to a WABA's webhooks. Meta only delivers message and status webhooks for a
 * WABA whose subscribed apps include this app, even when the app's webhook URL is configured.
 */
export async function fetchSubscribedApps(wabaId: string): Promise<Array<{ id?: string; name?: string }>> {
  const body = await graphRequest<{ data?: Array<{ whatsapp_business_api_data?: { id?: string; name?: string } }> }>(
    `${encodeURIComponent(wabaId)}/subscribed_apps`,
    {},
    8000
  );
  return (body.data ?? []).map((d) => ({ id: d.whatsapp_business_api_data?.id, name: d.whatsapp_business_api_data?.name }));
}

/** Subscribes this app (the one the access token belongs to) to the WABA's webhooks. */
export async function subscribeAppToWaba(wabaId: string): Promise<boolean> {
  const body = await graphRequest<{ success?: boolean }>(`${encodeURIComponent(wabaId)}/subscribed_apps`, { method: "POST" });
  return body.success === true;
}

export async function fetchMessageTemplates(wabaId: string): Promise<RemoteTemplate[]> {
  const all: RemoteTemplate[] = [];
  let path: string | null = `${wabaId}/message_templates?limit=100&fields=id,name,language,status,category,components`;
  for (let page = 0; path && page < 20; page++) {
    const body: { data?: RemoteTemplate[]; paging?: { next?: string; cursors?: { after?: string } } } = await graphRequest(path);
    all.push(...(body.data ?? []));
    const after = body.paging?.next ? body.paging.cursors?.after : undefined;
    path = after ? `${wabaId}/message_templates?limit=100&fields=id,name,language,status,category,components&after=${encodeURIComponent(after)}` : null;
  }
  return all;
}
