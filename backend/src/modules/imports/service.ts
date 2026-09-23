import { AnyBulkWriteOperation } from "mongoose";
import { Errors } from "../../common/errors/app-error";
import type { ActorContext } from "../../common/utils/context";
import { logger } from "../../common/utils/logger";
import { CROSS_TENANT } from "../../common/utils/model";
import { enqueueJob } from "../../scheduler/jobs";
import { recordAudit } from "../audit";
import { findEventOrThrow } from "../events/service";
import { GuestGroup } from "../guest-groups/model";
import { Consent, EventGuest, Guest } from "../guests/model";
import { defaultCountryCode } from "../guests/service";
import {
  autoMapColumns,
  ColumnMapping,
  IMPORT_TARGET_FIELDS,
  MAX_IMPORT_ROWS,
  parseCsv,
  RowIssue,
  validateRow,
  ValidatedRow,
} from "./csv";
import { Import, ImportDoc } from "./model";

/** Commits at or below this size run inside the request; larger ones run as an import.commit scheduled job. */
export const SYNC_IMPORT_ROW_LIMIT = 500;
const CHUNK_SIZE = 500;
const PREVIEW_TTL_MS = 24 * 3600 * 1000;
const MAX_STORED_ERRORS = 500;

function parseOrThrow(raw: string) {
  let parsed;
  try {
    parsed = parseCsv(raw);
  } catch (err) {
    throw Errors.importError(`Could not parse CSV: ${(err as Error).message}`);
  }
  if (parsed.rows.length === 0) throw Errors.importError("The CSV file has no data rows");
  if (parsed.rows.length > MAX_IMPORT_ROWS) throw Errors.importError(`CSV files are limited to ${MAX_IMPORT_ROWS} rows`);
  return parsed;
}

function assertMappings(mappings: ColumnMapping[], headers: string[]) {
  const fields: Record<string, string[]> = {};
  for (const m of mappings) {
    if (!headers.includes(m.csvHeader)) (fields.columnMappings ??= []).push(`Unknown CSV column "${m.csvHeader}"`);
    if (!(IMPORT_TARGET_FIELDS as readonly string[]).includes(m.targetField)) (fields.columnMappings ??= []).push(`Unknown target field "${m.targetField}"`);
  }
  for (const required of ["name", "mobile"]) {
    if (!mappings.some((m) => m.targetField === required)) (fields.columnMappings ??= []).push(`A column must be mapped to "${required}"`);
  }
  if (Object.keys(fields).length) throw Errors.validation("Invalid column mappings", fields);
}

async function existingContactsByMobile(organizationId: string, mobiles: string[]) {
  const map = new Map<string, { id: string; name: string }>();
  for (let i = 0; i < mobiles.length; i += 1000) {
    const found = await Guest.find({ organizationId, mobile: { $in: mobiles.slice(i, i + 1000) } }).select("name mobile");
    for (const g of found) map.set(g.mobile, { id: g.id as string, name: g.name });
  }
  return map;
}

