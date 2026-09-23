import { HydratedDocument, InferSchemaType, model, Schema } from "mongoose";
import { baseSchemaOptions, tenantGuardPlugin } from "../common/utils/model";

export const JOB_TYPES = [
  /** Builds a campaign's recipients, then sends them in batches (reschedules itself until done). */
  "campaign.dispatch",
  /** Recurring system job: finds guests due a reminder and creates reminder.send jobs. */
  "reminder.plan",
  /** One reminder attempt for one guest. */
  "reminder.send",
  /** Delivers a digital pass over WhatsApp. */
  "whatsapp.send-pass",
  /** Applies one stored inbound WhatsApp webhook event. */
  "whatsapp.process-webhook",
  /** Commits a previewed CSV import that is too large for the HTTP request. */
  "import.commit",
  /** Builds a report file and uploads it to object storage. */
  "report.export",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ["pending", "running", "completed", "failed", "cancelled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Reminder attempts that count towards a rule's maximumAttempts (everything but cancelled). */
export const COUNTED_ATTEMPT_STATUSES: JobStatus[] = ["pending", "running", "completed", "failed"];

/**
 * MongoDB-backed job queue. The scheduler claims due jobs with an atomic
 * findOneAndUpdate on (status, runAt, lockedAt), so one job runs in one process at a time.
 *
 * reminder.send jobs also carry top-level reference fields (ruleId, eventGuestId,
 * attempt, ...) so the reminder engine can count attempts per guest with indexes.
 */
const scheduledJobSchema = new Schema(
  {
    /** Absent for system jobs (reminder planner, webhook processing). */
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    type: { type: String, enum: JOB_TYPES, required: true },
    status: { type: String, enum: JOB_STATUSES, default: "pending" },
    runAt: { type: Date, required: true },
    /** Executions started so far (incremented on every claim). */
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3, min: 1 },
    lockedAt: { type: Date },
    lockedBy: { type: String },
    payload: { type: Schema.Types.Mixed, default: {} },
    result: { type: Schema.Types.Mixed },
    lastError: { type: String },
    /** Unique per logical job; a second enqueue with the same key is a no-op. */
    dedupeKey: { type: String, required: true },
    completedAt: { type: Date },
    cancelReason: { type: String },
    /** Times the job was rescheduled without failing (quiet hours, next campaign batch, next planner run). */
    deferrals: { type: Number, default: 0 },
    /** Finished jobs are deleted by a TTL index after this time. Unset for reminder history. */
    expiresAt: { type: Date },

    // reminder.send references
    eventId: { type: Schema.Types.ObjectId, ref: "Event" },
    ruleId: { type: Schema.Types.ObjectId, ref: "ReminderRule" },
    eventGuestId: { type: Schema.Types.ObjectId, ref: "EventGuest" },
    guestId: { type: Schema.Types.ObjectId, ref: "Guest" },
    /** Reminder number for this rule and guest (1..maximumAttempts); not the execution count. */
    attempt: { type: Number, min: 1 },
    messageId: { type: Schema.Types.ObjectId, ref: "Message" },
    executedAt: { type: Date },
  },
  { ...baseSchemaOptions(), collection: "scheduledJobs" }
);

// Claiming: due pending jobs, and running jobs whose lock went stale.
scheduledJobSchema.index({ status: 1, runAt: 1 });
scheduledJobSchema.index({ status: 1, lockedAt: 1 });
scheduledJobSchema.index({ dedupeKey: 1 }, { unique: true });
scheduledJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Reminder engine and reports.
scheduledJobSchema.index({ organizationId: 1, eventGuestId: 1, status: 1 });
scheduledJobSchema.index({ organizationId: 1, ruleId: 1, eventGuestId: 1 });
scheduledJobSchema.index({ organizationId: 1, eventId: 1, type: 1, status: 1 });
scheduledJobSchema.plugin(tenantGuardPlugin);

export type ScheduledJobDoc = HydratedDocument<InferSchemaType<typeof scheduledJobSchema>>;
export const ScheduledJob = model("ScheduledJob", scheduledJobSchema);
