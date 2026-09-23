export interface AuditLog {
  id: string;
  organizationId: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  resourceType: "event" | "guest" | "campaign" | "rsvp" | "reminder" | "pass" | "checkin" | "settings";
  resourceId: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
}

export interface ConsentRecord {
  id: string;
  guestId: string;
  guestName: string;
  mobile: string;
  channel: "whatsapp";
  status: "opted_in" | "opted_out";
  source: string;
  timestamp: string;
  optOutReason?: string;
}
