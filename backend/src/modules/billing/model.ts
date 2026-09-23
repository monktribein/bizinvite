import { InferSchemaType, model, Schema } from "mongoose";
import { baseSchemaOptions, tenantGuardPlugin } from "../../common/utils/model";

const subscriptionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, unique: true },
    plan: { type: String, enum: ["starter", "growth", "enterprise"], default: "starter" },
    status: { type: String, enum: ["trialing", "active", "past_due", "cancelled"], default: "active" },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { ...baseSchemaOptions(), collection: "subscriptions" }
);
subscriptionSchema.plugin(tenantGuardPlugin);
export const Subscription = model("Subscription", subscriptionSchema);

/** Monthly usage counters per organization and metric (e.g. whatsapp_messages). */
const usageRecordSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    period: { type: String, required: true }, // YYYY-MM
    metric: { type: String, required: true },
    quantity: { type: Number, default: 0 },
  },
  { ...baseSchemaOptions(), collection: "usageRecords" }
);
usageRecordSchema.index({ organizationId: 1, period: 1, metric: 1 }, { unique: true });
usageRecordSchema.plugin(tenantGuardPlugin);
export const UsageRecord = model("UsageRecord", usageRecordSchema);

const invoiceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    number: { type: String, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    amountInr: { type: Number, required: true },
    status: { type: String, enum: ["draft", "issued", "paid", "void"], default: "draft" },
    issuedAt: { type: Date },
  },
  { ...baseSchemaOptions(), collection: "invoices" }
);
invoiceSchema.index({ organizationId: 1, periodStart: -1 });
invoiceSchema.index({ organizationId: 1, number: 1 }, { unique: true });
invoiceSchema.plugin(tenantGuardPlugin);
export const Invoice = model("Invoice", invoiceSchema);

export type SubscriptionDoc = InferSchemaType<typeof subscriptionSchema>;
