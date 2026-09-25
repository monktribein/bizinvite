export type EventStatus = "draft" | "upcoming" | "active" | "completed" | "cancelled";

export interface Venue {
  name: string;
  address: string;
  city: string;
  googleMapsUrl?: string;
  gateNotes?: string;
}

export interface HostInfo {
  name: string;
  relationship: string;
  phone?: string;
}

export interface ContactPerson {
  name: string;
  role: string;
  phone: string;
}

export interface EventFAQ {
  question: string;
  answer: string;
}

export interface EventSession {
  id: string;
  eventId: string;
  name: string; // e.g. "Mehendi", "Sangeet", "Wedding", "Reception"
  description?: string;
  startTime: string;
  endTime: string;
  venueName?: string;
  venueAddress?: string;
  dressCode?: string;
  capacity?: number;
}

export interface EventCheckInConfig {
  allowMultipleEntries: boolean;
  requirePassVerification: boolean;
  activeGates: string[];
}

export type EventCategory =
  | "wedding"
  | "corporate"
  | "conference"
  | "social"
  | "birthday"
  | "anniversary"
  | "engagement"
  | "exhibition"
  | "cultural"
  | "concert"
  | "sports"
  | "launch"
  | "workshop"
  | "reunion"
  | "charity"
  | "babyshower"
  | "housewarming"
  | "other"
  | (string & {});

export interface Event {
  id: string;
  organizationId: string;
  name: string;
  category: EventCategory;
  status: EventStatus;
  description?: string;
  startDate: string;
  endDate: string;
  rsvpDeadline: string;
  venue: Venue;
  hosts: HostInfo[];
  contactPersons: ContactPerson[];
  languages: string[];
  dressCode?: string;
  accommodationInfo?: string;
  transportInfo?: string;
  faqs?: EventFAQ[];
  sessions: EventSession[];
  checkInConfig: EventCheckInConfig;
  totalGuestsCount: number;
  confirmedGuestsCount: number;
  createdAt: string;
  updatedAt: string;
}
