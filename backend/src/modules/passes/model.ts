import { HydratedDocument, InferSchemaType, model, Schema } from "mongoose";
import { PASS_STATUSES } from "../../common/constants/enums";
import { baseSchemaOptions, tenantGuardPlugin } from "../../common/utils/model";

const passSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    eventGuestId: { type: Schema.Types.ObjectId, ref: "EventGuest", required: true },
    guestId: { type: Schema.Types.ObjectId, ref: "Guest", required: true },
    /** Short human-readable code for manual entry (e.g. BIZ-2026-X79K2P). */
    passCode: { type: String, required: true },
    /** SHA-256 of the signed token; the token itself is never stored. */
    tokenHash: { type: String, required: true, unique: true },
    /** Inputs needed to re-derive the signed token for display/resend. */
    nonce: { type: String, required: true },
    issuedAllowedPax: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: PASS_STATUSES, default: "active" },
    /** The pass currently valid for this invitation (older ones are revoked). */
    isCurrent: { type: Boolean, default: true },
    validSessionIds: [{ type: Schema.Types.ObjectId, ref: "EventSession" }],
    deliveryStatus: { type: String, enum: ["delivered", "sent", "failed", "not_sent"], default: "not_sent" },
    lastSentAt: { type: Date },
    revokedAt: { type: Date },
    revokedBy: { type: Schema.Types.ObjectId, ref: "User" },
    revokeReason: { type: String },
  },
  { ...baseSchemaOptions(["tokenHash", "nonce"]), collection: "passes" }
);

passSchema.index({ organizationId: 1, passCode: 1 }, { unique: true });
passSchema.index({ organizationId: 1, eventId: 1, status: 1 });
passSchema.index(
  { organizationId: 1, eventGuestId: 1 },
  { unique: true, partialFilterExpression: { isCurrent: true } }
);
passSchema.plugin(tenantGuardPlugin);

export type PassDoc = HydratedDocument<InferSchemaType<typeof passSchema>>;
export const Pass = model("Pass", passSchema);
