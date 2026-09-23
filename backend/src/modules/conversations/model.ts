import { HydratedDocument, InferSchemaType, model, Schema } from "mongoose";
import { MESSAGE_STATUSES } from "../../common/constants/enums";
import { baseSchemaOptions, tenantGuardPlugin } from "../../common/utils/model";

/** One WhatsApp thread between the organization's number and a guest's number. */
const conversationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    guestId: { type: Schema.Types.ObjectId, ref: "Guest" },
    mobile: { type: String, required: true },
    guestName: { type: String },
    eventIds: [{ type: Schema.Types.ObjectId, ref: "Event" }],
    lastMessageAt: { type: Date },
    lastMessageSnippet: { type: String },
    lastDirection: { type: String, enum: ["inbound", "outbound"] },
    unreadCount: { type: Number, default: 0 },
    /** Last inbound message time: free-form replies are allowed for 24h after it. */
    lastInboundAt: { type: Date },
  },
  { ...baseSchemaOptions(), collection: "conversations" }
);

conversationSchema.index({ organizationId: 1, mobile: 1 }, { unique: true });
conversationSchema.index({ organizationId: 1, lastMessageAt: -1 });
conversationSchema.index({ organizationId: 1, guestId: 1 });
conversationSchema.plugin(tenantGuardPlugin);

export type ConversationDoc = HydratedDocument<InferSchemaType<typeof conversationSchema>>;
export const Conversation = model("Conversation", conversationSchema);

const messageSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation" },
    direction: { type: String, enum: ["inbound", "outbound"], required: true },
    type: { type: String, default: "template" },
    templateName: { type: String },
    body: { type: String },
    guestId: { type: Schema.Types.ObjectId, ref: "Guest" },
    eventGuestId: { type: Schema.Types.ObjectId, ref: "EventGuest" },
    eventId: { type: Schema.Types.ObjectId, ref: "Event" },
    mobile: { type: String, required: true },
    phoneNumberId: { type: String },
    /** WhatsApp message id (wamid...). Unique: webhooks are matched on it. */
    waMessageId: { type: String },
    status: { type: String, enum: MESSAGE_STATUSES, default: "queued" },
    errorCode: { type: Number },
    errorMessage: { type: String },
    purpose: { type: String, enum: ["campaign", "reminder", "pass", "test", "reply", "inbound"], required: true },
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign" },
    campaignRecipientId: { type: Schema.Types.ObjectId, ref: "CampaignRecipient" },
    reminderRuleId: { type: Schema.Types.ObjectId, ref: "ReminderRule" },
    scheduledJobId: { type: Schema.Types.ObjectId, ref: "ScheduledJob" },
    passId: { type: Schema.Types.ObjectId, ref: "Pass" },
    dryRun: { type: Boolean, default: false },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    failedAt: { type: Date },
    receivedAt: { type: Date },
  },
  { ...baseSchemaOptions(), collection: "messages" }
);

messageSchema.index({ waMessageId: 1 }, { unique: true, partialFilterExpression: { waMessageId: { $type: "string" } } });
messageSchema.index({ organizationId: 1, conversationId: 1, createdAt: 1 });
messageSchema.index({ organizationId: 1, eventId: 1, purpose: 1, status: 1 });
messageSchema.index({ organizationId: 1, reminderRuleId: 1, status: 1 });
messageSchema.plugin(tenantGuardPlugin);

export type MessageDoc = HydratedDocument<InferSchemaType<typeof messageSchema>>;
export const Message = model("Message", messageSchema);

export function toMessageDto(m: MessageDoc) {
  return {
    id: m.id as string,
    conversationId: m.conversationId ? String(m.conversationId) : undefined,
    direction: m.direction,
    type: m.type,
    templateName: m.templateName ?? undefined,
    body: m.body ?? "",
    status: m.status,
    purpose: m.purpose,
    errorCode: m.errorCode ?? undefined,
    errorMessage: m.errorMessage ?? undefined,
    waMessageId: m.waMessageId ?? undefined,
    sentAt: m.sentAt?.toISOString(),
    deliveredAt: m.deliveredAt?.toISOString(),
    readAt: m.readAt?.toISOString(),
    failedAt: m.failedAt?.toISOString(),
    timestamp: ((m.receivedAt ?? m.sentAt ?? m.get("createdAt")) as Date).toISOString(),
  };
}
