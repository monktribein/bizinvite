import { sendPass } from "../../modules/passes/service";
import { QuickReplyStatus, sendRsvpReply } from "../../modules/rsvps/replies";
import { processWebhookEvent } from "../../modules/webhooks/service";
import { completed, failed, Processor } from "../jobs";
import { requirePayload } from "./payload";

/** whatsapp.send-pass: delivers a digital pass; transient WhatsApp errors throw and are retried. */
export const processSendPass: Processor = async (job) => {
  const { organizationId, passId } = requirePayload(job, ["passId"]);
  const result = await sendPass({ organizationId, passId });
  return "failed" in result ? failed(String(result.failed)) : completed(result);
};

/** whatsapp.process-webhook: applies one stored inbound message or status update (idempotent). */
export const processWebhook: Processor = async (job) => {
  const { webhookEventId } = requirePayload(job, ["webhookEventId"], false);
  return completed(await processWebhookEvent(webhookEventId));
};

/** whatsapp.rsvp-reply: confirms an RSVP button tap; "Yes" also delivers the QR pass. */
export const processRsvpReply: Processor = async (job) => {
  const { organizationId, eventGuestId, status } = requirePayload(job, ["eventGuestId", "status"]);
  if (!["attending", "declined", "maybe"].includes(status)) throw new Error(`Invalid whatsapp.rsvp-reply status: ${status}`);
  const result = await sendRsvpReply({ organizationId, eventGuestId, status: status as QuickReplyStatus, jobId: String(job._id) });
  return "failed" in result ? failed(String(result.failed)) : completed(result);
};
