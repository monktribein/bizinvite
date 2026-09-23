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

export class WhatsAppSendError extends Error {
  constructor(
    message: string,
    public readonly code: number | undefined,
    public readonly permanent: boolean
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

async function graphRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!whatsappConfig.accessToken) throw Errors.whatsapp("WhatsApp Cloud API is not configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${whatsappConfig.graphBaseUrl}/${whatsappConfig.apiVersion}/${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${whatsappConfig.accessToken}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const body = (await response.json().catch(() => ({}))) as T & GraphError;
    if (!response.ok) {
      const code = body.error?.code;
      const message = body.error?.error_data?.details ?? body.error?.message ?? `Graph API HTTP ${response.status}`;
      const permanent = code !== undefined ? PERMANENT_ERROR_CODES.has(code) : response.status >= 400 && response.status < 500 && response.status !== 429;
      throw new WhatsAppSendError(message, code, permanent);
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
  if (!phoneNumberId) throw new WhatsAppSendError("No WhatsApp phone number id configured", undefined, true);

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
