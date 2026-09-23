import { logger } from "../common/utils/logger";
import { CROSS_TENANT, isDuplicateKeyError } from "../common/utils/model";
import { claimNextJob, WORKER_ID } from "./job-lock";
import { runJob } from "./job-runner";
import { setWakeListener } from "./jobs";
import { ScheduledJob } from "./model";

export interface SchedulerOptions {
  /** How often MongoDB is polled for due jobs when nothing wakes the scheduler earlier. */
  pollIntervalMs?: number;
  /** Jobs run in parallel by this process. */
  concurrency?: number;
}

/** Singleton recurring jobs: one document each, rescheduled by its processor after every run. */
const RECURRING_JOBS = [{ type: "reminder.plan" as const, dedupeKey: "system:reminder.plan" }];

/** Creates the recurring jobs if missing, and revives them if they ever stopped. Safe to run from many processes. */
export async function ensureRecurringJobs(now = new Date()): Promise<void> {
  for (const { type, dedupeKey } of RECURRING_JOBS) {
    try {
      await ScheduledJob.updateOne(
        { dedupeKey },
        { $setOnInsert: { type, dedupeKey, status: "pending", runAt: now, payload: {}, maxAttempts: 3 } },
        { upsert: true }
      ).setOptions(CROSS_TENANT);
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
    }
    await ScheduledJob.updateOne(
      { dedupeKey, status: { $in: ["completed", "failed", "cancelled"] } },
      { $set: { status: "pending", runAt: now, attempts: 0 }, $unset: { expiresAt: 1 } }
    ).setOptions(CROSS_TENANT);
  }
}

/**
 * In-process job scheduler. Polls scheduledJobs, claims due jobs atomically and runs
 * up to `concurrency` of them at once. Several processes can run it against the same
 * database; the atomic claim keeps each job in exactly one of them.
 */
export class Scheduler {
  private readonly pollIntervalMs: number;
  private readonly concurrency: number;
  private readonly active = new Set<Promise<unknown>>();
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private filling = false;
  private wakeRequested = false;
  private lastPollAt: Date | null = null;

  constructor(options: SchedulerOptions = {}) {
    this.pollIntervalMs = options.pollIntervalMs ?? 2000;
    this.concurrency = options.concurrency ?? 4;
  }

  async start(): Promise<void> {
    if (this.running) return;
    await ensureRecurringJobs();
    this.running = true;
    setWakeListener(() => this.wake());
    this.timer = setInterval(() => this.wake(), this.pollIntervalMs);
    this.wake();
    logger.info({ workerId: WORKER_ID, concurrency: this.concurrency, pollIntervalMs: this.pollIntervalMs }, "Job scheduler started");
  }

  /** Looks for due jobs now instead of at the next poll. */
  wake(): void {
    if (!this.running) return;
    if (this.filling) {
      this.wakeRequested = true;
      return;
    }
    void this.fill();
  }

  private async fill(): Promise<void> {
    this.filling = true;
    try {
      do {
        this.wakeRequested = false;
        while (this.running && this.active.size < this.concurrency) {
          const job = await claimNextJob(new Date());
          this.lastPollAt = new Date();
          if (!job) break;
          const run: Promise<unknown> = runJob(job)
            .catch((err: Error) => logger.error({ err: err.message, jobId: job.id }, "Job runner error"))
            .finally(() => {
              this.active.delete(run);
              this.wake();
            });
          this.active.add(run);
        }
      } while (this.running && this.wakeRequested && this.active.size < this.concurrency);
    } catch (err) {
      // Usually MongoDB being unreachable: try again at the next poll.
      logger.warn({ err: (err as Error).message }, "Scheduler could not poll for jobs");
    } finally {
      this.filling = false;
    }
  }

  /** Stops claiming new jobs and waits (up to timeoutMs) for running ones to finish. */
  async stop(timeoutMs = 10_000): Promise<void> {
    if (!this.running) return;
    this.running = false;
    setWakeListener(null);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    let timeout: NodeJS.Timeout | undefined;
    await Promise.race([
      Promise.allSettled([...this.active]),
      new Promise((resolve) => {
        timeout = setTimeout(resolve, timeoutMs);
      }),
    ]);
    clearTimeout(timeout);
    // A job still running now keeps its lock and is reclaimed by another process once the lock goes stale.
    if (this.active.size) logger.warn({ running: this.active.size }, "Scheduler stopped with jobs still running");
    logger.info("Job scheduler stopped");
  }

  status() {
    return {
      state: this.running ? ("running" as const) : ("stopped" as const),
      activeJobs: this.active.size,
      lastPollAt: this.lastPollAt?.toISOString() ?? null,
    };
  }
}

let instance: Scheduler | null = null;

export async function startScheduler(options?: SchedulerOptions): Promise<Scheduler> {
  if (!instance) instance = new Scheduler(options);
  await instance.start();
  return instance;
}

export async function stopScheduler(): Promise<void> {
  await instance?.stop();
}

/** For health checks: "disabled" when this process does not run the scheduler. */
export function schedulerStatus() {
  return instance ? instance.status() : { state: "disabled" as const, activeJobs: 0, lastPollAt: null };
}