export async function previewImport(actor: ActorContext, file: { originalname: string; size: number; buffer: Buffer }) {
  const raw = file.buffer.toString("utf8");
  const { headers, rows } = parseOrThrow(raw);
  const columnMappings = autoMapColumns(headers);
  const countryCode = await defaultCountryCode(actor.organizationId);

  const validationIssues: RowIssue[] = [];
  const valid: ValidatedRow[] = [];
  rows.forEach((r, i) => {
    const { row, issues } = validateRow(r, i + 1, columnMappings, countryCode);
    validationIssues.push(...issues);
    if (row) valid.push(row);
  });

  const existing = await existingContactsByMobile(actor.organizationId, [...new Set(valid.map((r) => r.mobile))]);
  const firstSeen = new Map<string, ValidatedRow>();
  const duplicates: Array<{ rowNumber: number; mobile: string; name: string; existingGuestName: string; action: "skip" }> = [];
  for (const row of valid) {
    const earlier = firstSeen.get(row.mobile);
    const inCrm = existing.get(row.mobile);
    if (earlier) duplicates.push({ rowNumber: row.rowNumber, mobile: row.mobile, name: row.name, existingGuestName: earlier.name, action: "skip" });
    else if (inCrm) duplicates.push({ rowNumber: row.rowNumber, mobile: row.mobile, name: row.name, existingGuestName: inCrm.name, action: "skip" });
    if (!earlier) firstSeen.set(row.mobile, row);
  }

  const errorRows = new Set(validationIssues.filter((i) => i.severity === "error").map((i) => i.rowNumber)).size;
  const doc = await Import.create({
    organizationId: actor.organizationId,
    fileName: file.originalname.slice(0, 200),
    fileSize: file.size,
    rawCsv: raw,
    status: "previewed",
    columnMappings,
    preview: { totalRows: rows.length, validRows: valid.length, errorRows, duplicateCount: duplicates.length },
    createdBy: actor.userId,
    expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
  });

  return {
    importId: doc.id as string,
    totalRows: rows.length,
    validRows: valid.length,
    errorRows,
    duplicateCount: duplicates.length,
    headers,
    columnMappings,
    previewRows: rows.slice(0, 5),
    validationIssues: validationIssues.slice(0, 500),
    duplicates: duplicates.slice(0, 1000),
  };
}

export async function commitImport(
  actor: ActorContext,
  input: { importId: string; eventId: string; columnMappings?: ColumnMapping[]; duplicateResolutions?: Record<string, "skip" | "overwrite"> }
) {
  const event = await findEventOrThrow(actor.organizationId, input.eventId);
  const current = await Import.findOne({ _id: input.importId, organizationId: actor.organizationId }).select("+rawCsv");
  if (!current) throw Errors.notFound("Import");
  if (current.status !== "previewed") throw Errors.conflict(`Import is already ${current.status}`);

  const { headers, rows } = parseOrThrow(current.rawCsv);
  const mappings = input.columnMappings?.length ? input.columnMappings : (current.columnMappings as ColumnMapping[]);
  assertMappings(mappings, headers);

  // Claim the import atomically so a double-submitted commit cannot run twice.
  const claimed = await Import.findOneAndUpdate(
    { _id: current._id, organizationId: actor.organizationId, status: "previewed" },
    {
      $set: {
        status: "pending",
        eventId: event._id,
        columnMappings: mappings,
        duplicateResolutions: input.duplicateResolutions ?? {},
        "summary.totalRows": rows.length,
      },
      $unset: { expiresAt: 1 },
    },
    { new: true }
  );
  if (!claimed) throw Errors.conflict("Import has already been committed");

  await recordAudit(actor, {
    action: "import.committed",
    resourceType: "guest",
    resourceId: claimed.id,
    details: `Importing ${rows.length} rows from ${claimed.fileName} into "${event.name}"`,
    metadata: { eventId: event.id, rows: rows.length },
  });

  if (rows.length <= SYNC_IMPORT_ROW_LIMIT) {
    const done = await processImport(actor.organizationId, claimed.id, actor.userId);
    return { async: false as const, result: importStatusDto(done) };
  }
  await enqueueJob({
    type: "import.commit",
    organizationId: actor.organizationId,
    payload: { importId: claimed.id, userId: actor.userId },
    dedupeKey: `import:${claimed.id}`,
  });
  return { async: true as const, result: importStatusDto(claimed) };
}

export function importStatusDto(doc: ImportDoc) {
  const s = doc.summary;
  return {
    id: doc.id as string,
    importId: doc.id as string,
    status: doc.status,
    fileName: doc.fileName,
    eventId: doc.eventId ? String(doc.eventId) : undefined,
    totalRows: s?.totalRows || doc.preview?.totalRows || 0,
    successfulRows: s?.successfulRows ?? 0,
    duplicateRows: s?.duplicateRows ?? 0,
    invalidRows: s?.invalidRows ?? 0,
    createdCount: s?.createdCount ?? 0,
    updatedCount: s?.updatedCount ?? 0,
    /** Contract field names for the commit response. */
    importedCount: s?.createdCount ?? 0,
    errors: (doc.rowErrors ?? []).slice(0, 200),
    failureReason: doc.failureReason ?? undefined,
    createdAt: (doc.get("createdAt") as Date | undefined)?.toISOString(),
    completedAt: doc.completedAt?.toISOString(),
  };
}

