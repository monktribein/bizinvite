/** Status enums shared across modules. Values match the frontend contract. */

export const EVENT_STATUSES = ["draft", "upcoming", "active", "completed", "cancelled"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_CATEGORIES = [
  "wedding",
  "corporate",
  "conference",
  "social",
  "birthday",
  "anniversary",
  "engagement",
  "exhibition",
  "cultural",
  "concert",
  "sports",
  "launch",
  "workshop",
  "reunion",
  "charity",
  "babyshower",
  "housewarming",
  "other",
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number] | (string & {});

export const GUEST_CATEGORIES = ["VIP", "VVIP", "Family", "Friend", "Corporate", "Vendor"] as const;
export type GuestCategory = (typeof GUEST_CATEGORIES)[number];

export const CONSENT_SOURCES = ["csv_import", "manual_entry", "whatsapp_opt_in", "external_form"] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

/**
 * Frontend statuses plus backend-only states:
 * `cancelled` (invitation withdrawn by the organizer).
 * "Checked in" and "no-show" are derived from checkInStatus, not stored here.
 */
export const RSVP_STATUSES = ["no_response", "attending", "declined", "maybe", "incomplete", "cancelled"] as const;
export type RSVPStatus = (typeof RSVP_STATUSES)[number];

/** RSVP statuses that count as "the guest responded" for reminder stop conditions. */
export const RESPONDED_RSVP_STATUSES: RSVPStatus[] = ["attending", "declined", "cancelled"];

/** `none` = no reminder has been scheduled for this guest yet (backend addition). */
export const REMINDER_STATUSES = ["none", "scheduled", "sent", "suppressed", "failed", "opted_out"] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export const CHECKIN_STATUSES = ["not_checked_in", "checked_in", "partially_checked_in"] as const;
export type CheckInStatus = (typeof CHECKIN_STATUSES)[number];

export const CAMPAIGN_STATUSES = ["draft", "scheduled", "running", "paused", "completed", "failed", "cancelled"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const RECIPIENT_STATUSES = ["pending", "sent", "delivered", "read", "failed", "suppressed"] as const;
export type RecipientStatus = (typeof RECIPIENT_STATUSES)[number];

export const TEMPLATE_APPROVAL_STATUSES = ["APPROVED", "PENDING", "REJECTED"] as const;
export type TemplateApprovalStatus = (typeof TEMPLATE_APPROVAL_STATUSES)[number];

export const PASS_STATUSES = ["active", "used", "revoked", "expired"] as const;
export type PassStatus = (typeof PASS_STATUSES)[number];

export const MESSAGE_STATUSES = ["queued", "sent", "delivered", "read", "failed", "received"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/** Delivery progression; a status update may only move a message forward. */
export const DELIVERY_RANK: Record<string, number> = {
  pending: 0,
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

export const DEFAULT_REMINDER_MAX_ATTEMPTS = 3;
export const DEFAULT_TIMEZONE = "Asia/Kolkata";
