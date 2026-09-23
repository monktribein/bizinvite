import { randomUUID } from "crypto";
import type { Types } from "mongoose";
import { isDuplicateKeyError } from "../common/utils/model";
import { JobType, ScheduledJob, ScheduledJobDoc } from "./model";

/**
 * What a processor tells the runner to do with its job. Throwing instead means
 * "transient failure": the runner retries with backoff until maxAttempts.
 */
export type JobResult =
  | { outcome: "completed"; result?: unknown; fields?: Record<string, unknown> }
  /** Run again at runAt without counting a failure (next batch, quiet hours, recurring job). */
  | { outcome: "rescheduled"; runAt: Date; result?: unknown }
  /** Deliberately not executed (stop condition, stale campaign generation, ...). */
  | { outcome: "cancelled"; reason: string }
  /** Permanent failure: no retry. */
  | { outcome: "failed"; error: string; fields?: Record<string, unknown> };

export const completed = (result?: unknown, fields?: Record<string, unknown>): JobResult => ({ outcome: "completed", result, fields });
export const rescheduled = (runAt: Date, result?: unknown): JobResult => ({ outcome: "rescheduled", runAt, result });
export const cancelled = (reason: string): JobResult => ({ outcome: "cancelled", reason });
export const failed = (error: string, fields?: Record<string, unknown>): JobResult => ({ outcome: "failed", error, fields });

export interface JobContext {
  /** Current time (injectable so tests can run jobs "at" a given moment). */
  now: Date;
}

export type Processor = (job: ScheduledJobDoc, ctx: JobContext) => Promise<JobResult | void>;

export interface EnqueueInput {
  type: JobType;
  organizationId?: string | Types.ObjectId;
  payload?: Record<string, unknown>;
  /** Defaults to now. */
  runAt?: Date;
  /** A second enqueue with the same key is ignored. */
  dedupeKey?: string;
  maxAttempts?: number;
  /** Extra top-level fields (reminder references). */
  fields?: Record<string, unknown>;
}

let wakeListener: (() => void) | null = null;

/** The in-process scheduler registers here so new due jobs start without waiting for the next poll. */
export function setWakeListener(listener: (() => void) | null): void {
  wakeListener = listener;
}

/** Stores a job in scheduledJobs. Returns null when a job with the same dedupeKey already exists. */
export async function enqueueJob(input: EnqueueInput): Promise<ScheduledJobDoc | null> {
  const runAt = input.runAt ?? new Date();
  try {
    const job = await ScheduledJob.create({
      ...input.fields,
      type: input.type,
      organizationId: input.organizationId,
      payload: input.payload ?? {},
      runAt,
      dedupeKey: input.dedupeKey ?? `${input.type}:${randomUUID()}`,
      maxAttempts: input.maxAttempts ?? 3,
    });
    if (runAt.getTime() <= Date.now()) wakeListener?.();
    return job;
  } catch (err) {
    if (input.dedupeKey && isDuplicateKeyError(err)) return null;
    throw err;
  }
}

/**
 * Cancels matching jobs that have not started. Running jobs are not interrupted;
 * processors re-check their stop conditions when they start.
 */
export async function cancelPendingJobs(filter: Record<string, unknown> & { organizationId: unknown }, reason: string): Promise<number> {
  const res = await ScheduledJob.updateMany(
    { ...filter, status: "pending" },
    { $set: { status: "cancelled", cancelReason: reason, completedAt: new Date() } }
  );
  return res.modifiedCount;
}
