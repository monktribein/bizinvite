import { Errors } from "../../common/errors/app-error";
import { DEFAULT_REMINDER_MAX_ATTEMPTS } from "../../common/constants/enums";
import type { ActorContext } from "../../common/utils/context";
import { systemActor } from "../../common/utils/context";
import { logger } from "../../common/utils/logger";
import { CROSS_TENANT, toObjectId } from "../../common/utils/model";
import { isWithinQuietHours, nextLocalTime } from "../../common/utils/time";
import { cancelled, cancelPendingJobs, completed, enqueueJob, failed, JobResult, rescheduled } from "../../scheduler/jobs";
import { COUNTED_ATTEMPT_STATUSES, ScheduledJob, ScheduledJobDoc } from "../../scheduler/model";
import { recordAudit } from "../audit";
import { PLAN_CATALOGUE } from "../billing/service";
import { sendTemplateToGuest } from "../conversations/messaging.service";
import { Message } from "../conversations/model";
import { INVALID_RECIPIENT_CODES, WhatsAppSendError } from "../conversations/whatsapp.client";
import { Event, EventDoc } from "../events/model";
import { markMobileInvalid } from "../guests/consent.service";
import { EventGuest, Guest } from "../guests/model";
import { Organization } from "../organizations/model";
import { EventSession } from "../sessions/model";
import { buildVariableContext } from "../templates/context";
import { Template } from "../templates/model";
import { assertTemplateSendable, findTemplateOrThrow } from "../templates/service";
import { ReminderRule, ReminderRuleDoc } from "./model";
import type { CreateRuleInput, UpdateRuleInput } from "./schema";
import { computeFirstRunAt, defaultTargetStatuses, evaluateStopConditions, nextDueAttempt, StopReason } from "./stop-conditions";

const PLAN_BATCH = 500;
/** Executions of one reminder attempt on transient WhatsApp errors (distinct from the rule's maximumAttempts). */
const REMINDER_SEND_MAX_TRIES = 3;

// ---------------------------------------------------------------------------
// Rule management (API)
// ---------------------------------------------------------------------------

function audienceQuery(rule: Pick<ReminderRuleDoc, "organizationId" | "eventId" | "targetFilters" | "sessionId" | "reminderType">) {
  const statuses = rule.targetFilters?.rsvpStatuses?.length ? rule.targetFilters.rsvpStatuses : defaultTargetStatuses(rule.reminderType);
  const query: Record<string, unknown> = {
    organizationId: rule.organizationId,
    eventId: rule.eventId,
    rsvpStatus: { $in: statuses.filter((s) => s !== "cancelled") },
  };
  if (rule.targetFilters?.guestCategories?.length) query.category = { $in: rule.targetFilters.guestCategories };
  if (rule.targetFilters?.onlyVip) query.isVip = true;
  if (rule.sessionId) query.invitedSessionIds = rule.sessionId;
  return query;
}

async function ruleDtos(organizationId: string, rules: ReminderRuleDoc[]) {
  const ids = rules.map((r) => r._id);
  const [jobCounts, messageCounts, org] = await Promise.all([
    ScheduledJob.aggregate<{ _id: { r: unknown; s: string }; n: number }>([
      { $match: { organizationId: toObjectId(organizationId), type: "reminder.send", ruleId: { $in: ids } } },
      { $group: { _id: { r: "$ruleId", s: "$status" }, n: { $sum: 1 } } },
    ]),
    Message.aggregate<{ _id: { r: unknown; s: string }; n: number }>([
      { $match: { organizationId: toObjectId(organizationId), reminderRuleId: { $in: ids } } },
      { $group: { _id: { r: "$reminderRuleId", s: "$status" }, n: { $sum: 1 } } },
    ]),
    Organization.findById(organizationId).select("plan"),
  ]);
  const count = (rows: Array<{ _id: { r: unknown; s: string }; n: number }>, ruleId: string, statuses: string[]) =>
    rows.filter((row) => String(row._id.r) === ruleId && statuses.includes(row._id.s)).reduce((a, b) => a + b.n, 0);
  const rate = PLAN_CATALOGUE[(org?.plan ?? "starter") as keyof typeof PLAN_CATALOGUE].estimatedRatePerMessageInr;

  return Promise.all(
    rules.map(async (r) => {
      const audienceCount = await EventGuest.countDocuments(audienceQuery(r));
      const json = r.toJSON() as Record<string, unknown>;
      return {
        ...json,
        organizationId: String(r.organizationId),
        eventId: String(r.eventId),
        templateId: String(r.templateId),
        sessionId: r.sessionId ? String(r.sessionId) : undefined,
        approvedBy: r.approvedBy ? String(r.approvedBy) : undefined,
        createdBy: undefined,
        targetFilters: {
          rsvpStatuses: r.targetFilters?.rsvpStatuses?.length ? r.targetFilters.rsvpStatuses : defaultTargetStatuses(r.reminderType),
          guestCategories: r.targetFilters?.guestCategories ?? undefined,
          onlyVip: r.targetFilters?.onlyVip ?? undefined,
        },
        audienceCount,
        estimatedCost: Math.round(audienceCount * rate * 100) / 100,
        sentCount: count(jobCounts, r.id, ["completed"]),
        deliveredCount: count(messageCounts, r.id, ["delivered", "read"]),
        readCount: count(messageCounts, r.id, ["read"]),
        suppressedCount: count(jobCounts, r.id, ["cancelled"]),
        failedCount: count(jobCounts, r.id, ["failed"]),
      };
    })
  );
}

