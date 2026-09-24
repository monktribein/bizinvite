import { HydratedDocument, InferSchemaType, model, Schema } from "mongoose";
import { baseSchemaOptions, tenantGuardPlugin } from "../../common/utils/model";

/** Every gate decision (admitted, duplicate warning or rejection) is recorded. */
const checkInSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    eventGuestId: { type: Schema.Types.ObjectId, ref: "EventGuest", required: true },
    guestId: { type: Schema.Types.ObjectId, ref: "Guest", required: true },
    passId: { type: Schema.Types.ObjectId, ref: "Pass" },
    guestName: { type: String, required: true },
    guestMobile: { type: String },
    isVip: { type: Boolean, default: false },
    category: { type: String },
    gateId: { type: String, required: true },
    gateName: { type: String, required: true },
    method: { type: String, enum: ["qr", "pass_code", "manual", "group"], required: true },
    paxAdmitted: { type: Number, default: 0 },
    totalAllowedPax: { type: Number, required: true },
    status: { type: String, enum: ["admitted", "duplicate_warning", "rejected"], required: true },
    reason: { type: String },
    executiveUserId: { type: Schema.Types.ObjectId, ref: "User" },
    executiveName: { type: String },
    scannedAt: { type: Date, default: () => new Date() },
  },
  { ...baseSchemaOptions(), collection: "checkIns" }
);

checkInSchema.index({ organizationId: 1, eventId: 1, scannedAt: -1 });
checkInSchema.index({ organizationId: 1, eventId: 1, status: 1, gateId: 1 });
checkInSchema.index({ organizationId: 1, eventGuestId: 1 });
checkInSchema.plugin(tenantGuardPlugin);

export type CheckInDoc = HydratedDocument<InferSchemaType<typeof checkInSchema>>;
export const CheckIn = model("CheckIn", checkInSchema);

/** Frontend `CheckInRecord`. */
export function toCheckInDto(c: CheckInDoc) {
  return {
    id: c.id as string,
    guestId: String(c.eventGuestId),
    guestName: c.guestName,
    guestMobile: c.guestMobile ?? "",
    isVip: c.isVip,
    category: c.category ?? "Family",
    eventId: String(c.eventId),
    gateId: c.gateId,
    gateName: c.gateName,
    method: c.method,
    paxAdmitted: c.paxAdmitted,
    totalAllowedPax: c.totalAllowedPax,
    scannedAt: c.scannedAt.toISOString(),
    executiveName: c.executiveName ?? "",
    status: c.status,
    reason: c.reason ?? undefined,
  };
}
