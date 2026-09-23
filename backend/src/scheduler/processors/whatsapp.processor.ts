import { sendPass } from "../../modules/passes/service";
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
