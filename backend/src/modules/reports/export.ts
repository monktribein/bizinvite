import ExcelJS from "exceljs";
import { PassThrough, type Writable } from "stream";
import { Errors } from "../../common/errors/app-error";
import { CheckIn } from "../check-ins/model";
import { EventGuest } from "../guests/model";
import { GuestRequirement } from "../rsvps/model";
import * as reports from "./service";

/** Export types used by the frontend reports page, plus row-level exports. */
export const EXPORT_TYPES = [
  "full_event_summary",
  "invitation_funnel",
  "rsvp_breakdown",
  "gate_attendance",
  "reminder_conversions",
  "delivery_failures",
  "guest_list",
] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];
export type ExportFormat = "csv" | "xlsx";

type Row = Record<string, string | number | boolean | null | undefined>;

interface ExportSource {
  columns: Array<{ key: string; header: string }>;
  rows: AsyncIterable<Row>;
}

async function* fromArray(rows: Row[]): AsyncIterable<Row> {
  for (const row of rows) yield row;
}

const iso = (d?: Date | null) => (d ? d.toISOString() : "");

/** Builds the rows for one export. Row-level exports stream from a cursor. */
export async function buildExport(type: ExportType, organizationId: string, eventId?: string): Promise<ExportSource> {
  const scope = { organizationId, ...(eventId ? { eventId } : {}) };
  switch (type) {
    case "full_event_summary": {
      const s = await reports.eventSummary(organizationId, eventId);
      return {
        columns: [{ key: "metric", header: "Metric" }, { key: "value", header: "Value" }],
        rows: fromArray(Object.entries(s).map(([metric, value]) => ({ metric, value: value as string | number }))),
      };
    }
    case "invitation_funnel": {
      const f = await reports.invitationFunnel(organizationId, eventId);
      return {
        columns: [{ key: "stage", header: "Stage" }, { key: "count", header: "Guests" }, { key: "percentage", header: "% of guests" }],
        rows: fromArray(f.stages),
      };
    }
    case "reminder_conversions": {
      const r = await reports.reminderReport(organizationId, eventId);
      return {
        columns: [{ key: "metric", header: "Metric" }, { key: "value", header: "Value" }],
        rows: fromArray(Object.entries(r).map(([metric, value]) => ({ metric, value: value as string | number }))),
      };
    }
    case "delivery_failures": {
      const f = await reports.failureReport(organizationId, eventId);
      return {
        columns: [
          { key: "guestName", header: "Guest" },
          { key: "mobile", header: "Mobile" },
          { key: "campaignName", header: "Campaign" },
          { key: "reason", header: "Reason" },
          { key: "failedAt", header: "Failed at" },
        ],
        rows: fromArray(f.recentFailedRecipients),
      };
    }
    case "rsvp_breakdown": {
      const requirements = new Map(
        (await GuestRequirement.find(scope)).map((r) => [String(r.eventGuestId), r])
      );
      const cursor = EventGuest.find(scope).sort({ name: 1 }).cursor();
      async function* rows(): AsyncIterable<Row> {
        for await (const g of cursor) {
          const req = requirements.get(String(g._id));
          yield {
            name: g.name,
            mobile: g.mobile,
            category: g.category,
            vip: g.isVip,
            rsvpStatus: g.rsvpStatus,
            attendingCount: g.rsvpStatus === "attending" ? 1 + g.confirmedCompanions : 0,
            respondedAt: iso(g.rsvpResponseTime),
            dietary: req?.dietaryPreference ?? "",
            accommodation: req?.needsAccommodation ?? "",
            transport: req?.needsTransport ?? "",
            specialRequests: req?.specialRequests ?? "",
          };
        }
      }
      return {
        columns: [
          { key: "name", header: "Guest" },
          { key: "mobile", header: "Mobile" },
          { key: "category", header: "Category" },
          { key: "vip", header: "VIP" },
          { key: "rsvpStatus", header: "RSVP" },
          { key: "attendingCount", header: "Attending (pax)" },
          { key: "respondedAt", header: "Responded at" },
          { key: "dietary", header: "Dietary" },
          { key: "accommodation", header: "Accommodation" },
          { key: "transport", header: "Transport" },
          { key: "specialRequests", header: "Special requests" },
        ],
        rows: rows(),
      };
    }
    case "gate_attendance": {
      const cursor = CheckIn.find(scope).sort({ scannedAt: 1 }).cursor();
      async function* rows(): AsyncIterable<Row> {
        for await (const c of cursor) {
          yield {
            scannedAt: iso(c.scannedAt),
            guestName: c.guestName,
            mobile: c.guestMobile ?? "",
            gate: c.gateName,
            method: c.method,
            status: c.status,
            paxAdmitted: c.paxAdmitted,
            allowedPax: c.totalAllowedPax,
            executive: c.executiveName ?? "",
          };
        }
      }
      return {
        columns: [
          { key: "scannedAt", header: "Scanned at" },
          { key: "guestName", header: "Guest" },
          { key: "mobile", header: "Mobile" },
          { key: "gate", header: "Gate" },
          { key: "method", header: "Method" },
          { key: "status", header: "Result" },
          { key: "paxAdmitted", header: "Pax admitted" },
          { key: "allowedPax", header: "Allowed pax" },
          { key: "executive", header: "Executive" },
        ],
        rows: rows(),
      };
    }
    case "guest_list": {
      const cursor = EventGuest.find(scope).sort({ name: 1 }).cursor();
      async function* rows(): AsyncIterable<Row> {
        for await (const g of cursor) {
          yield {
            name: g.name,
            mobile: g.mobile,
            category: g.category,
            vip: g.isVip,
            allowedCompanions: g.allowedCompanions,
            rsvpStatus: g.rsvpStatus,
            reminderStatus: g.reminderStatus,
            checkInStatus: g.checkInStatus,
            checkedInCount: g.checkedInCount,
          };
        }
      }
      return {
        columns: [
          { key: "name", header: "Guest" },
          { key: "mobile", header: "Mobile" },
          { key: "category", header: "Category" },
          { key: "vip", header: "VIP" },
          { key: "allowedCompanions", header: "Allowed companions" },
          { key: "rsvpStatus", header: "RSVP" },
          { key: "reminderStatus", header: "Reminders" },
          { key: "checkInStatus", header: "Check-in" },
          { key: "checkedInCount", header: "Checked-in pax" },
        ],
        rows: rows(),
      };
    }
    default:
      throw Errors.notFound("Report type");
  }
}

