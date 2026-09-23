export type RSVPStatus = "no_response" | "attending" | "declined" | "maybe" | "incomplete";

export type ReminderStatus = "scheduled" | "sent" | "suppressed" | "failed" | "opted_out";

export type CheckInStatus = "not_checked_in" | "checked_in" | "partially_checked_in";

export interface GuestGroup {
  id: string;
  name: string;
  primaryContactGuestId?: string;
  notes?: string;
}

export interface Guest {
  id: string;
  organizationId: string;
  eventId: string;
  name: string;
  mobile: string;
  email?: string;
  familyGroupName?: string;
  category: "VIP" | "VVIP" | "Family" | "Friend" | "Corporate" | "Vendor" | "General";
  isVip: boolean;
  city?: string;
  preferredLanguage: string;
  invitedSessionIds: string[];
  allowedCompanions: number;
  confirmedCompanions: number;
  relationshipWithHost?: string;
  assignedRelationshipManager?: string;
  consentSource: "csv_import" | "manual_entry" | "whatsapp_opt_in" | "external_form";
  consentTimestamp: string;
  rsvpStatus: RSVPStatus;
  rsvpResponseTime?: string;
  reminderStatus: ReminderStatus;
  checkInStatus: CheckInStatus;
  checkedInAt?: string;
  checkedInCount?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ColumnMapping {
  csvHeader: string;
  targetField: string;
}

export interface ImportValidationIssue {
  rowNumber: number;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface DuplicateWarning {
  rowNumber: number;
  mobile: string;
  name: string;
  existingGuestName: string;
  action: "skip" | "overwrite" | "create_duplicate";
}

export interface ImportPreviewResult {
  importId: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateCount: number;
  columnMappings: ColumnMapping[];
  previewRows: Array<Record<string, string>>;
  validationIssues: ImportValidationIssue[];
  duplicates: DuplicateWarning[];
}

export interface ImportCommitRequest {
  importId: string;
  eventId: string;
  columnMappings: ColumnMapping[];
  duplicateResolutions: Record<string, "skip" | "overwrite">;
}
