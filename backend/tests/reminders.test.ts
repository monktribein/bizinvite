import { describe, expect, it } from "vitest";
import { isWithinQuietHours, nextLocalTime } from "../src/common/utils/time";
import { Message } from "../src/modules/conversations/model";
import { EventGuest } from "../src/modules/guests/model";
import { ReminderRule } from "../src/modules/reminder-rules/model";
import { planDueReminders } from "../src/modules/reminder-rules/service";
import { computeFirstRunAt, evaluateStopConditions, nextDueAttempt, StopContext } from "../src/modules/reminder-rules/stop-conditions";
import { runDueJobs } from "../src/scheduler/job-runner";
import { ScheduledJob } from "../src/scheduler/model";
import { ensureRecurringJobs } from "../src/scheduler/scheduler";
import { createApprovedTemplate, createEvent, createGuest, jobsOfType, setupTenant, Tenant, useTestDatabase } from "./helpers";

useTestDatabase();

const now = new Date("2026-10-01T06:30:00Z"); // 12:00 IST, outside quiet hours

const baseCtx: StopContext = {
  eventStatus: "upcoming",
  eventEnd: new Date("2026-10-30T00:00:00Z"),
  ruleStatus: "active",
  ruleTargetStatuses: ["no_response", "maybe", "incomplete"],
  ruleStopConditions: ["rsvp_received", "opt_out", "max_attempts"],
  maximumAttempts: 3,
  attempt: 1,
  rsvpStatus: "no_response",
  contact: { optedOut: false, communicationSuppressed: false, mobileValid: true },
  now,
};

describe("reminder stop conditions", () => {
  it("allows a reminder when nothing stops it", () => {
    expect(evaluateStopConditions(baseCtx)).toBeNull();
  });

  it.each([
    [{ rsvpStatus: "attending" }, "rsvp_received"],
    [{ rsvpStatus: "declined" }, "rsvp_received"],
    [{ contact: { optedOut: true } }, "opt_out"],
    [{ contact: { communicationSuppressed: true } }, "organizer_suppressed"],
    [{ contact: { mobileValid: false } }, "invalid_mobile"],
    [{ eventStatus: "cancelled" }, "event_cancelled"],
    [{ previousPermanentFailure: true }, "whatsapp_permanent_failure"],
    [{ attempt: 4 }, "max_attempts"],
    [{ ruleStatus: "paused" }, "rule_inactive"],
    [{ rsvpStatus: "cancelled" }, "invitation_cancelled"],
  ] as const)("stops for %o", (override, reason) => {
    expect(evaluateStopConditions({ ...baseCtx, ...(override as Partial<StopContext>) })).toBe(reason);
  });

  it("computes the first run relative to the RSVP deadline", () => {
    const deadline = new Date("2026-10-10T18:29:00Z");
    const first = computeFirstRunAt({ triggerType: "relative_to_deadline", offsetMinutes: -2880 }, { rsvpDeadline: deadline, eventStart: deadline });
    expect(first!.toISOString()).toBe("2026-10-08T18:29:00.000Z");
  });

  it("spaces attempts and caps them at the maximum", () => {
    const firstRunAt = new Date("2026-09-30T00:00:00Z");
    const base = { firstRunAt, now, maximumAttempts: 3, repeatIntervalMinutes: 1440 };
    expect(nextDueAttempt({ ...base, attemptsMade: 0 })).toBe(1);
    expect(nextDueAttempt({ ...base, attemptsMade: 1, lastAttemptAt: new Date(now.getTime() - 3600000) })).toBeNull();
    expect(nextDueAttempt({ ...base, attemptsMade: 1, lastAttemptAt: new Date(now.getTime() - 25 * 3600000) })).toBe(2);
    expect(nextDueAttempt({ ...base, attemptsMade: 3, lastAttemptAt: firstRunAt })).toBeNull();
    expect(nextDueAttempt({ ...base, now: new Date("2026-09-29T00:00:00Z"), attemptsMade: 0 })).toBeNull();
  });

  it("handles quiet hours across midnight in the event timezone", () => {
    const tz = "Asia/Kolkata";
    expect(isWithinQuietHours(new Date("2026-10-01T17:00:00Z"), tz, "21:00", "09:00")).toBe(true); // 22:30 IST
    expect(isWithinQuietHours(new Date("2026-10-01T02:00:00Z"), tz, "21:00", "09:00")).toBe(true); // 07:30 IST
    expect(isWithinQuietHours(new Date("2026-10-01T06:30:00Z"), tz, "21:00", "09:00")).toBe(false); // 12:00 IST
    expect(nextLocalTime(new Date("2026-10-01T17:00:00Z"), tz, "09:00").toISOString()).toBe("2026-10-02T03:30:00.000Z");
  });
});

