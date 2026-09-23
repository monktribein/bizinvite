import type { Processor } from "../jobs";
import type { JobType } from "../model";
import { processCampaignDispatch } from "./campaign.processor";
import { processImport } from "./import.processor";
import { processReminder, processReminderPlan } from "./reminder.processor";
import { processReportExport } from "./report.processor";
import { processSendPass, processWebhook } from "./whatsapp.processor";

/** Job type → processor. Every JobType must have one. */
export const PROCESSORS: Record<JobType, Processor> = {
  "campaign.dispatch": processCampaignDispatch,
  "reminder.plan": processReminderPlan,
  "reminder.send": processReminder,
  "whatsapp.send-pass": processSendPass,
  "whatsapp.process-webhook": processWebhook,
  "import.commit": processImport,
  "report.export": processReportExport,
};
