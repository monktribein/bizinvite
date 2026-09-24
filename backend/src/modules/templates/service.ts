import { Errors } from "../../common/errors/app-error";
import type { ActorContext } from "../../common/utils/context";
import { isWhatsAppDryRun, whatsappConfig } from "../../config/whatsapp";
import { recordAudit } from "../audit";
import { fetchMessageTemplates, RemoteTemplate } from "../conversations/whatsapp.client";
import { Organization } from "../organizations/model";
import { Template, TemplateDoc, toTemplateDto } from "./model";
import { extractPlaceholders, inferQuickReplyAction, unmappedVariables } from "./variables";

function approvalFromMeta(status: string): "APPROVED" | "PENDING" | "REJECTED" {
  if (status === "APPROVED") return "APPROVED";
  if (["PENDING", "IN_APPEAL", "PENDING_DELETION", "LIMIT_EXCEEDED"].includes(status)) return "PENDING";
  // REJECTED, PAUSED, DISABLED, DELETED... are not sendable.
  return "REJECTED";
}

export async function listTemplates(organizationId: string, filters: { approvalStatus?: string } = {}) {
  const query: Record<string, unknown> = { organizationId };
  if (filters.approvalStatus) query.approvalStatus = filters.approvalStatus;
  const templates = await Template.find(query).sort({ name: 1 });
  return templates.map(toTemplateDto);
}

export async function findTemplateOrThrow(organizationId: string, templateId: string): Promise<TemplateDoc> {
  const template = await Template.findOne({ _id: templateId, organizationId });
  if (!template) throw Errors.notFound("Template");
  return template;
}

/**
 * The single gate used before any template is sent: must be approved by Meta and
 * every placeholder must be bound to a supported business field.
 */
export function assertTemplateSendable(template: TemplateDoc): void {
  if (template.approvalStatus !== "APPROVED") throw Errors.templateNotApproved(template.name);
  const unmapped = unmappedVariables(template);
  if (unmapped.length) {
    throw Errors.validation(`Template "${template.name}" has unmapped variables: ${unmapped.join(", ")}`, {
      templateId: [`Map these variables before sending: ${unmapped.join(", ")}`],
    });
  }
}

function mapRemoteTemplate(remote: RemoteTemplate, existing?: TemplateDoc | null) {
  const header = remote.components.find((c) => c.type === "HEADER");
  const body = remote.components.find((c) => c.type === "BODY");
  const footer = remote.components.find((c) => c.type === "FOOTER");
  const buttons = remote.components.find((c) => c.type === "BUTTONS")?.buttons ?? [];
  const { names, named } = extractPlaceholders(body?.text ?? "");

  // Keep an organizer's variable bindings when the placeholder count is unchanged.
  const variables =
    existing && existing.variables.length === names.length
      ? existing.variables
      : named
        ? names
        : names.map((n) => `var_${n}`);

  return {
    externalId: remote.id,
    source: "meta" as const,
    name: remote.name,
    language: remote.language,
    category: (["MARKETING", "UTILITY", "AUTHENTICATION"].includes(remote.category) ? remote.category : "UTILITY") as
      | "MARKETING"
      | "UTILITY"
      | "AUTHENTICATION",
    approvalStatus: approvalFromMeta(remote.status),
    metaStatus: remote.status,
    headerType: (header?.format ?? "NONE") as "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE",
    headerContent: header?.text,
    bodyText: body?.text ?? "",
    footerText: footer?.text,
    variables,
    namedParameters: named,
    buttons: buttons.map((b, i) => ({
      type: b.type as "QUICK_REPLY" | "URL" | "PHONE_NUMBER",
      text: b.text,
      url: b.url,
      payload: existing?.buttons?.[i]?.payload ?? (b.type === "QUICK_REPLY" ? inferQuickReplyAction(b.text) : undefined),
    })),
    lastSyncedAt: new Date(),
  };
}