async function setupRule(t: Tenant, overrides: Record<string, unknown> = {}) {
  // RSVP deadline 2 days after `now`, rule fires 48h before it, i.e. at `now`.
  const event = await createEvent(t, {
    startDate: "2026-10-20T10:00:00Z",
    endDate: "2026-10-22T10:00:00Z",
    rsvpDeadline: "2026-10-03T06:30:00Z",
  });
  const tpl = await createApprovedTemplate(t.org.id);
  const res = await t.api.post("/api/v1/reminder-rules", {
    eventId: event.id,
    name: "RSVP Deadline 48H Push",
    reminderType: "rsvp_deadline",
    triggerType: "relative_to_deadline",
    relativeTo: "rsvp_deadline",
    offsetMinutes: -2880,
    channel: "whatsapp",
    templateId: tpl.id,
    quietHours: { enabled: true, start: "21:00", end: "09:00" },
    ...overrides,
  });
  expect(res.status).toBe(201);
  return { event, rule: res.body.data as { id: string; maximumAttempts: number; status: string } };
}

describe("reminder engine", () => {
  const reminderJobs = (organizationId: string, extra: Record<string, unknown> = {}) => ScheduledJob.find({ organizationId, type: "reminder.send", ...extra });

  it("defaults to 3 attempts and requires approval when asked", async () => {
    const t = await setupTenant();
    const { rule } = await setupRule(t);
    expect(rule.maximumAttempts).toBe(3);
    expect(rule.status).toBe("active");
    const { rule: gated } = await setupRule(t, { requiresApproval: true });
    expect(gated.status).toBe("draft");
    const activated = await t.api.post(`/api/v1/reminder-rules/${gated.id}/activate`);
    expect(activated.body.data.status).toBe("active");
  });

  it("plans each due attempt exactly once (idempotent across ticks)", async () => {
    const t = await setupTenant();
    const { event } = await setupRule(t);
    await createGuest(t, event.id);
    await createGuest(t, event.id);
    const responded = await createGuest(t, event.id);
    await t.api.patch(`/api/v1/rsvps/${responded.id}`, { status: "attending", count: 1 });

    expect((await planDueReminders(now)).planned).toBe(2);
    expect((await planDueReminders(now)).planned).toBe(0);
    const jobs = await reminderJobs(t.org.id);
    expect(jobs).toHaveLength(2);
    expect(jobs.every((j) => j.status === "pending" && j.attempt === 1)).toBe(true);
  });

  it("runs the recurring planner job, which reschedules itself every minute", async () => {
    const t = await setupTenant();
    const { event } = await setupRule(t);
    await createGuest(t, event.id);
    await ensureRecurringJobs(now);
    await ensureRecurringJobs(now); // idempotent: still one planner

    await runDueJobs(now);
    const planners = await jobsOfType("reminder.plan");
    expect(planners).toHaveLength(1);
    expect(planners[0]).toMatchObject({ status: "pending", result: { planned: 1 } });
    expect(planners[0].runAt.toISOString()).toBe(new Date(now.getTime() + 60_000).toISOString());
    // The reminder.send job it created was due immediately and ran in the same pass.
    expect((await reminderJobs(t.org.id))[0].status).toBe("completed");
    expect(await Message.countDocuments({ organizationId: t.org.id, purpose: "reminder" })).toBe(1);
  });

  it("sends via the scheduler and stops once the guest responds", async () => {
    const t = await setupTenant();
    const { event } = await setupRule(t);
    const guest = await createGuest(t, event.id);
    await planDueReminders(now);
    await runDueJobs(now);

    const [first] = await reminderJobs(t.org.id);
    expect(first).toMatchObject({ status: "completed", attempt: 1 });
    expect(first.messageId).toBeDefined();
    expect((await EventGuest.findOne({ _id: guest.id, organizationId: t.org.id }))!.reminderStatus).toBe("sent");

    // Attempt 2 is due a day later, but the guest responds before it runs.
    const later = new Date(now.getTime() + 25 * 3600000);
    expect((await planDueReminders(later)).planned).toBe(1);
    await t.api.patch(`/api/v1/rsvps/${guest.id}`, { status: "declined" });
    expect(await reminderJobs(t.org.id, { attempt: 2 })).toMatchObject([{ status: "cancelled", cancelReason: "rsvp_received" }]);
    expect(await runDueJobs(later)).toBe(0);
    expect(await Message.countDocuments({ organizationId: t.org.id, purpose: "reminder" })).toBe(1);
  });

  it("re-checks stop conditions when the job runs", async () => {
    const t = await setupTenant();
    const { event } = await setupRule(t);
    const guest = await createGuest(t, event.id);
    await planDueReminders(now);
    // RSVP recorded without going through the cancellation hook.
    await EventGuest.updateOne({ _id: guest.id, organizationId: t.org.id }, { $set: { rsvpStatus: "attending" } });

    await runDueJobs(now);
    expect(await reminderJobs(t.org.id)).toMatchObject([{ status: "cancelled", cancelReason: "rsvp_received" }]);
    expect(await Message.countDocuments({ organizationId: t.org.id, purpose: "reminder" })).toBe(0);
  });

  it("never exceeds the maximum attempts", async () => {
    const t = await setupTenant();
    const { event } = await setupRule(t, { maximumAttempts: 2, repeatIntervalMinutes: 60 });
    await createGuest(t, event.id);
    for (let i = 0; i < 5; i++) {
      const at = new Date(now.getTime() + i * 2 * 3600000);
      await planDueReminders(at);
      await runDueJobs(at);
    }
    expect(await reminderJobs(t.org.id)).toHaveLength(2);
    expect(await Message.countDocuments({ organizationId: t.org.id, purpose: "reminder" })).toBe(2);
  });

  it("defers during quiet hours and stops on opt-out, suppression and event cancellation", async () => {
    const t = await setupTenant();
    const { event } = await setupRule(t);
    const a = await createGuest(t, event.id);
    const b = await createGuest(t, event.id);
    const c = await createGuest(t, event.id);
    await planDueReminders(now);
    const jobs = await reminderJobs(t.org.id);
    const jobFor = (id: string) => ScheduledJob.findOne({ _id: jobs.find((j) => String(j.eventGuestId) === id)!._id, organizationId: t.org.id });

    const night = new Date("2026-10-01T17:00:00Z"); // 22:30 IST
    await runDueJobs(night);
    const deferred = await jobFor(a.id);
    expect(deferred).toMatchObject({ status: "pending", deferrals: 1, attempts: 0 });
    expect(deferred!.runAt.toISOString()).toBe("2026-10-02T03:30:00.000Z");
    expect(await Message.countDocuments({ organizationId: t.org.id })).toBe(0);

    await t.api.post(`/api/v1/guests/${b.id}/opt-out`);
    await t.api.post(`/api/v1/guests/${c.id}/suppress`, { reason: "Family request" });
    expect(await jobFor(b.id)).toMatchObject({ status: "cancelled", cancelReason: "opt_out" });
    expect(await jobFor(c.id)).toMatchObject({ status: "cancelled", cancelReason: "organizer_suppressed" });

    await t.api.patch(`/api/v1/events/${event.id}`, { status: "cancelled" });
    expect(await jobFor(a.id)).toMatchObject({ status: "cancelled", cancelReason: "event_cancelled" });
    expect((await ReminderRule.findOne({ organizationId: t.org.id }))!.status).toBe("completed");
    expect(await planDueReminders(new Date(now.getTime() + 86400000))).toEqual({ planned: 0 });
    expect(await runDueJobs(new Date("2026-10-02T04:00:00Z"))).toBe(0);
  });
});
