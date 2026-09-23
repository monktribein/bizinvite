import { HydratedDocument, InferSchemaType, model, Schema } from "mongoose";
import { baseSchemaOptions, tenantGuardPlugin } from "../../common/utils/model";

/** A family or party invited together (used for group check-in). */
const guestGroupSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    /** eventGuest id of the group's primary contact */
    primaryContactGuestId: { type: Schema.Types.ObjectId, ref: "EventGuest" },
    notes: { type: String, maxlength: 2000 },
  },
  { ...baseSchemaOptions(), collection: "guestGroups" }
);

guestGroupSchema.index({ organizationId: 1, eventId: 1, name: 1 }, { unique: true });
guestGroupSchema.plugin(tenantGuardPlugin);

export type GuestGroupDoc = HydratedDocument<InferSchemaType<typeof guestGroupSchema>>;
export const GuestGroup = model("GuestGroup", guestGroupSchema);

export function toGuestGroupDto(g: GuestGroupDoc, memberCount?: number) {
  return {
    id: g.id as string,
    eventId: String(g.eventId),
    name: g.name,
    primaryContactGuestId: g.primaryContactGuestId ? String(g.primaryContactGuestId) : undefined,
    notes: g.notes ?? undefined,
    ...(memberCount !== undefined ? { memberCount } : {}),
  };
}