export async function listRules(organizationId: string, eventId?: string) {
  const rules = await ReminderRule.find({ organizationId, ...(eventId ? { eventId } : {}) }).sort({ createdAt: -1 });
  return ruleDtos(organizationId, rules);
}

async function findRuleOrThrow(organizationId: string, ruleId: string) {
  const rule = await ReminderRule.findOne({ _id: ruleId, organizationId });
  if (!rule) throw Errors.notFound("Reminder rule");
  return rule;
}

async function assertRuleReferences(organizationId: string, eventId: string, input: { templateId?: string; sessionId?: string }) {
  if (input.templateId) assertTemplateSendable(await findTemplateOrThrow(organizationId, input.templateId));
  if (input.sessionId && !(await EventSession.exists({ _id: input.sessionId, organizationId, eventId }))) {
    throw Errors.validation("Session not found for this event", { sessionId: ["Session not found"] });
  }
}

export async function createRule(actor: ActorContext, input: CreateRuleInput) {
  const event = await Event.findOne({ _id: input.eventId, organizationId: actor.organizationId });
  if (!event) throw Errors.notFound("Event");
  if (["cancelled", "completed"].includes(event.status)) throw Errors.conflict(`Cannot add reminders to a ${event.status} event`);
  await assertRuleReferences(actor.organizationId, input.eventId, input);
  const template = await Template.findOne({ _id: input.templateId, organizationId: actor.organizationId });

  const rule = await ReminderRule.create({
    ...input,
    organizationId: actor.organizationId,
    templateName: template?.name,
    relativeTo: input.relativeTo ?? (input.triggerType === "relative_to_event" ? "event_start" : "rsvp_deadline"),
    maximumAttempts: input.maximumAttempts ?? event.reminderConfig?.defaultMaximumAttempts ?? DEFAULT_REMINDER_MAX_ATTEMPTS,
    repeatIntervalMinutes: input.repeatIntervalMinutes ?? event.reminderConfig?.repeatIntervalMinutes ?? 1440,
    targetFilters: {
      rsvpStatuses: input.targetFilters?.rsvpStatuses?.length ? input.targetFilters.rsvpStatuses : defaultTargetStatuses(input.reminderType),
      guestCategories: input.targetFilters?.guestCategories,
      onlyVip: input.targetFilters?.onlyVip,
    },
    // Rules needing approval wait as drafts until activated.
    status: input.requiresApproval ? "draft" : "active",
    createdBy: actor.userId,
  });
  await recordAudit(actor, { action: "reminder.rule_created", resourceType: "reminder", resourceId: rule.id, details: `Created reminder rule "${rule.name}"` });
  return (await ruleDtos(actor.organizationId, [rule]))[0];
}