/** Pulls templates and their approval status from Meta for the organization's WABA. */
export async function syncTemplates(actor: ActorContext) {
  if (isWhatsAppDryRun()) throw Errors.whatsapp("WhatsApp Cloud API is not configured; template sync is unavailable");
  const org = await Organization.findById(actor.organizationId);
  const wabaId = org?.whatsApp?.wabaId ?? whatsappConfig.businessAccountId;
  if (!wabaId) throw Errors.validation("No WhatsApp Business Account is configured for this organization");

  let remote: RemoteTemplate[];
  try {
    remote = await fetchMessageTemplates(wabaId);
  } catch (err) {
    throw Errors.whatsapp(`Template sync failed: ${(err as Error).message}`);
  }

  let upserted = 0;
  for (const r of remote) {
    const existing = await Template.findOne({ organizationId: actor.organizationId, name: r.name, language: r.language });
    const fields = mapRemoteTemplate(r, existing);
    await Template.updateOne(
      { organizationId: actor.organizationId, name: r.name, language: r.language },
      { $set: { ...fields, organizationId: actor.organizationId } },
      { upsert: true }
    );
    upserted++;
  }
  // Templates removed on Meta can no longer be sent.
  await Template.updateMany(
    { organizationId: actor.organizationId, source: "meta", externalId: { $nin: remote.map((r) => r.id) } },
    { $set: { approvalStatus: "REJECTED", metaStatus: "DELETED" } }
  );
  if (org) {
    org.set("whatsApp.lastSyncAt", new Date());
    await org.save();
  }
  await recordAudit(actor, { action: "templates.synced", resourceType: "settings", details: `Synced ${upserted} WhatsApp templates` });
  return listTemplates(actor.organizationId);
}

export async function updateTemplateMapping(
  actor: ActorContext,
  templateId: string,
  changes: { variables?: string[]; buttonPayloads?: Array<string | null>; headerMediaUrl?: string }
) {
  const template = await findTemplateOrThrow(actor.organizationId, templateId);
  if (changes.variables) {
    if (changes.variables.length !== template.variables.length) {
      throw Errors.validation(`Template has ${template.variables.length} placeholders`, {
        variables: [`Provide exactly ${template.variables.length} variable bindings`],
      });
    }
    template.variables = changes.variables;
  }
  if (changes.buttonPayloads) {
    template.buttons.forEach((b, i) => {
      const payload = changes.buttonPayloads?.[i];
      if (payload !== undefined && b.type === "QUICK_REPLY") b.payload = payload ?? undefined;
    });
  }
  if (changes.headerMediaUrl !== undefined) template.headerMediaUrl = changes.headerMediaUrl;
  await template.save();
  await recordAudit(actor, { action: "template.mapping_updated", resourceType: "campaign", resourceId: template.id, details: `Updated variable mapping for ${template.name}` });
  return toTemplateDto(template);
}

/**
 * Local templates exist only for development without WhatsApp credentials (dry-run mode)
 * so the campaign pipeline can be exercised. They are refused whenever the real Cloud API
 * is configured, and in production.
 */
export async function createLocalTemplate(
  actor: ActorContext,
  input: { name: string; language: string; category: "MARKETING" | "UTILITY" | "AUTHENTICATION"; bodyText: string; variables?: string[]; buttons?: Array<{ type: "QUICK_REPLY"; text: string; payload?: string }> }
) {
  if (!isWhatsAppDryRun()) throw Errors.forbidden("Templates must be created in WhatsApp Manager and synced");
  const { names, named } = extractPlaceholders(input.bodyText);
  const variables = input.variables ?? (named ? names : names.map((n) => `var_${n}`));
  if (variables.length !== names.length) throw Errors.validation("Variable count does not match placeholders", { variables: ["Count mismatch"] });
  // A placeholder with no business field could never be filled, so the template could never be sent
  const unknown = unmappedVariables({ variables });
  if (unknown.length) {
    throw Errors.validation(`Unknown placeholders: ${unknown.map((v) => `{{${v}}}`).join(", ")}. Use supported names such as {{guest_name}} or {{event_name}}.`, {
      bodyText: [`Unknown placeholders: ${unknown.join(", ")}`],
    });
  }
  const template = await Template.create({
    ...input,
    organizationId: actor.organizationId,
    source: "local",
    approvalStatus: "APPROVED",
    metaStatus: "LOCAL_DRY_RUN",
    variables,
    namedParameters: named,
    buttons: (input.buttons ?? []).map((b) => ({ ...b, payload: b.payload ?? inferQuickReplyAction(b.text) })),
  });
  return toTemplateDto(template);
}
