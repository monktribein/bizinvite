import { parse } from "csv-parse/sync";
import { GUEST_CATEGORIES, GuestCategory } from "../../common/constants/enums";
import { normalizeMobile } from "../../common/utils/mobile";

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 20000;

export const IMPORT_TARGET_FIELDS = [
  "name",
  "mobile",
  "email",
  "category",
  "isVip",
  "city",
  "preferredLanguage",
  "relationshipWithHost",
  "allowedCompanions",
  "familyGroupName",
  "notes",
] as const;
export type ImportTargetField = (typeof IMPORT_TARGET_FIELDS)[number];

const HEADER_SYNONYMS: Record<ImportTargetField, string[]> = {
  name: ["name", "full name", "fullname", "guest name", "guest"],
  mobile: ["mobile", "mobile number", "mobile no", "phone", "phone number", "whatsapp", "whatsapp number", "contact", "contact number"],
  email: ["email", "email address", "e-mail", "mail"],
  category: ["category", "guest category", "type", "guest type"],
  isVip: ["vip", "is vip", "isvip"],
  city: ["city", "location", "town"],
  preferredLanguage: ["language", "preferred language"],
  relationshipWithHost: ["relationship", "relation", "relationship with host"],
  allowedCompanions: ["companions", "allowed companions", "plus ones", "plus one", "additional guests"],
  familyGroupName: ["family", "family group", "group", "family name", "party"],
  notes: ["notes", "note", "remarks", "comments"],
};

export interface ColumnMapping {
  csvHeader: string;
  targetField: string;
}

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(raw: string): ParsedCsv {
  const records = parse(raw, {
    columns: (header: string[]) => header.map((h) => h.trim()),
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
    max_record_size: 64 * 1024,
  }) as Record<string, string>[];
  const headers = records.length ? Object.keys(records[0]) : [];
  return { headers, rows: records };
}

/** Maps CSV headers to guest fields using common synonyms (case/spacing-insensitive). */
export function autoMapColumns(headers: string[]): ColumnMapping[] {
  const normalize = (v: string) => v.toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
  const used = new Set<string>();
  const mappings: ColumnMapping[] = [];
  for (const header of headers) {
    const h = normalize(header);
    const field = IMPORT_TARGET_FIELDS.find((f) => !used.has(f) && (normalize(f) === h || HEADER_SYNONYMS[f].includes(h)));
    if (field) {
      used.add(field);
      mappings.push({ csvHeader: header, targetField: field });
    }
  }
  return mappings;
}

export interface ValidatedRow {
  rowNumber: number;
  name: string;
  mobile: string;
  email?: string;
  category: GuestCategory;
  isVip: boolean;
  city?: string;
  preferredLanguage?: string;
  relationshipWithHost?: string;
  allowedCompanions: number;
  familyGroupName?: string;
  notes?: string;
}

export interface RowIssue {
  rowNumber: number;
  field: string;
  message: string;
  severity: "error" | "warning";
}

const TRUE_VALUES = new Set(["true", "yes", "y", "1", "vip"]);

/** Row numbers are 1-based data rows; the header line is not counted. */
export function validateRow(
  raw: Record<string, string>,
  rowNumber: number,
  mappings: ColumnMapping[],
  defaultCountryCode: string
): { row?: ValidatedRow; issues: RowIssue[] } {
  const value = (field: ImportTargetField) => {
    const mapping = mappings.find((m) => m.targetField === field);
    const v = mapping ? raw[mapping.csvHeader] : undefined;
    return v === undefined || v === null ? "" : String(v).trim();
  };
  const issues: RowIssue[] = [];

  const name = value("name");
  if (!name) issues.push({ rowNumber, field: "name", message: "Name is required", severity: "error" });
  else if (name.length > 200) issues.push({ rowNumber, field: "name", message: "Name is too long", severity: "error" });

  const mobile = normalizeMobile(value("mobile"), defaultCountryCode);
  if (!mobile.valid) issues.push({ rowNumber, field: "mobile", message: mobile.error, severity: "error" });

  const email = value("email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    issues.push({ rowNumber, field: "email", message: "Invalid email address", severity: "error" });
  }

  const rawCategory = value("category");
  let category: GuestCategory = "General";
  if (rawCategory) {
    const match = GUEST_CATEGORIES.find((c) => c.toLowerCase() === rawCategory.toLowerCase());
    if (match) category = match;
    else issues.push({ rowNumber, field: "category", message: `Unknown category "${rawCategory}", using General`, severity: "warning" });
  }

  const rawCompanions = value("allowedCompanions");
  let allowedCompanions = 0;
  if (rawCompanions) {
    const n = Number(rawCompanions);
    if (!Number.isInteger(n) || n < 0 || n > 50) {
      issues.push({ rowNumber, field: "allowedCompanions", message: "Companions must be a whole number between 0 and 50", severity: "error" });
    } else allowedCompanions = n;
  }

  if (issues.some((i) => i.severity === "error") || !mobile.valid) return { issues };

  const optional = (field: ImportTargetField) => value(field) || undefined;
  return {
    issues,
    row: {
      rowNumber,
      name,
      mobile: mobile.e164,
      email: email ? email.toLowerCase() : undefined,
      category,
      isVip: TRUE_VALUES.has(value("isVip").toLowerCase()) || category === "VIP" || category === "VVIP",
      city: optional("city"),
      preferredLanguage: optional("preferredLanguage"),
      relationshipWithHost: optional("relationshipWithHost"),
      allowedCompanions,
      familyGroupName: optional("familyGroupName"),
      notes: optional("notes"),
    },
  };
}

/** Rejects binary uploads that merely carry a .csv name. */
export function looksLikeText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 8192);
  return !sample.includes(0);
}
