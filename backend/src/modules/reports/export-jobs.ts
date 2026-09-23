import { isValidObjectId } from "mongoose";
import { Errors } from "../../common/errors/app-error";
import type { ActorContext } from "../../common/utils/context";
import { getStorage, isStorageConfigured } from "../../common/utils/storage";
import { enqueueJob } from "../../scheduler/jobs";
import { ScheduledJob } from "../../scheduler/model";
import { recordAudit } from "../audit";
import { buildExport, CONTENT_TYPES, ExportFormat, ExportType, renderExport } from "./export";

/**
 * Large exports run as report.export jobs and are uploaded to object storage.
 * The scheduledJobs document holds the status and result (kept for 7 days), so no
 * extra collection is needed.
 */
export async function queueExport(actor: ActorContext, type: ExportType, format: ExportFormat, eventId?: string) {
  if (!isStorageConfigured()) throw Errors.storage("Background exports need S3 storage; use the direct download instead");
  const job = await enqueueJob({ type: "report.export", organizationId: actor.organizationId, payload: { type, format, eventId: eventId ?? null }, maxAttempts: 2 });
  const jobId = job!.id as string;
  await recordAudit(actor, { action: "report.export_queued", resourceType: "settings", details: `Queued ${type} export (${format})`, metadata: { jobId, eventId } });
  return { jobId, status: "queued" };
}

const PUBLIC_STATUS = { pending: "queued", running: "running", completed: "completed", failed: "failed", cancelled: "failed" } as const;

export async function exportJobStatus(organizationId: string, jobId: string) {
  if (!isValidObjectId(jobId)) throw Errors.notFound("Export");
  // Scoped by organization: jobs of other organizations are reported as not found.
  const job = await ScheduledJob.findOne({ _id: jobId, organizationId, type: "report.export" });
  if (!job) throw Errors.notFound("Export");
  const status = PUBLIC_STATUS[job.status];
  const result = job.result as { key?: string; fileName?: string } | undefined;
  return {
    jobId,
    status,
    failedReason: status === "failed" ? "Export failed" : undefined,
    downloadUrl: status === "completed" && result?.key ? await getStorage().signedDownloadUrl(result.key, result.fileName ?? "report") : undefined,
  };
}

/** report.export job. */
export async function runExportJob(data: { organizationId: string; type: ExportType; format: ExportFormat; eventId?: string | null }, jobId: string) {
  const source = await buildExport(data.type, data.organizationId, data.eventId ?? undefined);
  const buffer = await renderExport(source, data.format, data.type);
  const fileName = `bizinvite_${data.type}_${new Date().toISOString().slice(0, 10)}.${data.format}`;
  const key = `exports/${data.organizationId}/${jobId}.${data.format}`;
  await getStorage().put(key, buffer, CONTENT_TYPES[data.format]);
  return { key, fileName, bytes: buffer.length };
}
