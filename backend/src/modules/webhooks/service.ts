import { systemActor } from "../../common/utils/context";
import { hmacSha256, safeEqual } from "../../common/utils/crypto";
import { logger } from "../../common/utils/logger";
import { CROSS_TENANT, isDuplicateKeyError } from "../../common/utils/model";
import { fromWhatsAppNumber } from "../../common/utils/mobile";
import { whatsappConfig } from "../../config/whatsapp";
import { enqueueJob } from "../../scheduler/jobs";
import { ScheduledJob } from "../../scheduler/model";
import { CampaignRecipient } from "../campaigns/model";
import { touchConversation } from "../conversations/messaging.service";
import { Message, MessageDoc } from "../conversations/model";
import { applyPermanentSendFailure, optInContact, optOutContact } from "../guests/consent.service";
import { EventGuest, Guest } from "../guests/model";
import { Organization } from "../organizations/model";
import { Pass } from "../passes/model";
import { setRsvp } from "../rsvps/service";
import { parseQuickReplyPayload } from "../templates/variables";
import { WebhookEvent } from "./model";
import { InboundMessage, inboundMessageSchema, StatusUpdate, statusUpdateSchema, webhookBodySchema } from "./schema";

/** Verifies Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw body with the app secret). */
export function verifySignature(rawBody: Buffer | undefined, header: string | undefined, appSecret = whatsappConfig.appSecret): boolean {
  if (!appSecret || !rawBody || !header?.startsWith("sha256=")) return false;
  return safeEqual(header.slice(7), hmacSha256(appSecret, rawBody));
}

/**
 * Stores each message/status in the payload once and returns the ids of newly stored
 * events. Redelivered items hit the unique dedupeKey and are skipped.
 */
export async function ingestWebhook(body: unknown): Promise<string[]> {
  const parsed = webhookBodySchema.safeParse(body);
  if (!parsed.success || parsed.data.object !== "whatsapp_business_account") {
    logger.warn("Ignoring webhook with unexpected shape");
    return [];
  }
  const created: string[] = [];
  const store = async (kind: "message" | "status", dedupeKey: string, waMessageId: string, phoneNumberId: string | undefined, payload: unknown) => {
    try {
      const doc = await WebhookEvent.create({ kind, dedupeKey, waMessageId, phoneNumberId, payload });
      created.push(doc.id as string);
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
    }
  };

  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      const phoneNumberId = change.value.metadata?.phone_number_id;
      for (const raw of change.value.messages ?? []) {
        const msg = inboundMessageSchema.safeParse(raw);
        if (msg.success) await store("message", `msg:${msg.data.id}`, msg.data.id, phoneNumberId, msg.data);
      }
      for (const raw of change.value.statuses ?? []) {
        const st = statusUpdateSchema.safeParse(raw);
        if (st.success) await store("status", `status:${st.data.id}:${st.data.status}`, st.data.id, phoneNumberId, st.data);
      }
    }
  }
  return created;
}

/** One whatsapp.process-webhook job per stored event (no organization yet: it is resolved while processing). */
export async function enqueueWebhookEvents(ids: string[]) {
  for (const id of ids) {
    await enqueueJob({ type: "whatsapp.process-webhook", payload: { webhookEventId: id }, dedupeKey: `webhook:${id}`, maxAttempts: 5 });
  }
}

const STATUS_ORDER = ["queued", "pending", "sent", "delivered", "read"];

/** Statuses a record may be in for an update to `next` to apply (never move backwards). */
function statusesBefore(next: "sent" | "delivered" | "read" | "failed"): string[] {
  if (next === "failed") return ["queued", "pending", "sent"];
  return STATUS_ORDER.slice(0, STATUS_ORDER.indexOf(next));
}

