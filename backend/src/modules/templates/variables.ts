import type { TemplateComponent } from "../conversations/whatsapp.client";
import type { TemplateDoc } from "./model";

/** Business fields a template placeholder can be bound to. */
export const SUPPORTED_VARIABLES = [
  "guest_name",
  "event_name",
  "event_date",
  "event_time",
  "venue",
  "venue_address",
  "venue_city",
  "rsvp_deadline",
  "dress_code",
  "host_names",
  "companions_allowed",
  "session_names",
  "organization_name",
  "pass_code",
  "pass_url",
] as const;
export type TemplateVariable = (typeof SUPPORTED_VARIABLES)[number];

export type VariableContext = Partial<Record<TemplateVariable, string>>;

export const QUICK_REPLY_ACTIONS = ["ACTION_RSVP_YES", "ACTION_RSVP_NO", "ACTION_RSVP_MAYBE", "ACTION_OPT_OUT"] as const;
export type QuickReplyAction = (typeof QUICK_REPLY_ACTIONS)[number];

/** Default action for a quick-reply button, inferred from its label. */
export function inferQuickReplyAction(text: string): QuickReplyAction | undefined {
  const t = text.toLowerCase();
  if (/\b(stop|unsubscribe|opt ?out)\b/.test(t)) return "ACTION_OPT_OUT";
  if (/\b(maybe|tentative|not sure)\b/.test(t)) return "ACTION_RSVP_MAYBE";
  if (/\b(no|decline|regret|can'?t|cannot|unable|not attending)\b/.test(t)) return "ACTION_RSVP_NO";
  if (/\b(yes|attend|attending|accept|confirm|coming|will be there)\b/.test(t)) return "ACTION_RSVP_YES";
  return undefined;
}

/** Placeholders in body text: positional {{1}} or named {{guest_name}}. */
export function extractPlaceholders(bodyText: string): { names: string[]; named: boolean } {
  const matches = [...bodyText.matchAll(/\{\{\s*([\w]+)\s*\}\}/g)].map((m) => m[1]);
  const unique = [...new Set(matches)];
  const named = unique.some((m) => !/^\d+$/.test(m));
  if (!named) unique.sort((a, b) => Number(a) - Number(b));
  return { names: unique, named };
}

/** Variables that are not bound to a supported business field. */
export function unmappedVariables(template: Pick<TemplateDoc, "variables">): string[] {
  return template.variables.filter((v) => !(SUPPORTED_VARIABLES as readonly string[]).includes(v));
}

/**
 * Builds Cloud API template components.
 * Quick-reply payloads are "<ACTION>:<eventGuestId>" so an inbound button reply maps
 * unambiguously to one invitation.
 */
export function buildTemplateComponents(
  template: Pick<TemplateDoc, "variables" | "namedParameters" | "headerType" | "headerMediaUrl" | "buttons">,
  context: VariableContext,
  options: { eventGuestId?: string; headerMediaUrl?: string } = {}
): TemplateComponent[] {
  const components: TemplateComponent[] = [];

  const mediaUrl = options.headerMediaUrl ?? template.headerMediaUrl ?? undefined;
  const headerType = template.headerType ?? "NONE";
  if (["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType) && mediaUrl) {
    const key = headerType.toLowerCase();
    components.push({ type: "header", parameters: [{ type: key, [key]: { link: mediaUrl } }] });
  }

  if (template.variables.length) {
    components.push({
      type: "body",
      parameters: template.variables.map((variable) => ({
        type: "text",
        text: (context[variable as TemplateVariable] ?? "").slice(0, 1024) || "-",
        ...(template.namedParameters ? { parameter_name: variable } : {}),
      })),
    });
  }

  (template.buttons ?? []).forEach((button, index) => {
    if (button.type === "QUICK_REPLY" && options.eventGuestId) {
      const action = button.payload ?? inferQuickReplyAction(button.text ?? "");
      if (!action) return;
      components.push({
        type: "button",
        sub_type: "quick_reply",
        index: String(index),
        parameters: [{ type: "payload", payload: `${action}:${options.eventGuestId}` }],
      });
    }
  });

  return components;
}

/** Parses an inbound quick-reply payload. */
export function parseQuickReplyPayload(payload: string | undefined): { action?: QuickReplyAction; eventGuestId?: string } {
  if (!payload) return {};
  const [action, eventGuestId] = payload.split(":");
  if (!(QUICK_REPLY_ACTIONS as readonly string[]).includes(action)) return {};
  return { action: action as QuickReplyAction, eventGuestId: eventGuestId && /^[a-f\d]{24}$/i.test(eventGuestId) ? eventGuestId : undefined };
}

/** Renders body text for message history / previews. */
export function renderBody(bodyText: string, template: Pick<TemplateDoc, "variables" | "namedParameters">, context: VariableContext): string {
  return bodyText.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_m, key: string) => {
    const variable = template.namedParameters ? key : template.variables[Number(key) - 1];
    return (variable && context[variable as TemplateVariable]) || `{{${key}}}`;
  });
}
