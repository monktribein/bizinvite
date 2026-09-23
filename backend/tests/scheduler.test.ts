import { describe, expect, it } from "vitest";
import { CROSS_TENANT } from "../src/common/utils/model";
import { WebhookEvent } from "../src/modules/webhooks/model";
import { claimNextJob, LOCK_TIMEOUT_MS, releaseJob } from "../src/scheduler/job-lock";
import { retryDelayMs, runDueJobs, runJob } from "../src/scheduler/job-runner";
import { cancelPendingJobs, enqueueJob } from "../src/scheduler/jobs";
import { ScheduledJob } from "../src/scheduler/model";
import { Scheduler } from "../src/scheduler/scheduler";
import { setupTenant, useTestDatabase } from "./helpers";

useTestDatabase();

const findJob = (id: unknown) => ScheduledJob.findOne({ _id: id }).setOptions(CROSS_TENANT);

describe("MongoDB job scheduler", () => {
  it("ignores a second enqueue with the same dedupeKey", async () => {
    const first = await enqueueJob({ type: "whatsapp.process-webhook", payload: { webhookEventId: "x" }, dedupeKey: "webhook:x" });
    const second = await enqueueJob({ type: "whatsapp.process-webhook", payload: { webhookEventId: "x" }, dedupeKey: "webhook:x" });
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(await ScheduledJob.countDocuments({}).setOptions(CROSS_TENANT)).toBe(1);
  });

  it("claims a due job exactly once under concurrent claims, and skips jobs not yet due", async () => {
    await enqueueJob({ type: "whatsapp.process-webhook", payload: { webhookEventId: "a" } });
    await enqueueJob({ type: "whatsapp.process-webhook", payload: { webhookEventId: "later" }, runAt: new Date(Date.now() + 3600000) });

    const claims = await Promise.all(Array.from({ length: 8 }, () => claimNextJob(new Date())));
    const won = claims.filter(Boolean);
    expect(won).toHaveLength(1);
    expect(won[0]).toMatchObject({ status: "running", attempts: 1, payload: { webhookEventId: "a" } });
    expect(won[0]!.lockedBy).toBeTruthy();
  });

  it("retries a failing job with backoff, then marks it failed after maxAttempts", async () => {
    const t = await setupTenant();
    // import.commit without an importId: the processor rejects the payload every time.
    const job = await enqueueJob({ type: "import.commit", organizationId: t.org.id, payload: {}, maxAttempts: 2 });
    const now = new Date();

    expect(await runDueJobs(now)).toBe(1);
    const retrying = await findJob(job!._id);
    expect(retrying).toMatchObject({ status: "pending", attempts: 1, lastError: "Invalid import.commit payload: importId" });
    expect(retrying!.runAt.getTime()).toBe(now.getTime() + retryDelayMs(1));
    expect(retrying!.lockedBy).toBeUndefined();

    expect(await runDueJobs(now)).toBe(0); // not due until the backoff passes
    await runDueJobs(new Date(now.getTime() + retryDelayMs(1)));
    const dead = await findJob(job!._id);
    expect(dead).toMatchObject({ status: "failed", attempts: 2 });
    expect(dead!.expiresAt).toBeDefined();
  });

  it("reclaims a job whose lock went stale, and gives up on runs that keep dying", async () => {
    const stale = new Date(Date.now() - LOCK_TIMEOUT_MS - 1000);
    const job = await enqueueJob({ type: "whatsapp.process-webhook", payload: { webhookEventId: "000000000000000000000000" }, maxAttempts: 2 });
    await ScheduledJob.updateOne({ _id: job!._id }, { $set: { status: "running", lockedAt: stale, lockedBy: "dead-process", attempts: 1 } }).setOptions(CROSS_TENANT);

    // A fresh lock is left alone...
    await ScheduledJob.updateOne({ _id: job!._id }, { $set: { lockedAt: new Date() } }).setOptions(CROSS_TENANT);
    expect(await claimNextJob(new Date())).toBeNull();
    // ...a stale one is taken over.
    await ScheduledJob.updateOne({ _id: job!._id }, { $set: { lockedAt: stale } }).setOptions(CROSS_TENANT);
    expect(await runDueJobs()).toBe(1);
    expect(await findJob(job!._id)).toMatchObject({ status: "completed", attempts: 2 });

    const dying = await enqueueJob({ type: "whatsapp.process-webhook", payload: { webhookEventId: "y" }, maxAttempts: 2 });
    await ScheduledJob.updateOne({ _id: dying!._id }, { $set: { status: "running", lockedAt: stale, lockedBy: "dead-process", attempts: 2 } }).setOptions(CROSS_TENANT);
    await runDueJobs();
    expect(await findJob(dying!._id)).toMatchObject({ status: "failed", lastError: "Exceeded maxAttempts (runs were interrupted)" });
  });

  it("does not overwrite a job whose lock was taken by another process", async () => {
    await enqueueJob({ type: "whatsapp.process-webhook", payload: { webhookEventId: "000000000000000000000001" } });
    const claimed = await claimNextJob(new Date());
    await ScheduledJob.updateOne({ _id: claimed!._id }, { $set: { lockedBy: "other-process" } }).setOptions(CROSS_TENANT);
    expect(await releaseJob(claimed!, { $set: { status: "completed" } })).toBe(false);
    expect(await runJob(claimed!)).toBe("completed");
    expect(await findJob(claimed!._id)).toMatchObject({ status: "running", lockedBy: "other-process" });
  });

  it("cancels only pending jobs", async () => {
    const t = await setupTenant();
    const a = await enqueueJob({ type: "import.commit", organizationId: t.org.id, payload: { importId: "a" } });
    const b = await enqueueJob({ type: "import.commit", organizationId: t.org.id, payload: { importId: "b" } });
    await ScheduledJob.updateOne({ _id: b!._id }, { $set: { status: "running" } }).setOptions(CROSS_TENANT);
    expect(await cancelPendingJobs({ organizationId: t.org.id, type: "import.commit" }, "test")).toBe(1);
    expect(await findJob(a!._id)).toMatchObject({ status: "cancelled", cancelReason: "test" });
    expect(await findJob(b!._id)).toMatchObject({ status: "running" });
  });

  it("the running scheduler picks up new jobs immediately and stops cleanly", async () => {
    const scheduler = new Scheduler({ pollIntervalMs: 60_000, concurrency: 2 });
    await scheduler.start();
    try {
      expect(await ScheduledJob.countDocuments({ type: "reminder.plan" }).setOptions(CROSS_TENANT)).toBe(1);
      const event = await WebhookEvent.create({ kind: "status", dedupeKey: "status:wamid.1:sent", waMessageId: "wamid.1", payload: { id: "wamid.1", status: "sent" } });
      // Enqueueing wakes the scheduler; no need to wait for the (long) poll interval.
      const job = await enqueueJob({ type: "whatsapp.process-webhook", payload: { webhookEventId: event.id }, dedupeKey: `webhook:${event.id}` });
      const deadline = Date.now() + 5000;
      while ((await findJob(job!._id))!.status !== "completed" && Date.now() < deadline) await new Promise((r) => setTimeout(r, 25));
      expect(await findJob(job!._id)).toMatchObject({ status: "completed", result: { outcome: "unknown_message" } });
      expect(scheduler.status().state).toBe("running");
    } finally {
      await scheduler.stop();
    }
    expect(scheduler.status()).toMatchObject({ state: "stopped", activeJobs: 0 });
  });
});
