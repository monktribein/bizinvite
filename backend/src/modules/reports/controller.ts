import type { Request, Response } from "express";
import { z } from "zod";
import { actorFromRequest } from "../../common/utils/context";
import { sendSuccess } from "../../common/utils/response";
import { objectIdSchema } from "../../common/validators/common";
import { recordAudit } from "../audit";
import { findEventOrThrow } from "../events/service";
import { buildExport, CONTENT_TYPES, EXPORT_TYPES, writeExport } from "./export";
import { exportJobStatus, queueExport } from "./export-jobs";
import * as reports from "./service";

// The frontend may send an empty eventId ("?eventId=") for "all events".
const eventQuerySchema = z.object({
  eventId: z.preprocess((v) => (v === "" ? undefined : v), objectIdSchema.optional()),
});
const exportQuerySchema = eventQuerySchema.extend({ format: z.enum(["csv", "xlsx"]).default("xlsx") });
const exportTypeSchema = z.enum(EXPORT_TYPES);

async function scopedEventId(req: Request): Promise<string | undefined> {
  const { eventId } = eventQuerySchema.parse(req.query);
  if (eventId) await findEventOrThrow(req.tenant!.organizationId, eventId);
  return eventId;
}

function handler(fn: (organizationId: string, eventId?: string) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    const eventId = await scopedEventId(req);
    sendSuccess(req, res, await fn(req.tenant!.organizationId, eventId));
  };
}

export const invitationFunnel = handler(reports.invitationFunnel);
export const rsvp = handler(reports.rsvpReport);
export const attendance = handler(reports.attendanceReport);
export const reminders = handler(reports.reminderReport);
export const failures = handler(reports.failureReport);
export const eventSummary = handler(reports.eventSummary);

/** Streams the file directly (CSV or XLSX). */
export async function exportReport(req: Request, res: Response) {
  const type = exportTypeSchema.parse(req.params.type);
  const { format } = exportQuerySchema.parse(req.query);
  const eventId = await scopedEventId(req);
  const source = await buildExport(type, req.tenant!.organizationId, eventId);
  const fileName = `bizinvite_${type}_${new Date().toISOString().slice(0, 10)}.${format}`;

  await recordAudit(actorFromRequest(req), { action: "report.exported", resourceType: "settings", details: `Exported ${type} (${format})`, metadata: { eventId } });
  res.status(200);
  res.setHeader("Content-Type", CONTENT_TYPES[format]);
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Cache-Control", "no-store");
  await writeExport(source, format, res, type);
}

export async function queueBackgroundExport(req: Request, res: Response) {
  const type = exportTypeSchema.parse(req.params.type);
  const { format } = exportQuerySchema.parse(req.query);
  const eventId = await scopedEventId(req);
  sendSuccess(req, res, await queueExport(actorFromRequest(req), type, format, eventId), { status: 202 });
}

export async function backgroundExportStatus(req: Request, res: Response) {
  sendSuccess(req, res, await exportJobStatus(req.tenant!.organizationId, String(req.params.jobId)));
}
