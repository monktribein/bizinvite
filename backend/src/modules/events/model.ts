import { HydratedDocument, InferSchemaType, model, Schema } from "mongoose";
import { DEFAULT_REMINDER_MAX_ATTEMPTS, DEFAULT_TIMEZONE, EVENT_CATEGORIES, EVENT_STATUSES } from "../../common/constants/enums";
import { baseSchemaOptions, tenantGuardPlugin } from "../../common/utils/model";

const venueSnapshotSchema = new Schema(
  {
    name: { type: String, required: true },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    googleMapsUrl: { type: String },
    gateNotes: { type: String },
  },
  { _id: false }
);

const eventSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, enum: EVENT_CATEGORIES, default: "other" },
    status: { type: String, enum: EVENT_STATUSES, default: "draft" },
    description: { type: String, maxlength: 5000 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    rsvpDeadline: { type: Date, required: true },
    timezone: { type: String, default: DEFAULT_TIMEZONE },
    venueId: { type: Schema.Types.ObjectId, ref: "Venue" },
    /** Snapshot of the venue at the time it was set, as the frontend expects it nested. */
    venue: { type: venueSnapshotSchema, required: true },
    hosts: [{ _id: false, name: String, relationship: String, phone: String }],
    contactPersons: [{ _id: false, name: String, role: String, phone: String }],
    languages: { type: [String], default: [] },
    dressCode: { type: String },
    accommodationInfo: { type: String },
    transportInfo: { type: String },
    faqs: [{ _id: false, question: String, answer: String }],
    checkInConfig: {
      allowMultipleEntries: { type: Boolean, default: true },
      requirePassVerification: { type: Boolean, default: true },
      activeGates: { type: [String], default: [] },
    },
    /** Which RSVP details this event collects. Nothing beyond the headcount is forced on every event. */
    rsvpConfig: {
      collectCompanionCount: { type: Boolean, default: true },
      collectSessionSelection: { type: Boolean, default: false },
      collectDietary: { type: Boolean, default: false },
      collectAccommodation: { type: Boolean, default: false },
      collectTransport: { type: Boolean, default: false },
      collectArrivalDetails: { type: Boolean, default: false },
      collectSpecialRequests: { type: Boolean, default: true },
    },
    reminderConfig: {
      enabled: { type: Boolean, default: true },
      defaultMaximumAttempts: { type: Number, default: DEFAULT_REMINDER_MAX_ATTEMPTS, min: 1, max: 10 },
      /** Gap between repeat attempts of the same rule. */
      repeatIntervalMinutes: { type: Number, default: 1440, min: 60 },
    },
    communication: {
      /** Approved template used to deliver digital passes. */
      passTemplateId: { type: Schema.Types.ObjectId, ref: "Template" },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { ...baseSchemaOptions(), collection: "events" }
);

eventSchema.index({ organizationId: 1, status: 1, startDate: -1 });
eventSchema.index({ organizationId: 1, category: 1 });
eventSchema.plugin(tenantGuardPlugin);

export type EventDoc = HydratedDocument<InferSchemaType<typeof eventSchema>>;
export const Event = model("Event", eventSchema);

const venueSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    googleMapsUrl: { type: String },
    gateNotes: { type: String },
  },
  { ...baseSchemaOptions(), collection: "venues" }
);
venueSchema.index({ organizationId: 1, name: 1, city: 1 }, { unique: true });
venueSchema.plugin(tenantGuardPlugin);

export const Venue = model("Venue", venueSchema);