export async function updateRule(actor: ActorContext, ruleId: string, changes: UpdateRuleInput) {
  const rule = await findRuleOrThrow(actor.organizationId, ruleId);
  await assertRuleReferences(actor.organizationId, String(rule.eventId), changes);
  if (changes.templateId) {
    const template = await Template.findOne({ _id: changes.templateId, organizationId: actor.organizationId });
    rule.templateName = template?.name;
  }
  const { targetFilters, quietHours, escalationRule, ...rest } = changes;
  rule.set(rest);
  if (targetFilters) for (const [k, v] of Object.entries(targetFilters)) rule.set(`targetFilters.${k}`, v);
  if (quietHours) rule.set("quietHours", quietHours);
  if (escalationRule) rule.set("escalationRule", escalationRule);
  // Material changes to an approval-gated rule require re-approval.
  if (rule.requiresApproval && rule.status === "active" && (changes.templateId || changes.offsetMinutes !== undefined || targetFilters)) {
    rule.status = "draft";
  }
  await rule.save();
  if (rule.status !== "active") await cancelOpenJobs({ organizationId: actor.organizationId, ruleId: rule._id }, "rule_inactive");
  await recordAudit(actor, { action: "reminder.rule_updated", resourceType: "reminder", resourceId: rule.id, details: `Updated reminder rule "${rule.name}"`, metadata: { fields: Object.keys(changes) } });
  return (await ruleDtos(actor.organizationId, [rule]))[0];
}

export async function setRuleStatus(actor: ActorContext, ruleId: string, status: "active" | "paused") {
  const rule = await findRuleOrThrow(actor.organizationId, ruleId);
  if (status === "active") {
    assertTemplateSendable(await findTemplateOrThrow(actor.organizationId, String(rule.templateId)));
    if (rule.requiresApproval) {
      rule.approvedBy = actor.userId as never;
      rule.approvedAt = new Date();
    }
  }
  rule.status = status;
  await rule.save();
  if (status === "paused") await cancelOpenJobs({ organizationId: actor.organizationId, ruleId: rule._id }, "rule_paused");
  await recordAudit(actor, {
    action: status === "active" ? "reminder.rule_activated" : "reminder.rule_paused",
    resourceType: "reminder",
    resourceId: rule.id,
    details: `${status === "active" ? "Activated" : "Paused"} reminder rule "${rule.name}"`,
  });
  return (await ruleDtos(actor.organizationId, [rule]))[0];
}

// ---------------------------------------------------------------------------
// Stop hooks (called from RSVP, opt-out, suppression, event cancellation)
// ---------------------------------------------------------------------------

/**
 * Cancels reminder attempts that have not started. An attempt already running
 * re-checks the stop conditions itself before sending.
 */
async function cancelOpenJobs(filter: Record<string, unknown> & { organizationId: unknown }, reason: string) {
  return cancelPendingJobs({ ...filter, type: "reminder.send" }, reason);
}

export async function cancelPendingRemindersForGuests(organizationId: string, eventGuestIds: string[], reason: string) {
  if (eventGuestIds.length === 0) return 0;
  return cancelOpenJobs({ organizationId, eventGuestId: { $in: eventGuestIds } }, reason);
}

export async function cancelPendingRemindersForEvent(organizationId: string, eventId: string, reason: string) {
  await ReminderRule.updateMany({ organizationId, eventId, status: { $in: ["active", "draft"] } }, { $set: { status: "completed" } });
  return cancelOpenJobs({ organizationId, eventId }, reason);
}

// ---------------------------------------------------------------------------
// Planner (reminder.plan job, every minute)
// ---------------------------------------------------------------------------

async function anchorsFor(rule: ReminderRuleDoc, event: EventDoc) {
  const session = rule.sessionId ? await EventSession.findOne({ _id: rule.sessionId, organizationId: rule.organizationId }).select("startTime") : null;
  return { rsvpDeadline: event.rsvpDeadline, eventStart: event.startDate, sessionStart: session?.startTime ?? null };
}

/**
 * Finds every guest for whom a reminder attempt is due and stores it as a
 * reminder.send job. Idempotent: the unique dedupeKey (rule:guest:attempt) stops a
 * second planner run, or another process, from creating the same attempt.
 */
