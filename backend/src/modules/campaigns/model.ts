import { HydratedDocument, InferSchemaType, model, Schema } from "mongoose";
import { CAMPAIGN_STATUSES, RECIPIENT_STATUSES, RSVP_STATUSES } from "../../common/constants/enums";
import { baseSchemaOptions, tenantGuardPlugin } from "../../common/utils/model";

const campaignSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    templateId: { type: Schema.Types.ObjectId, ref: "Template", required: true },
    templateName: { type: String, required: true },
    status: { type: String, enum: CAMPAIGN_STATUSES, default: "draft" },
    targetSegment: {
      category: { type: String },
      rsvpStatus: { type: String, enum: RSVP_STATUSES },
      onlyVip: { type: Boolean },
      sessionIds: [{ type: Schema.Types.ObjectId, ref: "EventSession" }],
      groupIds: [{ type: Schema.Types.ObjectId, ref: "GuestGroup" }],
      /** Only guests who have never received an invitation message. */
      onlyUninvited: { type: Boolean },
    },
    scheduledFor: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    pausedAt: { type: Date },
    cancelledAt: { type: Date },
    /** Recipients are materialized once per campaign. */
    recipientsBuiltAt: { type: Date },
    /** Incremented on schedule changes and resumes so stale queued jobs become no-ops. */
    dispatchGeneration: { type: Number, default: 0 },
    totalTargeted: { type: Number, default: 0 },
    failureReason: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { ...baseSchemaOptions(), collection: "campaigns" }
);

campaignSchema.index({ organizationId: 1, eventId: 1, status: 1 });
campaignSchema.index({ organizationId: 1, createdAt: -1 });
campaignSchema.plugin(tenantGuardPlugin);

export type CampaignDoc = HydratedDocument<InferSchemaType<typeof campaignSchema>>;
export const Campaign = model("Campaign", campaignSchema);

const campaignRecipientSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    eventGuestId: { type: Schema.Types.ObjectId, ref: "EventGuest", required: true },
    guestId: { type: Schema.Types.ObjectId, ref: "Guest", required: true },
    guestName: { type: String, required: true },
    mobile: { type: String, required: true },
    status: { type: String, enum: RECIPIENT_STATUSES, default: "pending" },
    /** Set when the campaign job claims the recipient for sending (at-most-once delivery). */
    claimedAt: { type: Date },
    /** Transient send failures so far; the recipient is marked failed after a few. */
    sendAttempts: { type: Number, default: 0 },
    messageId: { type: Schema.Types.ObjectId, ref: "Message" },
    waMessageId: { type: String },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    failedAt: { type: Date },
    errorCode: { type: Number },
    errorMessage: { type: String },
    suppressionReason: { type: String },
  },
  { ...baseSchemaOptions(), collection: "campaignRecipients" }
);

campaignRecipientSchema.index({ campaignId: 1, eventGuestId: 1 }, { unique: true });
campaignRecipientSchema.index({ organizationId: 1, campaignId: 1, status: 1 });
campaignRecipientSchema.index({ organizationId: 1, guestId: 1, status: 1 });
campaignRecipientSchema.index({ waMessageId: 1 }, { sparse: true });
campaignRecipientSchema.plugin(tenantGuardPlugin);

export type CampaignRecipientDoc = HydratedDocument<InferSchemaType<typeof campaignRecipientSchema>>;
export const CampaignRecipient = model("CampaignRecipient", campaignRecipientSchema);
