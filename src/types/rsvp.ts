import { RSVPStatus } from "./guest";

export interface GuestRequirement {
  dietaryPreference?: "vegetarian" | "non_vegetarian" | "vegan" | "jain" | "other";
  dietaryNotes?: string;
  needsAccommodation?: boolean;
  accommodationNotes?: string;
  needsTransport?: boolean;
  arrivalDetails?: string;
  specialRequests?: string;
}

export interface RSVPRecord {
  id: string;
  guestId: string;
  guestName: string;
  guestMobile: string;
  eventId: string;
  status: RSVPStatus;
  attendingCount: number; // Primary guest (1) + companions
  companionsCount: number;
  attendingSessionIds: string[];
  requirements: GuestRequirement;
  source: "whatsapp_quick_reply" | "manual_staff_entry" | "phone_call";
  respondedAt: string;
  updatedBy?: string;
  history?: Array<{
    previousStatus: RSVPStatus;
    newStatus: RSVPStatus;
    changedAt: string;
    changedBy: string;
    reason?: string;
  }>;
}

export interface RSVPSummary {
  totalInvited: number;
  attending: number;
  declined: number;
  maybe: number;
  noResponse: number;
  incomplete: number;
  checkedIn: number;
  noShow: number;
  expectedFootfall: number;
  totalCompanions: number;
  dietaryCounts: {
    vegetarian: number;
    non_vegetarian: number;
    jain: number;
    vegan: number;
    other: number;
  };
  accommodationRequestedCount: number;
  transportRequestedCount: number;
}
