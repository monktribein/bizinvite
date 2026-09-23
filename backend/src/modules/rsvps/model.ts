import { HydratedDocument, InferSchemaType, model, Schema } from "mongoose";
import { RSVP_STATUSES } from "../../common/constants/enums";
import { baseSchemaOptions, tenantGuardPlugin } from "../../common/utils/model";

export const RSVP_SOURCES = ["whatsapp_quick_reply", "whatsapp_text", "manual_staff_entry", "phone_call"] as const;
export type RsvpSource = (typeof RSVP_SOURCES)[number];

const rsvpSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    eventGuestId: { type: Schema.Types.ObjectId, ref: "EventGuest", required: true },
    guestId: { type: Schema.Types.ObjectId, ref: "Guest", required: true },
    status: { type: String, enum: RSVP_STATUSES, required: true },
    attendingCount: { type: Number, default: 0, min: 0 },
    companionsCount: { type: Number, default: 0, min: 0 },
    attendingSessionIds: [{ type: Schema.Types.ObjectId, ref: "EventSession" }],
    source: { type: String, enum: RSVP_SOURCES, required: true },
    respondedAt: { type: Date, required: true },
    updatedBy: { type: String },
    history: [
      {
        _id: false,
        previousStatus: String,
        newStatus: String,
        previousCount: Number,
        newCount: Number,
        changedAt: Date,
        changedBy: String,
        source: String,
        reason: String,
      },
    ],
  },
  { ...baseSchemaOptions(), collection: "rsvps" }
);

rsvpSchema.index({ organizationId: 1, eventGuestId: 1 }, { unique: true });
rsvpSchema.index({ organizationId: 1, eventId: 1, status: 1 });
rsvpSchema.plugin(tenantGuardPlugin);

export type RsvpDoc = HydratedDocument<InferSchemaType<typeof rsvpSchema>>;
export const Rsvp = model("Rsvp", rsvpSchema);

/** Optional per-guest requirements; only fields enabled in the event's rsvpConfig are stored. */
const guestRequirementSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    eventGuestId: { type: Schema.Types.ObjectId, ref: "EventGuest", required: true },
    dietaryPreference: { type: String, enum: ["vegetarian", "non_vegetarian", "vegan", "jain", "other"] },
    dietaryNotes: { type: String, maxlength: 1000 },
    needsAccommodation: { type: Boolean },
    accommodationNotes: { type: String, maxlength: 1000 },
    needsTransport: { type: Boolean },
    arrivalDetails: { type: String, maxlength: 1000 },
    specialRequests: { type: String, maxlength: 2000 },
  },
  { ...baseSchemaOptions(), collection: "guestRequirements" }
);

guestRequirementSchema.index({ organizationId: 1, eventGuestId: 1 }, { unique: true });
guestRequirementSchema.index({ organizationId: 1, eventId: 1 });
guestRequirementSchema.plugin(tenantGuardPlugin);

export type GuestRequirementDoc = HydratedDocument<InferSchemaType<typeof guestRequirementSchema>>;
export const GuestRequirement = model("GuestRequirement", guestRequirementSchema);
