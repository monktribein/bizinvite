import { EXPORT_TYPES, type ExportFormat, type ExportType } from "../../modules/reports/export";
import { runExportJob } from "../../modules/reports/export-jobs";
import { completed, Processor } from "../jobs";
import { requirePayload } from "./payload";

/** report.export: builds a report file and uploads it to object storage. */
export const processReportExport: Processor = async (job) => {
  const { organizationId, type, format } = requirePayload(job, ["type", "format"]);
  if (!(EXPORT_TYPES as readonly string[]).includes(type) || !["csv", "xlsx"].includes(format)) throw new Error("Invalid report.export payload");
  const eventId = (job.payload as { eventId?: unknown }).eventId;
  const result = await runExportJob(
    { organizationId, type: type as ExportType, format: format as ExportFormat, eventId: typeof eventId === "string" ? eventId : null },
    job.id as string
  );
  return completed(result);
};