async function applyStatus(update: StatusUpdate): Promise<string> {
  const message = await Message.findOne({ waMessageId: update.id }).setOptions(CROSS_TENANT);
  if (!message) return "unknown_message";
  if (update.status === "deleted" || update.status === "warning") return "ignored_status";
  const organizationId = String(message.organizationId);
  const next = update.status;
  const at = update.timestamp ? new Date(Number(update.timestamp) * 1000) : new Date();
  const timeField = { sent: "sentAt", delivered: "deliveredAt", read: "readAt", failed: "failedAt" }[next];
  const error = update.errors?.[0];

  await Message.updateOne(
    { _id: message._id, organizationId, status: { $in: statusesBefore(next) } },
    { $set: { status: next, [timeField]: at, ...(error ? { errorCode: error.code, errorMessage: error.message ?? error.title } : {}) } }
  );

  if (message.campaignRecipientId) {
    await CampaignRecipient.updateOne(
      { _id: message.campaignRecipientId, organizationId, status: { $in: statusesBefore(next) } },
      { $set: { status: next, [timeField]: at, ...(error ? { errorCode: error.code, errorMessage: (error.message ?? error.title)?.slice(0, 500) } : {}) } }
    );
  }
  if (message.passId) {
    await Pass.updateOne({ _id: message.passId, organizationId }, { $set: { deliveryStatus: next === "read" ? "delivered" : next } });
  }

  if (next === "failed") {
    if (message.scheduledJobId) {
      await ScheduledJob.updateOne(
        { _id: message.scheduledJobId, organizationId, status: "completed" },
        { $set: { status: "failed", lastError: error?.message ?? "Delivery failed" } }
      );
      if (message.eventGuestId) await EventGuest.updateOne({ _id: message.eventGuestId, organizationId }, { $set: { reminderStatus: "failed" } });
    }
    if (error?.code !== undefined && message.guestId) {
      const contact = await Guest.findOne({ _id: message.guestId, organizationId });
      if (contact) await applyPermanentSendFailure(systemActor(organizationId, "whatsapp-webhook"), contact, error.code);
    }
  }
  return `status_${next}`;
}

/** Works out which organization an inbound message belongs to. */
async function resolveInboundOrganization(msg: InboundMessage, phoneNumberId?: string): Promise<{ organizationId: string; replyTo?: MessageDoc } | null> {
  if (msg.context?.id) {
    const replyTo = await Message.findOne({ waMessageId: msg.context.id }).setOptions(CROSS_TENANT);
    if (replyTo) return { organizationId: String(replyTo.organizationId), replyTo };
  }
  if (phoneNumberId) {
    const orgs = await Organization.find({ "whatsApp.phoneNumberId": phoneNumberId }).select("_id").limit(2);
    if (orgs.length === 1) return { organizationId: orgs[0].id as string };
  }
  // Shared platform number: attribute to the organization that last messaged this guest.
  const mobile = fromWhatsAppNumber(msg.from);
  const last = await Message.findOne({ mobile, direction: "outbound" }).setOptions(CROSS_TENANT).sort({ createdAt: -1 });
  return last ? { organizationId: String(last.organizationId) } : null;
}

const OPT_OUT_WORDS = new Set(["stop", "unsubscribe", "opt out", "optout", "stop all"]);
const OPT_IN_WORDS = new Set(["start", "subscribe", "unstop"]);

