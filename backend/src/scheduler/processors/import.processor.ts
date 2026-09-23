import { processImportJob } from "../../modules/imports/service";
import { completed, Processor } from "../jobs";
import { requirePayload } from "./payload";

/** import.commit: commits a previewed CSV import that was too large for the HTTP request. */
export const processImport: Processor = async (job) => {
  const { organizationId, importId } = requirePayload(job, ["importId"]);
  const userId = (job.payload as { userId?: unknown }).userId;
  const doc = await processImportJob({ organizationId, importId, userId: typeof userId === "string" ? userId : undefined });
  return completed({ status: doc.status, summary: doc.summary });
};
