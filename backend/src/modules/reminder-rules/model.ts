import { HydratedDocument, InferSchemaType, model, Schema } from "mongoose";
import { DEFAULT_REMINDER_MAX_ATTEMPTS } from "../../common/constants/enums";
import { baseSchemaOptions, tenantGuardPlugin } from "../../common/utils/model";

export const REMINDER_TYPES = ["rsvp_deadline", "event_eve", "event_day", "session_specific", "custom"] as const;
export const TRIGGER_TYPES = ["relative_to_deadline", "relative_to_event", "scheduled_time"] as const;
export const RELATIVE_TO = ["rsvp_deadline", "event_start", "session_start"] as const;
export const STOP_CONDITIONS = ["rsvp_received", "opt_out", "max_attempts"] as const;
export const RULE_STATUSES = ["active", "paused", "completed", "draft"] as const;

const reminderRuleSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    reminderType: { type: String, enum: REMINDER_TYPES, default: "rsvp_deadline" },
    triggerType: { type: String, enum: TRIGGER_TYPES, required: true },
    relativeTo: { type: String, enum: RELATIVE_TO, default: "rsvp_deadline" },
    /** Minutes relative to the anchor (negative = before). */
    offsetMinutes: { type: Number, default: 0 },
    /** Absolute first-send time for triggerType=scheduled_time. */
    scheduledAt: { type: Date },
    sessionId: { type: Schema.Types.ObjectId, ref: "EventSession" },
    targetFilters: {
      rsvpStatuses: { type: [String], default: ["no_response", "maybe", "incomplete"] },
      guestCategories: { type: [String], default: undefined },
      onlyVip: { type: Boolean },
    },
    channel: { type: String, enum: ["whatsapp"], default: "whatsapp" },
    templateId: { type: Schema.Types.ObjectId, ref: "Template", required: true },
    templateName: { type: String },
    maximumAttempts: { type: Number, default: DEFAULT_REMINDER_MAX_ATTEMPTS, min: 1, max: 10 },
    /** Gap between attempts of this rule for the same guest. */
    repeatIntervalMinutes: { type: Number, default: 1440, min: 60 },
    quietHours: {
      enabled: { type: Boolean, default: true },
      start: { type: String, default: "21:00" },
      end: { type: String, default: "09:00" },
    },
    requiresApproval: { type: Boolean, default: false },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    /** Stored for future use; only WhatsApp is sent in the MVP. */
    fallbackChannel: { type: String, enum: ["none", "sms"], default: "none" },
    stopConditions: { type: [String], enum: STOP_CONDITIONS, default: ["rsvp_received", "opt_out", "max_attempts"] },
    escalationRule: {
      enabled: { type: Boolean, default: false },
      assignToRMAfterHours: { type: Number, default: 24 },
    },
    status: { type: String, enum: RULE_STATUSES, default: "active" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { ...baseSchemaOptions(), collection: "reminderRules" }
);

reminderRuleSchema.index({ organizationId: 1, eventId: 1, status: 1 });
reminderRuleSchema.index({ status: 1 });
reminderRuleSchema.plugin(tenantGuardPlugin);

export type ReminderRuleDoc = HydratedDocument<InferSchemaType<typeof reminderRuleSchema>>;
export const ReminderRule = model("ReminderRule", reminderRuleSchema);

// Reminder attempts are reminder.send jobs in scheduledJobs: see src/scheduler/model.ts.
