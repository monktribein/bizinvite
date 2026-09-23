import { HydratedDocument, InferSchemaType, model, Schema } from "mongoose";
import {
  CHECKIN_STATUSES,
  CONSENT_SOURCES,
  GUEST_CATEGORIES,
  REMINDER_STATUSES,
  RSVP_STATUSES,
} from "../../common/constants/enums";
import { baseSchemaOptions, tenantGuardPlugin } from "../../common/utils/model";

/**
 * A person in the organization's guest CRM, unique per organization by mobile.
 * Communication state (opt-out, suppression, invalid number) lives here because it
 * applies across every event.
 */
const guestSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    /** E.164 */
    mobile: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    category: { type: String, enum: GUEST_CATEGORIES, default: "General" },
    isVip: { type: Boolean, default: false },
    city: { type: String },
    preferredLanguage: { type: String, default: "English" },
    relationshipWithHost: { type: String },
    assignedRelationshipManager: { type: String },
    consentSource: { type: String, enum: CONSENT_SOURCES, default: "manual_entry" },
    consentTimestamp: { type: Date, default: () => new Date() },
    optedOut: { type: Boolean, default: false },
    optedOutAt: { type: Date },
    communicationSuppressed: { type: Boolean, default: false },
    suppressionReason: { type: String },
    mobileValid: { type: Boolean, default: true },
    mobileInvalidReason: { type: String },
  },
  { ...baseSchemaOptions(), collection: "guests" }
);

guestSchema.index({ organizationId: 1, mobile: 1 }, { unique: true });
guestSchema.index({ organizationId: 1, name: 1 });
guestSchema.plugin(tenantGuardPlugin);

export type GuestDoc = HydratedDocument<InferSchemaType<typeof guestSchema>>;
export const Guest = model("Guest", guestSchema);

/**
 * A guest's invitation to one event: RSVP, reminder and check-in state.
 * Its id is the "guest id" used by the frontend (PATCH /guests/:id, /rsvps/:guestId, check-in).
 * name/mobile/category/isVip are denormalized from the guest for filtering and segments.
 */
const eventGuestSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    guestId: { type: Schema.Types.ObjectId, ref: "Guest", required: true },
    groupId: { type: Schema.Types.ObjectId, ref: "GuestGroup" },

    name: { type: String, required: true },
    mobile: { type: String, required: true },
    category: { type: String, enum: GUEST_CATEGORIES, default: "General" },
    isVip: { type: Boolean, default: false },

    invitedSessionIds: [{ type: Schema.Types.ObjectId, ref: "EventSession" }],
    allowedCompanions: { type: Number, default: 0, min: 0, max: 50 },
    confirmedCompanions: { type: Number, default: 0, min: 0 },
    notes: { type: String, maxlength: 2000 },

    invitedAt: { type: Date },
    rsvpStatus: { type: String, enum: RSVP_STATUSES, default: "no_response" },
    rsvpResponseTime: { type: Date },

    reminderStatus: { type: String, enum: REMINDER_STATUSES, default: "none" },
    lastReminderAt: { type: Date },

    checkInStatus: { type: String, enum: CHECKIN_STATUSES, default: "not_checked_in" },
    checkedInAt: { type: Date },
    checkedInCount: { type: Number, default: 0, min: 0 },
    lastCheckInGate: { type: String },
  },
  { ...baseSchemaOptions(), collection: "eventGuests" }
);

eventGuestSchema.index({ organizationId: 1, eventId: 1, guestId: 1 }, { unique: true });
eventGuestSchema.index({ organizationId: 1, eventId: 1, rsvpStatus: 1 });
eventGuestSchema.index({ organizationId: 1, eventId: 1, reminderStatus: 1 });
eventGuestSchema.index({ organizationId: 1, eventId: 1, checkInStatus: 1 });
eventGuestSchema.index({ organizationId: 1, eventId: 1, category: 1 });
eventGuestSchema.index({ organizationId: 1, eventId: 1, mobile: 1 });
eventGuestSchema.index({ organizationId: 1, guestId: 1 });
eventGuestSchema.index({ organizationId: 1, groupId: 1 }, { sparse: true });
eventGuestSchema.plugin(tenantGuardPlugin);

export type EventGuestDoc = HydratedDocument<InferSchemaType<typeof eventGuestSchema>>;
export const EventGuest = model("EventGuest", eventGuestSchema);

/** Append-only consent history (opt-in / opt-out) per guest. */
const consentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    guestId: { type: Schema.Types.ObjectId, ref: "Guest", required: true },
    guestName: { type: String },
    mobile: { type: String, required: true },
    channel: { type: String, enum: ["whatsapp"], default: "whatsapp" },
    status: { type: String, enum: ["opted_in", "opted_out"], required: true },
    source: { type: String, required: true },
    optOutReason: { type: String },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
    timestamp: { type: Date, default: () => new Date() },
  },
  { ...baseSchemaOptions(["createdAt", "updatedAt"]), collection: "consents" }
);

consentSchema.index({ organizationId: 1, timestamp: -1 });
consentSchema.index({ organizationId: 1, guestId: 1, timestamp: -1 });
consentSchema.plugin(tenantGuardPlugin);

export const Consent = model("Consent", consentSchema);
