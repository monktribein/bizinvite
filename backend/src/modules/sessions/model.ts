import { HydratedDocument, InferSchemaType, model, Schema } from "mongoose";
import { baseSchemaOptions, tenantGuardPlugin } from "../../common/utils/model";

/** A function within a multi-function event (Mehendi, Sangeet, Reception...). */
const eventSessionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 2000 },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    venueName: { type: String },
    venueAddress: { type: String },
    dressCode: { type: String },
    capacity: { type: Number, min: 0 },
  },
  { ...baseSchemaOptions(), collection: "eventSessions" }
);

eventSessionSchema.index({ organizationId: 1, eventId: 1, startTime: 1 });
eventSessionSchema.plugin(tenantGuardPlugin);

export type EventSessionDoc = HydratedDocument<InferSchemaType<typeof eventSessionSchema>>;
export const EventSession = model("EventSession", eventSessionSchema);

export function toSessionDto(s: EventSessionDoc) {
  return {
    id: s.id as string,
    eventId: String(s.eventId),
    name: s.name,
    description: s.description ?? undefined,
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
    venueName: s.venueName ?? undefined,
    venueAddress: s.venueAddress ?? undefined,
    dressCode: s.dressCode ?? undefined,
    capacity: s.capacity ?? undefined,
  };
}
