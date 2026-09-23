import { logger } from "../common/utils/logger";
import { claimNextJob, releaseJob } from "./job-lock";
import { completed, JobResult, Processor } from "./jobs";
import type { JobType, ScheduledJobDoc } from "./model";
import { PROCESSORS } from "./processors";

const RETRY_BASE_MS = 15_000;
const RETRY_MAX_MS = 30 * 60 * 1000;
/** Finished jobs are kept this long for status lookups and debugging, then removed by a TTL index. */
const FINISHED_RETENTION_MS = 7 * 24 * 3600 * 1000;
/** Reminder attempts are the reminder engine's history (attempt counting, reports): never expired. */
const KEEP_FOREVER: JobType[] = ["reminder.send"];

/** Exponential backoff: 15s, 30s, 60s, ... capped at 30 minutes. */
export function retryDelayMs(attempts: number): number {
  return Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1), RETRY_MAX_MS);
}

function expiry(job: ScheduledJobDoc, now: Date) {
  return KEEP_FOREVER.includes(job.type) ? {} : { expiresAt: new Date(now.getTime() + FINISHED_RETENTION_MS) };
}

/** Runs one claimed job and records the outcome. Never throws. */
export async function runJob(job: ScheduledJobDoc, now = new Date()): Promise<JobResult["outcome"] | "retry"> {
  const log = logger.child({ jobId: job.id, type: job.type, attempt: job.attempts });
  // A stored document may carry a type this build no longer knows.
  const processor = (PROCESSORS as Partial<Record<string, Processor>>)[job.type];

  if (!processor || job.attempts > job.maxAttempts) {
    // Unknown type, or a run that kept dying mid-way (the stale lock was reclaimed until attempts ran out).
    const error = processor ? "Exceeded maxAttempts (runs were interrupted)" : `No processor for job type ${job.type}`;
    await releaseJob(job, { $set: { status: "failed", lastError: error, completedAt: now, ...expiry(job, now) } });
    log.error({ error }, "Job failed");
    return "failed";
  }

  let result: JobResult;
  try {
    result = (await processor(job, { now })) ?? completed();
  } catch (err) {
    const error = ((err as Error)?.message ?? String(err)).slice(0, 500);
    if (job.attempts >= job.maxAttempts) {
      await releaseJob(job, { $set: { status: "failed", lastError: error, completedAt: new Date(), ...expiry(job, now) } });
      log.error({ err: error }, "Job failed after final attempt");
      return "failed";
    }
    const runAt = new Date(now.getTime() + retryDelayMs(job.attempts));
    await releaseJob(job, { $set: { status: "pending", runAt, lastError: error } });
    log.warn({ err: error, retryAt: runAt.toISOString() }, "Job failed; will retry");
    return "retry";
  }

  const finishedAt = new Date();
  let kept: boolean;
  switch (result.outcome) {
    case "completed":
      kept = await releaseJob(job, { $set: { ...result.fields, status: "completed", result: result.result, completedAt: finishedAt, ...expiry(job, now) } });
      break;
    case "rescheduled":
      kept = await releaseJob(job, { $set: { status: "pending", runAt: result.runAt, attempts: 0, result: result.result }, $inc: { deferrals: 1 } });
      break;
    case "cancelled":
      kept = await releaseJob(job, { $set: { status: "cancelled", cancelReason: result.reason, completedAt: finishedAt, ...expiry(job, now) } });
      break;
    case "failed":
      kept = await releaseJob(job, { $set: { ...result.fields, status: "failed", lastError: result.error.slice(0, 500), completedAt: finishedAt, ...expiry(job, now) } });
      break;
  }
  if (!kept) log.warn("Job lock was lost before its result could be saved");
  else if (result.outcome === "failed") log.warn({ error: result.error }, "Job failed permanently");
  else log.debug({ outcome: result.outcome }, "Job finished");
  return result.outcome;
}

/**
 * Claims and runs due jobs one at a time until none are due. Used by tests and
 * scripts; the long-running scheduler uses claimNextJob/runJob with concurrency.
 */
export async function runDueJobs(now = new Date(), limit = 1000): Promise<number> {
  let ran = 0;
  while (ran < limit) {
    const job = await claimNextJob(now);
    if (!job) break;
    await runJob(job, now);
    ran++;
  }
  return ran;
}