/** Neutralizes spreadsheet formula injection (cells starting with = + - @). */
export function safeCell(value: Row[string]): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvEscape(value: Row[string]): string {
  const v = String(safeCell(value));
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export const CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** Streams an export to a writable (HTTP response) without buffering all rows. */
export async function writeExport(source: ExportSource, format: ExportFormat, out: Writable, sheetName: string): Promise<void> {
  if (format === "csv") {
    out.write("﻿" + source.columns.map((c) => csvEscape(c.header)).join(",") + "\n");
    for await (const row of source.rows) {
      out.write(source.columns.map((c) => csvEscape(row[c.key])).join(",") + "\n");
    }
    out.end();
    return;
  }
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: out, useStyles: true });
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
  sheet.columns = source.columns.map((c) => ({ header: c.header, key: c.key, width: Math.max(12, c.header.length + 4) }));
  sheet.getRow(1).font = { bold: true };
  for await (const row of source.rows) {
    const safe: Record<string, string | number | boolean> = {};
    for (const c of source.columns) safe[c.key] = safeCell(row[c.key]);
    sheet.addRow(safe).commit();
  }
  sheet.commit();
  await workbook.commit();
}

/** Builds the whole export in memory (background jobs uploading to object storage). */
export async function renderExport(source: ExportSource, format: ExportFormat, sheetName: string): Promise<Buffer> {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve, reject) => {
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });
  await writeExport(source, format, stream, sheetName);
  await done;
  return Buffer.concat(chunks);
}