export async function planDueReminders(now = new Date()) {
  const rules = await ReminderRule.find({ status: "active" }).setOptions(CROSS_TENANT);
  let planned = 0;

  for (const rule of rules) {
    const organizationId = String(rule.organizationId);
    const event = await Event.findOne({ _id: rule.eventId, organizationId });
    if (!event || ["cancelled", "completed"].includes(event.status) || event.endDate < now || event.reminderConfig?.enabled === false) continue;
    const firstRunAt = computeFirstRunAt(rule, await anchorsFor(rule, event));
    if (!firstRunAt || now < firstRunAt) continue;

    let lastId: unknown = null;
    for (;;) {
      const batch = await EventGuest.find({ ...audienceQuery(rule), ...(lastId ? { _id: { $gt: lastId } } : {}) })
        .sort({ _id: 1 })
        .limit(PLAN_BATCH)
        .select("_id guestId");
      if (batch.length === 0) break;
      lastId = batch[batch.length - 1]._id;

      const history = await ScheduledJob.aggregate<{ _id: unknown; attempts: number; lastAt: Date | null }>([
        {
          $match: {
            organizationId: rule.organizationId,
            type: "reminder.send",
            ruleId: rule._id,
            eventGuestId: { $in: batch.map((b) => b._id) },
            status: { $in: COUNTED_ATTEMPT_STATUSES },
          },
        },
        { $group: { _id: "$eventGuestId", attempts: { $sum: 1 }, lastAt: { $max: { $ifNull: ["$executedAt", "$runAt"] } } } },
      ]);
      const byGuest = new Map(history.map((h) => [String(h._id), h]));

      for (const eg of batch) {
        const h = byGuest.get(String(eg._id));
        const attempt = nextDueAttempt({
          firstRunAt,
          now,
          attemptsMade: h?.attempts ?? 0,
          maximumAttempts: rule.maximumAttempts,
          repeatIntervalMinutes: rule.repeatIntervalMinutes,
          lastAttemptAt: h?.lastAt,
        });
        if (!attempt) continue;
        const job = await enqueueJob({
          type: "reminder.send",
          organizationId,
          runAt: now,
          dedupeKey: `reminder:${rule.id}:${String(eg._id)}:${attempt}`,
          maxAttempts: REMINDER_SEND_MAX_TRIES,
          fields: { eventId: rule.eventId, ruleId: rule._id, eventGuestId: eg._id, guestId: eg.guestId, attempt },
        });
        if (!job) continue;
        await EventGuest.updateOne({ _id: eg._id, organizationId, reminderStatus: { $in: ["none", "sent"] } }, { $set: { reminderStatus: "scheduled" } });
        planned++;
      }
    }
  }
  return { planned };
}

// ---------------------------------------------------------------------------
// Sender (reminder.send jobs)
// ---------------------------------------------------------------------------

async function loadJobContext(organizationId: string, job: ScheduledJobDoc) {
  const [rule, event, invitation, contact] = await Promise.all([
    ReminderRule.findOne({ _id: job.ruleId, organizationId }),
    Event.findOne({ _id: job.eventId, organizationId }),
    EventGuest.findOne({ _id: job.eventGuestId, organizationId }),
    Guest.findOne({ _id: job.guestId, organizationId }),
  ]);
  return { rule, event, invitation, contact };
}

async function stopReasonFor(organizationId: string, job: ScheduledJobDoc, now: Date): Promise<StopReason | null> {
  const { rule, event, invitation, contact } = await loadJobContext(organizationId, job);
  if (!rule || !event || !invitation) return "invitation_cancelled";
  const permanentFailure = await ScheduledJob.exists({
    organizationId,
    type: "reminder.send",
    ruleId: job.ruleId,
    eventGuestId: job.eventGuestId,
    status: "failed",
    _id: { $ne: job._id },
  });
  return evaluateStopConditions({
    eventStatus: event.status,
    eventEnd: event.endDate,
    ruleStatus: rule.status,
    ruleTargetStatuses: rule.targetFilters?.rsvpStatuses?.length ? rule.targetFilters.rsvpStatuses : defaultTargetStatuses(rule.reminderType),
    ruleStopConditions: rule.stopConditions ?? [],
    maximumAttempts: rule.maximumAttempts,
    attempt: job.attempt ?? 1,
    rsvpStatus: invitation.rsvpStatus,
    contact,
    previousPermanentFailure: Boolean(permanentFailure),
    now,
  });
}

