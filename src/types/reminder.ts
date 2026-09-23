export interface ReminderRule {
  id: string;
  organizationId: string;
  eventId: string;
  name: string;
  reminderType: "rsvp_deadline" | "event_eve" | "event_day" | "session_specific" | "custom";
  triggerType: "relative_to_deadline" | "relative_to_event" | "scheduled_time";
  relativeTo: "rsvp_deadline" | "event_start" | "session_start";
  offsetMinutes: number; // e.g., -2880 for 48 hours before
  targetFilters: {
    rsvpStatuses: string[];
    guestCategories?: string[];
    onlyVip?: boolean;
  };
  channel: "whatsapp";
  templateId: string;
  templateName?: string;
  maximumAttempts: number;
  quietHours: {
    enabled: boolean;
    start: string; // "21:00"
    end: string;   // "09:00"
  };
  requiresApproval: boolean;
  fallbackChannel: "none" | "sms";
  stopConditions: Array<"rsvp_received" | "opt_out" | "max_attempts">;
  escalationRule?: {
    enabled: boolean;
    assignToRMAfterHours: number;
  };
  status: "active" | "paused" | "completed" | "draft";
  audienceCount: number;
  estimatedCost: number; // in INR
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  suppressedCount: number;
  createdAt: string;
}

export interface SuppressedRecipient {
  id: string;
  guestName: string;
  mobile: string;
  reason: "already_rsvped" | "opted_out" | "quiet_hours_delayed" | "contact_failed";
  suppressedAt: string;
  rsvpStatus: string;
}
