import { logger } from "../../common/utils/logger";
import { planDueReminders, processReminderSend } from "../../modules/reminder-rules/service";
import { Processor, rescheduled } from "../jobs";

export const REMINDER_PLAN_EVERY_MS = 60_000;

/** reminder.plan: recurring singleton job that creates due reminder.send jobs, then runs again in a minute. */
export const processReminderPlan: Processor = async (_job, { now }) => {
  const next = new Date(now.getTime() + REMINDER_PLAN_EVERY_MS);
  try {
    return rescheduled(next, await planDueReminders(now));
  } catch (err) {
    // A failed run must not stop the planner; the next run retries (planning is idempotent).
    logger.error({ err: (err as Error).message }, "Reminder planning failed");
    return rescheduled(next, { error: "planning_failed" });
  }
};

/** reminder.send: one reminder attempt for one guest. */
export const processReminder: Processor = (job, { now }) => processReminderSend(job, now);
