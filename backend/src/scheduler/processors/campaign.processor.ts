import { assertCampaignJob, dispatchCampaign } from "../../modules/campaigns/service";
import { cancelled, completed, Processor, rescheduled } from "../jobs";

/** Pause before the next batch when some sends hit transient WhatsApp errors. */
const TRANSIENT_RETRY_MS = 30_000;

/**
 * campaign.dispatch: sends one batch per run and reschedules itself until every
 * recipient is sent, failed or suppressed. Never sends inside the HTTP request.
 */
export const processCampaignDispatch: Processor = async (job, { now }) => {
  const data = { ...(job.payload as Record<string, unknown>), organizationId: job.organizationId ? String(job.organizationId) : undefined };
  await assertCampaignJob(data);
  const result = await dispatchCampaign(data as { organizationId: string; campaignId: string; generation: number });
  if ("skipped" in result) return cancelled(result.skipped);
  if (result.transientFailures > 0) return rescheduled(new Date(now.getTime() + TRANSIENT_RETRY_MS), result);
  if (result.remaining) return rescheduled(now, result);
  return completed(result);
};