/** Records on the invitation why reminders stopped (the job itself is cancelled by the scheduler). */
async function markStopped(organizationId: string, job: ScheduledJobDoc, reason: StopReason) {
  const reminderStatus = reason === "opt_out" ? "opted_out" : reason === "invalid_mobile" || reason === "whatsapp_permanent_failure" ? "failed" : "suppressed";
  await EventGuest.updateOne({ _id: job.eventGuestId, organizationId, reminderStatus: { $ne: "opted_out" } }, { $set: { reminderStatus } });
}

/**
 * reminder.send job: re-checks every stop condition, defers during quiet hours, then
 * sends the WhatsApp template once. Throwing (transient WhatsApp error) makes the
 * scheduler retry with backoff.
 */
export async function processReminderSend(job: ScheduledJobDoc, now = new Date()): Promise<JobResult> {
  if (!job.organizationId || !job.eventGuestId) return failed("Invalid reminder job");
  const organizationId = String(job.organizationId);

  // A run interrupted after the message went out must not send it again.
  if (job.attempts > 1) {
    const already = await Message.findOne({ organizationId, scheduledJobId: job._id }).select("_id createdAt");
    if (already) return completed({ sent: true, recovered: true }, { executedAt: already.createdAt, messageId: already._id });
  }

  const reason = await stopReasonFor(organizationId, job, now);
  if (reason) {
    await markStopped(organizationId, job, reason);
    return cancelled(reason);
  }

  const { rule, event, invitation, contact } = await loadJobContext(organizationId, job);
  const tz = event!.timezone ?? "Asia/Kolkata";
  if (rule!.quietHours?.enabled && isWithinQuietHours(now, tz, rule!.quietHours.start ?? "21:00", rule!.quietHours.end ?? "09:00")) {
    const resumeAt = nextLocalTime(now, tz, rule!.quietHours.end ?? "09:00");
    return rescheduled(resumeAt, { deferredUntil: resumeAt.toISOString() });
  }

  const template = await Template.findOne({ _id: rule!.templateId, organizationId });
  if (!template || template.approvalStatus !== "APPROVED") return failed("Template is not approved");

  const org = await Organization.findById(organizationId).select("name");

  try {
    const message = await sendTemplateToGuest({
      organizationId,
      mobile: contact!.mobile,
      guestName: contact!.name,
      guestId: contact!._id,
      eventGuestId: invitation!._id,
      eventId: event!._id,
      template,
      context: buildVariableContext({ event: event!, invitation, organizationName: org?.name }),
      purpose: "reminder",
      reminderRuleId: rule!._id,
      scheduledJobId: job._id,
    });
    await EventGuest.updateOne({ _id: invitation!._id, organizationId }, { $set: { reminderStatus: "sent", lastReminderAt: new Date() } });

    if ((job.attempt ?? 1) >= rule!.maximumAttempts) {
      await recordAudit(systemActor(organizationId, "reminder-scheduler"), {
        action: rule!.escalationRule?.enabled ? "reminder.escalation_required" : "reminder.max_attempts_reached",
        resourceType: "reminder",
        resourceId: invitation!.id,
        details: `Final reminder (${job.attempt}/${rule!.maximumAttempts}) sent to ${invitation!.name} for rule "${rule!.name}"`,
        metadata: {
          ruleId: rule!.id,
          escalation: rule!.escalationRule?.enabled ? { assignToRMAfterHours: rule!.escalationRule.assignToRMAfterHours } : undefined,
        },
      });
    }
    return completed({ sent: true }, { executedAt: now, messageId: message._id });
  } catch (err) {
    const permanent = err instanceof WhatsAppSendError && err.permanent;
    if (!permanent && job.attempts < job.maxAttempts) {
      logger.warn({ err: (err as Error).message, scheduledJobId: job.id }, "Reminder send failed; will retry");
      throw err;
    }
    await EventGuest.updateOne({ _id: invitation!._id, organizationId }, { $set: { reminderStatus: "failed" } });
    if (err instanceof WhatsAppSendError && err.permanent && err.code !== undefined && INVALID_RECIPIENT_CODES.has(err.code)) {
      await markMobileInvalid(systemActor(organizationId, "reminder-scheduler"), contact!, `WhatsApp error ${err.code}`);
    }
    return failed((err as Error).message, { executedAt: now });
  }
}