export async function getImport(organizationId: string, importId: string) {
  const doc = await Import.findOne({ _id: importId, organizationId });
  if (!doc) throw Errors.notFound("Import");
  return importStatusDto(doc);
}

/**
 * Applies a committed import: create/update guests, invite them to the event, record
 * consent for new contacts. Processes in chunks with bulk writes so large files do
 * not hold thousands of documents in memory at once. Safe to retry: every write is
 * an idempotent upsert keyed by (organization, mobile) and (organization, event, guest).
 */
export async function processImport(organizationId: string, importId: string, userId?: string): Promise<ImportDoc> {
  const doc = await Import.findOneAndUpdate(
    { _id: importId, organizationId, status: { $in: ["pending", "processing"] } },
    { $set: { status: "processing", startedAt: new Date() } },
    { new: true }
  ).select("+rawCsv");
  if (!doc) {
    const existing = await Import.findOne({ _id: importId, organizationId });
    if (!existing) throw Errors.notFound("Import");
    return existing;
  }

  try {
    const { rows } = parseCsv(doc.rawCsv);
    const mappings = doc.columnMappings as ColumnMapping[];
    const resolutions = (doc.duplicateResolutions ?? new Map()) as Map<string, string>;
    const countryCode = await defaultCountryCode(organizationId);
    const eventId = String(doc.eventId);

    const summary = { totalRows: rows.length, successfulRows: 0, duplicateRows: 0, invalidRows: 0, createdCount: 0, updatedCount: 0 };
    const rowErrors: Array<{ rowNumber: number; field: string; message: string }> = [];
    const seenMobiles = new Set<string>();
    const groupIds = new Map<string, string>();

    for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
      const chunk: ValidatedRow[] = [];
      rows.slice(start, start + CHUNK_SIZE).forEach((raw, i) => {
        const { row, issues } = validateRow(raw, start + i + 1, mappings, countryCode);
        for (const issue of issues.filter((x) => x.severity === "error")) {
          if (rowErrors.length < MAX_STORED_ERRORS) rowErrors.push({ rowNumber: issue.rowNumber, field: issue.field, message: issue.message });
        }
        if (row) chunk.push(row);
        else summary.invalidRows++;
      });

      const existing = await existingContactsByMobile(organizationId, chunk.map((r) => r.mobile));
      const toApply: Array<ValidatedRow & { overwrite: boolean }> = [];
      for (const row of chunk) {
        const resolution = resolutions.get(`row_${row.rowNumber}`) ?? "skip";
        const duplicateInFile = seenMobiles.has(row.mobile);
        const duplicateInCrm = existing.has(row.mobile);
        seenMobiles.add(row.mobile);
        if ((duplicateInFile || duplicateInCrm) && resolution !== "overwrite") {
          summary.duplicateRows++;
          continue;
        }
        toApply.push({ ...row, overwrite: duplicateInFile || duplicateInCrm });
      }
      if (toApply.length === 0) continue;

      // Groups referenced by this chunk.
      for (const name of new Set(toApply.map((r) => r.familyGroupName).filter((n): n is string => Boolean(n)))) {
        if (groupIds.has(name)) continue;
        const group = await GuestGroup.findOneAndUpdate(
          { organizationId, eventId, name },
          { $setOnInsert: { organizationId, eventId, name } },
          { upsert: true, new: true }
        );
        groupIds.set(name, group!.id as string);
      }

      // 1. Contacts
      const contactOps: AnyBulkWriteOperation[] = toApply.map((r) => {
        const fields = {
          name: r.name,
          category: r.category,
          isVip: r.isVip,
          ...(r.email ? { email: r.email } : {}),
          ...(r.city ? { city: r.city } : {}),
          ...(r.preferredLanguage ? { preferredLanguage: r.preferredLanguage } : {}),
          ...(r.relationshipWithHost ? { relationshipWithHost: r.relationshipWithHost } : {}),
        };
        return {
          updateOne: {
            filter: { organizationId, mobile: r.mobile },
            update: {
              $set: fields,
              $setOnInsert: { organizationId, mobile: r.mobile, consentSource: "csv_import", consentTimestamp: new Date() },
            },
            upsert: true,
          },
        };
      });
      await Guest.bulkWrite(contactOps as never, { ordered: false });

      const contacts = await Guest.find({ organizationId, mobile: { $in: toApply.map((r) => r.mobile) } });
      const contactByMobile = new Map(contacts.map((c) => [c.mobile, c]));

      // 2. Consent records for contacts created by this import.
      const newContacts = toApply.filter((r) => !existing.has(r.mobile) && !r.overwrite);
      if (newContacts.length) {
        await Consent.insertMany(
          newContacts.map((r) => ({
            organizationId,
            guestId: contactByMobile.get(r.mobile)!._id,
            guestName: r.name,
            mobile: r.mobile,
            status: "opted_in",
            source: "csv_import",
            recordedBy: userId,
          }))
        );
      }

      // 3. Invitations
      const invitationOps: AnyBulkWriteOperation[] = toApply.map((r) => {
        const contact = contactByMobile.get(r.mobile)!;
        const groupId = r.familyGroupName ? groupIds.get(r.familyGroupName) : undefined;
        return {
          updateOne: {
            filter: { organizationId, eventId, guestId: contact._id },
            update: {
              $set: {
                name: contact.name,
                mobile: contact.mobile,
                category: contact.category,
                isVip: contact.isVip,
                allowedCompanions: r.allowedCompanions,
                ...(groupId ? { groupId } : {}),
                ...(r.notes ? { notes: r.notes } : {}),
              },
              $setOnInsert: { organizationId, eventId, guestId: contact._id },
            },
            upsert: true,
          },
        };
      });
      const result = await EventGuest.bulkWrite(invitationOps as never, { ordered: false });
      summary.createdCount += result.upsertedCount;
      summary.updatedCount += toApply.length - result.upsertedCount;
      summary.successfulRows += toApply.length;

      // Keep denormalized fields in sync on this contact's other invitations.
      if (toApply.some((r) => r.overwrite)) {
        await EventGuest.bulkWrite(
          toApply
            .filter((r) => r.overwrite)
            .map((r) => {
              const c = contactByMobile.get(r.mobile)!;
              return {
                updateMany: {
                  filter: { organizationId, guestId: c._id },
                  update: { $set: { name: c.name, mobile: c.mobile, category: c.category, isVip: c.isVip } },
                },
              };
            }) as never,
          { ordered: false }
        );
      }
    }

    doc.set({ status: "completed", summary, rowErrors, completedAt: new Date(), rawCsv: "-" });
    await doc.save();
    await recordAudit(
      { organizationId, userId, userName: userId ? undefined : "system" },
      {
        action: "import.completed",
        resourceType: "guest",
        resourceId: doc.id,
        details: `Imported ${summary.createdCount} new and ${summary.updatedCount} updated guests from ${doc.fileName}`,
        metadata: summary,
      }
    );
    return doc;
  } catch (err) {
    logger.error({ err: (err as Error).message, importId }, "Guest import failed");
    await Import.updateOne({ _id: importId, organizationId }, { $set: { status: "failed", failureReason: (err as Error).message.slice(0, 500) } });
    throw err;
  }
}

/** import.commit job entry point: the payload is validated against the stored import. */
export async function processImportJob(data: { organizationId?: string; importId?: string; userId?: string }) {
  if (!data.organizationId || !data.importId) throw new Error("Invalid import job payload");
  const exists = await Import.exists({ _id: data.importId, organizationId: data.organizationId }).setOptions(CROSS_TENANT);
  if (!exists) throw new Error("Import not found for organization");
  return processImport(data.organizationId, data.importId, data.userId);
}
