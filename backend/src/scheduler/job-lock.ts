import { randomUUID } from "crypto";
import { hostname } from "os";
import { CROSS_TENANT } from "../common/utils/model";
import { ScheduledJob, ScheduledJobDoc } from "./model";

/** Identifies this process in lockedBy. */
export const WORKER_ID = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;

/**
 * A running job whose lock is older than this is assumed to belong to a process that
 * died, and may be claimed again. Must exceed the longest job run (a campaign batch,
 * a large import or export).
 */
export const LOCK_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Atomically claims the oldest due job: a pending job whose runAt has passed, or a
 * running job whose lock went stale. The single findOneAndUpdate is what prevents two
 * processes (or two loops in one process) from running the same job.
 */
export async function claimNextJob(now: Date): Promise<ScheduledJobDoc | null> {
  return ScheduledJob.findOneAndUpdate(
    {
      $or: [
        { status: "pending", runAt: { $lte: now } },
        { status: "running", lockedAt: { $lt: new Date(now.getTime() - LOCK_TIMEOUT_MS) } },
      ],
    },
    { $set: { status: "running", lockedAt: now, lockedBy: WORKER_ID }, $inc: { attempts: 1 } },
    { sort: { runAt: 1 }, new: true }
  ).setOptions(CROSS_TENANT);
}

/**
 * Writes a job's final or next state, but only while this process still holds the
 * lock. Returns false when the lock was lost (another process reclaimed a stale job).
 */
export async function releaseJob(job: ScheduledJobDoc, update: { $set: Record<string, unknown>; $inc?: Record<string, number> }): Promise<boolean> {
  const res = await ScheduledJob.updateOne(
    { _id: job._id, status: "running", lockedBy: job.lockedBy, lockedAt: job.lockedAt },
    { ...update, $unset: { lockedAt: 1, lockedBy: 1 } }
  ).setOptions(CROSS_TENANT);
  return res.modifiedCount === 1;
}