async function applyInbound(msg: InboundMessage, phoneNumberId?: string): Promise<{ outcome: string; organizationId?: string }> {
  const resolved = await resolveInboundOrganization(msg, phoneNumberId);
  if (!resolved) return { outcome: "unknown_sender" };
  const { organizationId, replyTo } = resolved;
  const mobile = fromWhatsAppNumber(msg.from);
  const contact = await Guest.findOne({ organizationId, mobile });
  const actor = systemActor(organizationId, "whatsapp-webhook");

  const buttonPayload = msg.button?.payload ?? msg.interactive?.button_reply?.id;
  const text = msg.text?.body ?? msg.button?.text ?? msg.interactive?.button_reply?.title ?? "";

  // Record the inbound message (unique waMessageId keeps this idempotent as well).
  const conversation = await touchConversation({
    organizationId,
    mobile,
    guestId: contact?._id,
    guestName: contact?.name,
    eventId: replyTo?.eventId ?? undefined,
    direction: "inbound",
    snippet: text || `[${msg.type}]`,
    at: new Date(),
  });
  try {
    await Message.create({
      organizationId,
      conversationId: conversation?._id,
      direction: "inbound",
      type: msg.type,
      body: text.slice(0, 4096),
      guestId: contact?._id,
      eventGuestId: replyTo?.eventGuestId,
      eventId: replyTo?.eventId,
      mobile,
      phoneNumberId,
      waMessageId: msg.id,
      status: "received",
      purpose: "inbound",
      receivedAt: msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date(),
    });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
  }

  if (!contact) return { outcome: "message_from_unknown_contact", organizationId };

  const normalized = text.trim().toLowerCase();
  const { action, eventGuestId: payloadGuestId } = parseQuickReplyPayload(buttonPayload);

  if (action === "ACTION_OPT_OUT" || (!buttonPayload && OPT_OUT_WORDS.has(normalized))) {
    await optOutContact(actor, contact, "whatsapp", "Guest replied STOP");
    return { outcome: "opted_out", organizationId };
  }
  if (!buttonPayload && OPT_IN_WORDS.has(normalized)) {
    await optInContact(actor, contact, "whatsapp");
    return { outcome: "opted_in", organizationId };
  }

  if (action) {
    const candidateId = payloadGuestId ?? (replyTo?.eventGuestId ? String(replyTo.eventGuestId) : undefined);
    if (!candidateId) return { outcome: "rsvp_without_invitation", organizationId };
    // The invitation must belong to the guest who actually sent the reply.
    const invitation = await EventGuest.findOne({ _id: candidateId, organizationId, guestId: contact._id });
    if (!invitation) return { outcome: "rsvp_invitation_mismatch", organizationId };
    const status = action === "ACTION_RSVP_YES" ? "attending" : action === "ACTION_RSVP_NO" ? "declined" : "maybe";
    try {
      await setRsvp(actor, invitation.id as string, { status, source: "whatsapp_quick_reply" });
    } catch (err) {
      return { outcome: `rsvp_rejected: ${(err as Error).message}`, organizationId };
    }
    return { outcome: `rsvp_${status}`, organizationId };
  }
  return { outcome: "message_recorded", organizationId };
}

/** How long a status for an unknown message id is retried before it is ignored as foreign. */
export const STATUS_RACE_WINDOW_MS = 10 * 60 * 1000;

/** whatsapp.process-webhook job. Claims the event so two runs cannot both process it. */
export async function processWebhookEvent(webhookEventId: string) {
  const event = await WebhookEvent.findOneAndUpdate(
    { _id: webhookEventId, status: { $in: ["received", "failed"] }, attempts: { $lt: 5 } },
    { $set: { status: "processing" }, $inc: { attempts: 1 } },
    { new: true }
  );
  if (!event) return { skipped: "already_processed" };
  try {
    let outcome: string;
    let organizationId: string | undefined;
    if (event.kind === "status") {
      outcome = await applyStatus(statusUpdateSchema.parse(event.payload));
    } else {
      ({ outcome, organizationId } = await applyInbound(inboundMessageSchema.parse(event.payload), event.phoneNumberId ?? undefined));
    }
    if (event.kind === "status" && outcome === "unknown_message" && Date.now() - (event.get("createdAt") as Date).getTime() < STATUS_RACE_WINDOW_MS) {
      // Meta can report "sent" before the send call returned and the message id was stored: retry shortly.
      throw new Error("Status for a message id not stored yet; will retry");
    }
    const ignored = ["unknown_message", "unknown_sender", "ignored_status"].includes(outcome);
    await WebhookEvent.updateOne(
      { _id: event._id },
      { $set: { status: ignored ? "ignored" : "processed", outcome, processedAt: new Date(), ...(organizationId ? { organizationId } : {}) } }
    );
    return { outcome };
  } catch (err) {
    await WebhookEvent.updateOne({ _id: event._id }, { $set: { status: "failed", error: (err as Error).message.slice(0, 500) } });
    throw err;
  }
}
