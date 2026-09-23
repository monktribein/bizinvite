import { HydratedDocument, InferSchemaType, model, Schema } from "mongoose";
import { baseSchemaOptions } from "../../common/utils/model";

/**
 * Every inbound WhatsApp webhook item (one message or one status update) is stored
 * once. The unique dedupeKey makes redelivered webhooks no-ops, so business actions
 * (RSVP updates, opt-outs, status changes) run exactly once.
 * organizationId is resolved during processing, so this collection is not tenant-guarded.
 */
const webhookEventSchema = new Schema(
  {
    source: { type: String, enum: ["whatsapp"], default: "whatsapp" },
    kind: { type: String, enum: ["message", "status"], required: true },
    dedupeKey: { type: String, required: true, unique: true },
    waMessageId: { type: String, required: true },
    phoneNumberId: { type: String },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    /** Validated, minimal payload for this item (not the full webhook body). */
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["received", "processing", "processed", "ignored", "failed"], default: "received" },
    attempts: { type: Number, default: 0 },
    outcome: { type: String },
    error: { type: String },
    receivedAt: { type: Date, default: () => new Date() },
    processedAt: { type: Date },
  },
  { ...baseSchemaOptions(), collection: "webhookEvents" }
);

webhookEventSchema.index({ status: 1, receivedAt: 1 });
// Webhook history is operational data: keep 90 days.
webhookEventSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export type WebhookEventDoc = HydratedDocument<InferSchemaType<typeof webhookEventSchema>>;
export const WebhookEvent = model("WebhookEvent", webhookEventSchema);
