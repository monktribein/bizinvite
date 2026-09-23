import { User } from "@/types/auth";
import { Organization } from "@/types/organization";
import { Event } from "@/types/event";
import { Guest, RSVPStatus, ImportPreviewResult } from "@/types/guest";
import { Campaign, WhatsAppTemplate } from "@/types/campaign";
import { ReminderRule } from "@/types/reminder";
import { RSVPRecord, RSVPSummary } from "@/types/rsvp";
import { DigitalPass } from "@/types/pass";
import { CheckInRecord, CheckInResponse, CheckInLiveSummary } from "@/types/checkin";
import {
  InvitationFunnelReport,
  RSVPFunnelReport,
  AttendanceReport,
  ReminderConversionReport,
  DeliveryFailureReport,
  EventSummaryReport,
} from "@/types/report";
import { AuditLog, ConsentRecord } from "@/types/audit";

// --- Seed Data ---

export const MOCK_ORGANIZATION: Organization = {
  id: "org_biz_aura_001",
  name: "Aura Events & Hospitality",
  slug: "aura-events",
  logoUrl: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=100&auto=format&fit=crop&q=80",
  plan: "enterprise",
  createdAt: "2026-01-15T10:00:00Z",
  whatsAppStatus: {
    connected: true,
    phoneNumber: "+91 98200 12345",
    wabaId: "waba_biz_998127391",
    businessDisplayName: "Aura Events Concierge",
    qualityRating: "GREEN",
    tier: "TIER_100K",
    lastSyncAt: "2026-09-23T10:30:00Z",
  },
};

export const MOCK_USERS: User[] = [
  {
    id: "usr_admin_01",
    email: "admin@bizinvite.io",
    name: "Kabir Malhotra",
    role: "ORGANIZATION_OWNER",
    organizationId: "org_biz_aura_001",
    organizationName: "Aura Events & Hospitality",
    createdAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "usr_super_01",
    email: "superadmin@bizinvite.io",
    name: "Aanya Sen",
    role: "PLATFORM_SUPER_ADMIN",
    organizationId: "org_biz_aura_001",
    organizationName: "Aura Events & Hospitality",
    createdAt: "2026-01-10T10:00:00Z",
  },
  {
    id: "usr_event_01",
    email: "eventmgr@bizinvite.io",
    name: "Rohan Varma",
    role: "EVENT_ADMINISTRATOR",
    organizationId: "org_biz_aura_001",
    organizationName: "Aura Events & Hospitality",
    createdAt: "2026-02-01T10:00:00Z",
  },
  {
    id: "usr_checkin_01",
    email: "gate1@bizinvite.io",
    name: "Pooja Hegde",
    role: "CHECK_IN_EXECUTIVE",
    organizationId: "org_biz_aura_001",
    organizationName: "Aura Events & Hospitality",
    createdAt: "2026-03-01T10:00:00Z",
  },
];

export const MOCK_EVENTS: Event[] = [
  {
    id: "evt_sharma_wedding_2026",
    organizationId: "org_biz_aura_001",
    name: "Sharma & Verma Grand Wedding",
    category: "wedding",
    status: "active",
    description: "Three-day celebration of the union of Priya Sharma & Siddharth Verma.",
    startDate: "2026-10-24T10:00:00Z",
    endDate: "2026-10-26T23:00:00Z",
    rsvpDeadline: "2026-10-10T23:59:00Z",
    venue: {
      name: "Taj Aravali Resort & Spa",
      address: "1 Kotiya, Udaipur",
      city: "Udaipur, Rajasthan",
      googleMapsUrl: "https://maps.google.com/?q=Taj+Aravali+Resort+Udaipur",
      gateNotes: "Valet parking at Main Courtyard Gate A.",
    },
    hosts: [
      { name: "Mr. Rajeev & Mrs. Sunita Sharma", relationship: "Parents of the Bride", phone: "+91 98210 11223" },
      { name: "Dr. Vikram & Mrs. Meenakshi Verma", relationship: "Parents of the Groom", phone: "+91 98110 33445" },
    ],
    contactPersons: [
      { name: "Rohan Varma (Operations)", role: "Hospitality Lead", phone: "+91 98200 99881" },
      { name: "Simran Kaur", role: "Guest Concierge", phone: "+91 98200 99882" },
    ],
    languages: ["English", "Hindi"],
    dressCode: "Traditional / Indo-Western Formal",
    accommodationInfo: "Guest rooms reserved at Taj Aravali and Raffles Udaipur. Shuttle service every 20 minutes.",
    transportInfo: "Airport transfers available for flights arriving at Maharana Pratap Airport (UDR).",
    faqs: [
      { question: "Are children allowed?", answer: "Yes, family and children are warmly welcome to all functions." },
      { question: "Is valet parking available?", answer: "Complimentary valet parking is available at Gate 1." },
    ],
    sessions: [
      {
        id: "sess_mehendi",
        eventId: "evt_sharma_wedding_2026",
        name: "Mehendi & High Tea",
        description: "Vibrant afternoon of henna, music, and Rajasthani high tea.",
        startTime: "2026-10-24T15:00:00Z",
        endTime: "2026-10-24T19:00:00Z",
        venueName: "Poolside Lawns",
        venueAddress: "Taj Aravali Resort, Udaipur",
        dressCode: "Pastels & Floral Ethnic",
        capacity: 250,
      },
      {
        id: "sess_sangeet",
        eventId: "evt_sharma_wedding_2026",
        name: "Sangeet Extravaganza",
        description: "An evening of dance performances, music, and cocktail dinner.",
        startTime: "2026-10-24T20:00:00Z",
        endTime: "2026-10-25T01:00:00Z",
        venueName: "Grand Ballroom",
        dressCode: "Glamorous Evening / Indo-Western",
        capacity: 350,
      },
      {
        id: "sess_wedding",
        eventId: "evt_sharma_wedding_2026",
        name: "Traditional Pheras & Wedding",
        description: "Baraat procession followed by auspicious Vedic ceremony.",
        startTime: "2026-10-25T17:00:00Z",
        endTime: "2026-10-25T21:30:00Z",
        venueName: "Aravali Open Amphitheatre",
        dressCode: "Royal Traditional (Sherwanis & Sarees)",
        capacity: 350,
      },
      {
        id: "sess_reception",
        eventId: "evt_sharma_wedding_2026",
        name: "Gala Reception Dinner",
        description: "Formal dinner welcoming the newlyweds.",
        startTime: "2026-10-26T19:30:00Z",
        endTime: "2026-10-26T23:30:00Z",
        venueName: "The Royal Meadow",
        dressCode: "Black Tie / Formal Ethnic",
        capacity: 400,
      },
    ],
    checkInConfig: {
      allowMultipleEntries: true,
      requirePassVerification: true,
      activeGates: ["Gate 1 (Main Entrance)", "Gate 2 (VIP/Valet)", "Gate 3 (Ballroom Direct)"],
    },
    totalGuestsCount: 350,
    confirmedGuestsCount: 268,
    createdAt: "2026-08-01T10:00:00Z",
    updatedAt: "2026-09-20T14:30:00Z",
  },
  {
    id: "evt_nexus_summit_2026",
    organizationId: "org_biz_aura_001",
    name: "Nexus B2B Tech Leadership Summit",
    category: "conference",
    status: "upcoming",
    description: "Annual invitation-only conference for SaaS and AI founders and enterprise leaders.",
    startDate: "2026-11-12T09:00:00Z",
    endDate: "2026-11-12T20:00:00Z",
    rsvpDeadline: "2026-11-01T23:59:00Z",
    venue: {
      name: "Grand Hyatt Mumbai Hotel & Residences",
      address: "Bandra Kurla Complex Vicinity, Mumbai",
      city: "Mumbai, Maharashtra",
      googleMapsUrl: "https://maps.google.com/?q=Grand+Hyatt+Mumbai",
      gateNotes: "Convention Centre Entrance via Gate 4.",
    },
    hosts: [{ name: "Nexus Ventures Board", relationship: "Organizing Committee", phone: "+91 22 6676 1234" }],
    contactPersons: [{ name: "Ananya Iyer", role: "Delegate Relations", phone: "+91 98200 44556" }],
    languages: ["English"],
    dressCode: "Business Formal",
    sessions: [
      {
        id: "sess_nexus_keynote",
        eventId: "evt_nexus_summit_2026",
        name: "Opening Keynote & Strategic Panels",
        startTime: "2026-11-12T09:30:00Z",
        endTime: "2026-11-12T13:00:00Z",
        venueName: "Grand Ballroom A",
        capacity: 450,
      },
      {
        id: "sess_nexus_networking",
        eventId: "evt_nexus_summit_2026",
        name: "Founders Lounge & Gala Dinner",
        startTime: "2026-11-12T18:00:00Z",
        endTime: "2026-11-12T21:00:00Z",
        venueName: "Hyatt Lawn Pavilion",
        capacity: 450,
      },
    ],
    checkInConfig: {
      allowMultipleEntries: false,
      requirePassVerification: true,
      activeGates: ["Convention Gate A", "VIP Registration Desk"],
    },
    totalGuestsCount: 420,
    confirmedGuestsCount: 310,
    createdAt: "2026-08-15T12:00:00Z",
    updatedAt: "2026-09-18T11:00:00Z",
  },
];

export const MOCK_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: "tmpl_wedding_invite_official",
    name: "wedding_official_invite_v1",
    language: "en",
    category: "MARKETING",
    approvalStatus: "APPROVED",
    headerType: "IMAGE",
    headerContent: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80",
    bodyText:
      "Namaste {{guest_name}} ji,\n\nWith great joy, the Sharma and Verma families invite you to celebrate the wedding celebrations of Priya & Siddharth in Udaipur from {{start_date}}.\n\nVenue: {{venue_name}}\n\nKindly confirm your RSVP by {{rsvp_deadline}} to help us arrange your hospitality.",
    footerText: "BizInvite Hospitality Concierge",
    variables: ["guest_name", "start_date", "venue_name", "rsvp_deadline"],
    buttons: [
      { type: "QUICK_REPLY", text: "Accept & RSVP", payload: "ACTION_RSVP_YES" },
      { type: "QUICK_REPLY", text: "Decline with Regrets", payload: "ACTION_RSVP_NO" },
      { type: "URL", text: "View Itinerary & Venue", url: "https://maps.google.com" },
    ],
  },
  {
    id: "tmpl_rsvp_gentle_reminder",
    name: "rsvp_reminder_gentle_v2",
    language: "en",
    category: "UTILITY",
    approvalStatus: "APPROVED",
    headerType: "NONE",
    bodyText:
      "Dear {{guest_name}},\n\nThis is a gentle reminder regarding the RSVP for {{event_name}}. The deadline is tomorrow ({{rsvp_deadline}}).\n\nPlease let us know if you and your family will be joining us so we can finalize accommodations and guest seating.",
    footerText: "Reply below or contact our hospitality desk",
    variables: ["guest_name", "event_name", "rsvp_deadline"],
    buttons: [
      { type: "QUICK_REPLY", text: "Yes, I am Attending", payload: "ACTION_RSVP_YES" },
      { type: "QUICK_REPLY", text: "Unable to Attend", payload: "ACTION_RSVP_NO" },
      { type: "QUICK_REPLY", text: "Need 24h More", payload: "ACTION_RSVP_MAYBE" },
    ],
  },
  {
    id: "tmpl_digital_pass_delivery",
    name: "guest_digital_pass_qr_v1",
    language: "en",
    category: "UTILITY",
    approvalStatus: "APPROVED",
    headerType: "TEXT",
    headerContent: "Your Official Digital Entry Pass",
    bodyText:
      "Dear {{guest_name}},\n\nYour digital entry pass for {{event_name}} is ready! Please display the QR code at Gate Entry for seamless priority check-in.\n\nPass Code: {{pass_code}}\nValid For: {{pax_count}} Guests\nVenue: {{venue_name}}",
    footerText: "Present this pass on your phone upon arrival",
    variables: ["guest_name", "event_name", "pass_code", "pax_count", "venue_name"],
    buttons: [
      { type: "URL", text: "Open My QR Pass", url: "https://bizinvite.io/pass/sample" },
      { type: "PHONE_NUMBER", text: "Call Valet/Concierge", payload: "+919820099881" },
    ],
  },
  {
    id: "tmpl_venue_directions",
    name: "venue_route_and_gate_info",
    language: "en",
    category: "UTILITY",
    approvalStatus: "APPROVED",
    headerType: "NONE",
    bodyText:
      "Hello {{guest_name}},\n\nHere are the live driving directions and valet gate information for today's function: {{session_name}}.\n\nGate: Gate 2 VIP Porch\nValet: Complimentary",
    footerText: "Sharma-Verma Wedding",
    variables: ["guest_name", "session_name"],
    buttons: [{ type: "URL", text: "Open Google Maps", url: "https://maps.google.com" }],
  },
  {
    id: "tmpl_unapproved_sample",
    name: "promotional_discount_v1",
    language: "en",
    category: "MARKETING",
    approvalStatus: "PENDING",
    bodyText: "This is a pending promotional template. It is awaiting Meta WhatsApp review and CANNOT be used in active campaigns.",
    variables: ["guest_name"],
    buttons: [],
  },
];

export const MOCK_GUESTS: Guest[] = [
  {
    id: "gst_001",
    organizationId: "org_biz_aura_001",
    eventId: "evt_sharma_wedding_2026",
    name: "Sunil & Radhika Singhania",
    mobile: "+919820112233",
    email: "sunil.singhania@corp.in",
    familyGroupName: "Singhania Family",
    category: "VVIP",
    isVip: true,
    city: "Mumbai",
    preferredLanguage: "English",
    invitedSessionIds: ["sess_mehendi", "sess_sangeet", "sess_wedding", "sess_reception"],
    allowedCompanions: 3,
    confirmedCompanions: 2,
    relationshipWithHost: "Close Childhood Friend of Groom's Father",
    assignedRelationshipManager: "Simran Kaur",
    consentSource: "csv_import",
    consentTimestamp: "2026-08-10T12:00:00Z",
    rsvpStatus: "attending",
    rsvpResponseTime: "2026-09-02T14:15:00Z",
    reminderStatus: "suppressed",
    checkInStatus: "checked_in",
    checkedInAt: "2026-09-23T10:15:00Z",
    checkedInCount: 3,
    notes: "Requires ground floor suite accommodation; strict Jain meals.",
    createdAt: "2026-08-10T12:00:00Z",
    updatedAt: "2026-09-23T10:15:00Z",
  },
  {
    id: "gst_002",
    organizationId: "org_biz_aura_001",
    eventId: "evt_sharma_wedding_2026",
    name: "Vikramaditya Roy",
    mobile: "+919811099887",
    email: "v.roy@royholdings.com",
    familyGroupName: "Roy Family",
    category: "VIP",
    isVip: true,
    city: "Kolkata",
    preferredLanguage: "English",
    invitedSessionIds: ["sess_sangeet", "sess_wedding", "sess_reception"],
    allowedCompanions: 1,
    confirmedCompanions: 1,
    relationshipWithHost: "College Roommate of Bride's Father",
    assignedRelationshipManager: "Rohan Varma",
    consentSource: "csv_import",
    consentTimestamp: "2026-08-10T12:00:00Z",
    rsvpStatus: "attending",
    rsvpResponseTime: "2026-09-05T09:30:00Z",
    reminderStatus: "suppressed",
    checkInStatus: "not_checked_in",
    notes: "Arriving on Oct 24 afternoon flight at Udaipur.",
    createdAt: "2026-08-10T12:00:00Z",
    updatedAt: "2026-09-05T09:30:00Z",
  },
  {
    id: "gst_003",
    organizationId: "org_biz_aura_001",
    eventId: "evt_sharma_wedding_2026",
    name: "Dr. Arvind & Neena Swaminathan",
    mobile: "+919840055443",
    email: "arvind.swami@apollo.org",
    familyGroupName: "Swaminathan Family",
    category: "Family",
    isVip: false,
    city: "Chennai",
    preferredLanguage: "English",
    invitedSessionIds: ["sess_wedding", "sess_reception"],
    allowedCompanions: 2,
    confirmedCompanions: 0,
    relationshipWithHost: "Paternal Uncle & Aunt",
    consentSource: "manual_entry",
    consentTimestamp: "2026-08-12T10:00:00Z",
    rsvpStatus: "no_response",
    reminderStatus: "scheduled",
    checkInStatus: "not_checked_in",
    notes: "Follow up via telephone if no WhatsApp response by Oct 8.",
    createdAt: "2026-08-12T10:00:00Z",
    updatedAt: "2026-08-12T10:00:00Z",
  },
  {
    id: "gst_004",
    organizationId: "org_biz_aura_001",
    eventId: "evt_sharma_wedding_2026",
    name: "Meera Oberoi",
    mobile: "+919810144332",
    email: "meera.oberoi@oberoi.in",
    category: "Friend",
    isVip: false,
    city: "New Delhi",
    preferredLanguage: "Hindi",
    invitedSessionIds: ["sess_mehendi", "sess_sangeet", "sess_wedding", "sess_reception"],
    allowedCompanions: 1,
    confirmedCompanions: 0,
    relationshipWithHost: "Bride's School Friend",
    consentSource: "csv_import",
    consentTimestamp: "2026-08-10T12:00:00Z",
    rsvpStatus: "declined",
    rsvpResponseTime: "2026-09-12T18:40:00Z",
    reminderStatus: "suppressed",
    checkInStatus: "not_checked_in",
    notes: "Traveling overseas during wedding dates; sent congratulations.",
    createdAt: "2026-08-10T12:00:00Z",
    updatedAt: "2026-09-12T18:40:00Z",
  },
  {
    id: "gst_005",
    organizationId: "org_biz_aura_001",
    eventId: "evt_sharma_wedding_2026",
    name: "Anand & Shreya Mittal",
    mobile: "+919871188229",
    familyGroupName: "Mittal Group",
    category: "Corporate",
    isVip: true,
    city: "Gurugram",
    preferredLanguage: "English",
    invitedSessionIds: ["sess_sangeet", "sess_wedding", "sess_reception"],
    allowedCompanions: 2,
    confirmedCompanions: 1,
    relationshipWithHost: "Managing Director, Partner Firm",
    assignedRelationshipManager: "Kabir Malhotra",
    consentSource: "csv_import",
    consentTimestamp: "2026-08-10T12:00:00Z",
    rsvpStatus: "maybe",
    rsvpResponseTime: "2026-09-15T11:20:00Z",
    reminderStatus: "scheduled",
    checkInStatus: "not_checked_in",
    notes: "Awaiting board meeting confirmation.",
    createdAt: "2026-08-10T12:00:00Z",
    updatedAt: "2026-09-15T11:20:00Z",
  },
  {
    id: "gst_006",
    organizationId: "org_biz_aura_001",
    eventId: "evt_sharma_wedding_2026",
    name: "Karan Johar Bindra",
    mobile: "+919820077665",
    category: "Friend",
    isVip: false,
    city: "Mumbai",
    preferredLanguage: "Hindi",
    invitedSessionIds: ["sess_sangeet", "sess_reception"],
    allowedCompanions: 1,
    confirmedCompanions: 1,
    relationshipWithHost: "Groom's University Peer",
    consentSource: "csv_import",
    consentTimestamp: "2026-08-10T12:00:00Z",
    rsvpStatus: "attending",
    rsvpResponseTime: "2026-09-03T16:00:00Z",
    reminderStatus: "suppressed",
    checkInStatus: "checked_in",
    checkedInAt: "2026-09-23T09:45:00Z",
    checkedInCount: 2,
    createdAt: "2026-08-10T12:00:00Z",
    updatedAt: "2026-09-23T09:45:00Z",
  },
  {
    id: "gst_007",
    organizationId: "org_biz_aura_001",
    eventId: "evt_sharma_wedding_2026",
    name: "Rajesh & Kavita Jindal",
    mobile: "+919930011224",
    familyGroupName: "Jindal Family",
    category: "VIP",
    isVip: true,
    city: "Jaipur",
    preferredLanguage: "Hindi",
    invitedSessionIds: ["sess_mehendi", "sess_sangeet", "sess_wedding", "sess_reception"],
    allowedCompanions: 2,
    confirmedCompanions: 0,
    relationshipWithHost: "Family Business Associate",
    consentSource: "csv_import",
    consentTimestamp: "2026-08-10T12:00:00Z",
    rsvpStatus: "no_response",
    reminderStatus: "failed",
    checkInStatus: "not_checked_in",
    notes: "WhatsApp delivery failed; phone number may need +91 verification.",
    createdAt: "2026-08-10T12:00:00Z",
    updatedAt: "2026-09-18T10:00:00Z",
  },
];

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: "cmp_001",
    organizationId: "org_biz_aura_001",
    eventId: "evt_sharma_wedding_2026",
    eventName: "Sharma & Verma Grand Wedding",
    name: "Wave 1: VVIP & Family Official Invitations",
    templateId: "tmpl_wedding_invite_official",
    templateName: "wedding_official_invite_v1",
    status: "completed",
    targetSegment: { category: "VVIP", onlyVip: true },
    scheduledFor: "2026-08-20T10:00:00Z",
    startedAt: "2026-08-20T10:00:00Z",
    completedAt: "2026-08-20T10:45:00Z",
    metrics: {
      totalTargeted: 85,
      sent: 85,
      delivered: 84,
      read: 81,
      failed: 1,
      suppressed: 0,
    },
    createdAt: "2026-08-18T15:00:00Z",
  },
  {
    id: "cmp_002",
    organizationId: "org_biz_aura_001",
    eventId: "evt_sharma_wedding_2026",
    eventName: "Sharma & Verma Grand Wedding",
    name: "Wave 2: General & Corporate Invitations",
    templateId: "tmpl_wedding_invite_official",
    templateName: "wedding_official_invite_v1",
    status: "running",
    targetSegment: { category: "General" },
    scheduledFor: "2026-09-22T09:00:00Z",
    startedAt: "2026-09-22T09:00:00Z",
    metrics: {
      totalTargeted: 240,
      sent: 220,
      delivered: 212,
      read: 184,
      failed: 4,
      suppressed: 16,
    },
    createdAt: "2026-09-20T11:00:00Z",
  },
  {
    id: "cmp_003",
    organizationId: "org_biz_aura_001",
    eventId: "evt_sharma_wedding_2026",
    eventName: "Sharma & Verma Grand Wedding",
    name: "RSVP 72-Hour Countdown Alert",
    templateId: "tmpl_rsvp_gentle_reminder",
    templateName: "rsvp_reminder_gentle_v2",
    status: "scheduled",
    targetSegment: { rsvpStatus: "no_response" },
    scheduledFor: "2026-10-07T10:00:00Z",
    metrics: {
      totalTargeted: 62,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      suppressed: 0,
    },
    createdAt: "2026-09-22T16:00:00Z",
  },
];

export const MOCK_REMINDER_RULES: ReminderRule[] = [
  {
    id: "rem_001",
    organizationId: "org_biz_aura_001",
    eventId: "evt_sharma_wedding_2026",
    name: "T-48H RSVP Deadline Push",
    reminderType: "rsvp_deadline",
    triggerType: "relative_to_deadline",
    relativeTo: "rsvp_deadline",
    offsetMinutes: -2880, // 48 hours before
    targetFilters: {
      rsvpStatuses: ["no_response", "maybe"],
      onlyVip: false,
    },
    channel: "whatsapp",
    templateId: "tmpl_rsvp_gentle_reminder",
    templateName: "rsvp_reminder_gentle_v2",
    maximumAttempts: 2,
    quietHours: { enabled: true, start: "21:00", end: "09:00" },
    requiresApproval: true,
    fallbackChannel: "sms",
    stopConditions: ["rsvp_received", "opt_out", "max_attempts"],
    escalationRule: { enabled: true, assignToRMAfterHours: 24 },
    status: "active",
    audienceCount: 62,
    estimatedCost: 186, // ~₹3 per WhatsApp utility conversation
    sentCount: 0,
    deliveredCount: 0,
    readCount: 0,
    suppressedCount: 28, // Already auto-suppressed because guests RSVPed
    createdAt: "2026-09-01T12:00:00Z",
  },
  {
    id: "rem_002",
    organizationId: "org_biz_aura_001",
    eventId: "evt_sharma_wedding_2026",
    name: "Eve of Event Arrival & Concierge Welcome",
    reminderType: "event_eve",
    triggerType: "relative_to_event",
    relativeTo: "event_start",
    offsetMinutes: -1440, // 24 hours before
    targetFilters: {
      rsvpStatuses: ["attending"],
    },
    channel: "whatsapp",
    templateId: "tmpl_digital_pass_delivery",
    templateName: "guest_digital_pass_qr_v1",
    maximumAttempts: 1,
    quietHours: { enabled: true, start: "22:00", end: "08:00" },
    requiresApproval: false,
    fallbackChannel: "none",
    stopConditions: ["opt_out"],
    status: "active",
    audienceCount: 268,
    estimatedCost: 804,
    sentCount: 0,
    deliveredCount: 0,
    readCount: 0,
    suppressedCount: 0,
    createdAt: "2026-09-05T14:00:00Z",
  },
];

export const MOCK_RSVPS: RSVPRecord[] = [
  {
    id: "rsvp_001",
    guestId: "gst_001",
    guestName: "Sunil & Radhika Singhania",
    guestMobile: "+919820112233",
    eventId: "evt_sharma_wedding_2026",
    status: "attending",
    attendingCount: 3,
    companionsCount: 2,
    attendingSessionIds: ["sess_mehendi", "sess_sangeet", "sess_wedding", "sess_reception"],
    requirements: {
      dietaryPreference: "jain",
      dietaryNotes: "Strict Jain food for all 3 members without root vegetables.",
      needsAccommodation: true,
      accommodationNotes: "Taj Aravali Room 104 allocated.",
      needsTransport: true,
      arrivalDetails: "Flight 6E-241 arriving Oct 24 at 11:30 AM",
      specialRequests: "Wheelchair assistance needed at Amphitheatre.",
    },
    source: "whatsapp_quick_reply",
    respondedAt: "2026-09-02T14:15:00Z",
  },
  {
    id: "rsvp_002",
    guestId: "gst_002",
    guestName: "Vikramaditya Roy",
    guestMobile: "+919811099887",
    eventId: "evt_sharma_wedding_2026",
    status: "attending",
    attendingCount: 2,
    companionsCount: 1,
    attendingSessionIds: ["sess_sangeet", "sess_wedding", "sess_reception"],
    requirements: {
      dietaryPreference: "non_vegetarian",
      needsAccommodation: true,
      needsTransport: false,
    },
    source: "whatsapp_quick_reply",
    respondedAt: "2026-09-05T09:30:00Z",
  },
  {
    id: "rsvp_003",
    guestId: "gst_004",
    guestName: "Meera Oberoi",
    guestMobile: "+919810144332",
    eventId: "evt_sharma_wedding_2026",
    status: "declined",
    attendingCount: 0,
    companionsCount: 0,
    attendingSessionIds: [],
    requirements: {
      specialRequests: "Sending gifts directly to residence with warm regards.",
    },
    source: "whatsapp_quick_reply",
    respondedAt: "2026-09-12T18:40:00Z",
  },
  {
    id: "rsvp_004",
    guestId: "gst_005",
    guestName: "Anand & Shreya Mittal",
    guestMobile: "+919871188229",
    eventId: "evt_sharma_wedding_2026",
    status: "maybe",
    attendingCount: 2,
    companionsCount: 1,
    attendingSessionIds: ["sess_wedding", "sess_reception"],
    requirements: {
      dietaryPreference: "vegetarian",
      needsAccommodation: false,
    },
    source: "phone_call",
    respondedAt: "2026-09-15T11:20:00Z",
    updatedBy: "Kabir Malhotra",
  },
];

export const MOCK_PASSES: DigitalPass[] = [
  {
    id: "pass_001",
    passCode: "BIZ-2026-X79K",
    organizationId: "org_biz_aura_001",
    eventId: "evt_sharma_wedding_2026",
    eventName: "Sharma & Verma Grand Wedding",
    guestId: "gst_001",
    guestName: "Sunil & Radhika Singhania",
    guestMobile: "+919820112233",
    category: "VVIP",
    isVip: true,
    allowedPax: 3,
    admittedPax: 3,
    status: "used",
    validSessions: ["sess_mehendi", "sess_sangeet", "sess_wedding", "sess_reception"],
    signedToken: "biz_sig_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.pass_001_singhania_sec.789d98s",
    qrPayloadUrl: "https://api.bizinvite.io/qr/BIZ-2026-X79K",
    deliveryStatus: "delivered",
    lastSentAt: "2026-09-22T10:00:00Z",
    createdAt: "2026-09-02T14:16:00Z",
  },
  {
    id: "pass_002",
    passCode: "BIZ-2026-A12B",
    organizationId: "org_biz_aura_001",
    eventId: "evt_sharma_wedding_2026",
    eventName: "Sharma & Verma Grand Wedding",
    guestId: "gst_002",
    guestName: "Vikramaditya Roy",
    guestMobile: "+919811099887",
    category: "VIP",
    isVip: true,
    allowedPax: 2,
    admittedPax: 0,
    status: "active",
    validSessions: ["sess_sangeet", "sess_wedding", "sess_reception"],
    signedToken: "biz_sig_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.pass_002_roy_sec.443k09q",
    qrPayloadUrl: "https://api.bizinvite.io/qr/BIZ-2026-A12B",
    deliveryStatus: "delivered",
    lastSentAt: "2026-09-22T10:00:00Z",
    createdAt: "2026-09-05T09:31:00Z",
  },
  {
    id: "pass_003",
    passCode: "BIZ-2026-K99Z",
    organizationId: "org_biz_aura_001",
    eventId: "evt_sharma_wedding_2026",
    eventName: "Sharma & Verma Grand Wedding",
    guestId: "gst_006",
    guestName: "Karan Johar Bindra",
    guestMobile: "+919820077665",
    category: "Friend",
    isVip: false,
    allowedPax: 2,
    admittedPax: 2,
    status: "used",
    validSessions: ["sess_sangeet", "sess_reception"],
    signedToken: "biz_sig_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.pass_003_bindra_sec.112z55y",
    qrPayloadUrl: "https://api.bizinvite.io/qr/BIZ-2026-K99Z",
    deliveryStatus: "delivered",
    lastSentAt: "2026-09-22T10:05:00Z",
    createdAt: "2026-09-03T16:05:00Z",
  },
];

export const MOCK_CHECKIN_RECORDS: CheckInRecord[] = [
  {
    id: "chk_001",
    guestId: "gst_001",
    guestName: "Sunil & Radhika Singhania",
    guestMobile: "+919820112233",
    isVip: true,
    category: "VVIP",
    eventId: "evt_sharma_wedding_2026",
    gateId: "gate_1",
    gateName: "Gate 1 (Main Entrance)",
    paxAdmitted: 3,
    totalAllowedPax: 3,
    scannedAt: "2026-09-23T10:15:00Z",
    executiveName: "Pooja Hegde",
    status: "admitted",
  },
  {
    id: "chk_002",
    guestId: "gst_006",
    guestName: "Karan Johar Bindra",
    guestMobile: "+919820077665",
    isVip: false,
    category: "Friend",
    eventId: "evt_sharma_wedding_2026",
    gateId: "gate_2",
    gateName: "Gate 2 (VIP/Valet)",
    paxAdmitted: 2,
    totalAllowedPax: 2,
    scannedAt: "2026-09-23T09:45:00Z",
    executiveName: "Pooja Hegde",
    status: "admitted",
  },
];

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: "aud_001",
    organizationId: "org_biz_aura_001",
    userId: "usr_admin_01",
    userName: "Kabir Malhotra",
    userRole: "ORGANIZATION_OWNER",
    action: "CAMPAIGN_SCHEDULED",
    resourceType: "campaign",
    resourceId: "cmp_003",
    details: "Scheduled campaign 'RSVP 72-Hour Countdown Alert' for 62 recipients.",
    ipAddress: "115.240.90.12",
    timestamp: "2026-09-22T16:00:00Z",
  },
  {
    id: "aud_002",
    organizationId: "org_biz_aura_001",
    userId: "usr_event_01",
    userName: "Rohan Varma",
    userRole: "EVENT_ADMINISTRATOR",
    action: "RSVP_MANUALLY_UPDATED",
    resourceType: "rsvp",
    resourceId: "rsvp_004",
    details: "Updated RSVP status for Anand & Shreya Mittal to 'maybe' upon telephone confirmation.",
    ipAddress: "115.240.90.14",
    timestamp: "2026-09-15T11:20:00Z",
  },
  {
    id: "aud_003",
    organizationId: "org_biz_aura_001",
    userId: "usr_admin_01",
    userName: "Kabir Malhotra",
    userRole: "ORGANIZATION_OWNER",
    action: "GUESTS_BULK_IMPORTED",
    resourceType: "guest",
    resourceId: "evt_sharma_wedding_2026",
    details: "Imported 180 guests via CSV upload 'sharma_family_list.csv'.",
    ipAddress: "115.240.90.12",
    timestamp: "2026-08-10T12:00:00Z",
  },
];

export const MOCK_CONSENT_RECORDS: ConsentRecord[] = [
  {
    id: "con_001",
    guestId: "gst_001",
    guestName: "Sunil & Radhika Singhania",
    mobile: "+919820112233",
    channel: "whatsapp",
    status: "opted_in",
    source: "Family Host Authorized Import",
    timestamp: "2026-08-10T12:00:00Z",
  },
  {
    id: "con_002",
    guestId: "gst_004",
    guestName: "Meera Oberoi",
    mobile: "+919810144332",
    channel: "whatsapp",
    status: "opted_in",
    source: "Host Direct Invite Form",
    timestamp: "2026-08-10T12:00:00Z",
  },
  {
    id: "con_003",
    guestId: "gst_999",
    guestName: "Devendra Verma",
    mobile: "+919899001122",
    channel: "whatsapp",
    status: "opted_out",
    source: "WhatsApp 'STOP' reply",
    timestamp: "2026-08-25T14:30:00Z",
    optOutReason: "User replied STOP to automated invitation.",
  },
];

// Helper to simulate realistic async network delay
const delay = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock Adapter Class
class MockAdapter {
  private events = [...MOCK_EVENTS];
  private guests = [...MOCK_GUESTS];
  private campaigns = [...MOCK_CAMPAIGNS];
  private templates = [...MOCK_TEMPLATES];
  private reminderRules = [...MOCK_REMINDER_RULES];
  private rsvps = [...MOCK_RSVPS];
  private passes = [...MOCK_PASSES];
  private checkIns = [...MOCK_CHECKIN_RECORDS];
  private auditLogs = [...MOCK_AUDIT_LOGS];
  private consentRecords = [...MOCK_CONSENT_RECORDS];

  // Auth
  async login(email: string): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string; expiresIn: number } }> {
    await delay();
    const matched = MOCK_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase()) || MOCK_USERS[0];
    return {
      user: matched,
      tokens: {
        accessToken: `mock_jwt_access_${matched.id}_${Date.now()}`,
        refreshToken: `mock_jwt_refresh_${matched.id}_${Date.now()}`,
        expiresIn: 3600,
      },
    };
  }

  async getCurrentUser(): Promise<User> {
    await delay(50);
    return MOCK_USERS[0];
  }

  // Organization
  async getOrganization(): Promise<Organization> {
    await delay(50);
    return MOCK_ORGANIZATION;
  }

  async getTeamMembers() {
    await delay(100);
    return MOCK_USERS.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: "active" as const,
      createdAt: u.createdAt,
    }));
  }

  // Events
  async getEvents(): Promise<Event[]> {
    await delay();
    return this.events;
  }

  async getEventById(id: string): Promise<Event | null> {
    await delay();
    return this.events.find((e) => e.id === id) || null;
  }

  async createEvent(eventData: Partial<Event>): Promise<Event> {
    await delay(250);
    const newEvent: Event = {
      id: `evt_${Date.now()}`,
      organizationId: MOCK_ORGANIZATION.id,
      name: eventData.name || "Untitled Event",
      category: eventData.category || "wedding",
      status: eventData.status || "draft",
      description: eventData.description,
      startDate: eventData.startDate || new Date().toISOString(),
      endDate: eventData.endDate || new Date(Date.now() + 86400000).toISOString(),
      rsvpDeadline: eventData.rsvpDeadline || new Date(Date.now() + 43200000).toISOString(),
      venue: eventData.venue || { name: "TBD", address: "TBD", city: "TBD" },
      hosts: eventData.hosts || [],
      contactPersons: eventData.contactPersons || [],
      languages: eventData.languages || ["English"],
      dressCode: eventData.dressCode,
      sessions: eventData.sessions || [],
      checkInConfig: eventData.checkInConfig || {
        allowMultipleEntries: false,
        requirePassVerification: true,
        activeGates: ["Main Gate"],
      },
      totalGuestsCount: 0,
      confirmedGuestsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.events.unshift(newEvent);
    return newEvent;
  }

  async updateEvent(id: string, updates: Partial<Event>): Promise<Event> {
    await delay(200);
    const index = this.events.findIndex((e) => e.id === id);
    if (index === -1) throw new Error("Event not found");
    this.events[index] = { ...this.events[index], ...updates, updatedAt: new Date().toISOString() };
    return this.events[index];
  }

  // Guests
  async getGuests(eventId?: string, search?: string, filters?: { category?: string; isVip?: boolean; rsvpStatus?: string; checkInStatus?: string }): Promise<Guest[]> {
    await delay();
    let result = [...this.guests];
    if (eventId) result = result.filter((g) => g.eventId === eventId);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((g) => g.name.toLowerCase().includes(q) || g.mobile.includes(q) || (g.email && g.email.toLowerCase().includes(q)));
    }
    if (filters?.category) result = result.filter((g) => g.category === filters.category);
    if (filters?.isVip !== undefined) result = result.filter((g) => g.isVip === filters.isVip);
    if (filters?.rsvpStatus) result = result.filter((g) => g.rsvpStatus === filters.rsvpStatus);
    if (filters?.checkInStatus) result = result.filter((g) => g.checkInStatus === filters.checkInStatus);
    return result;
  }

  async addGuest(guestData: Partial<Guest>): Promise<Guest> {
    await delay(200);
    const newGuest: Guest = {
      id: `gst_${Date.now()}`,
      organizationId: MOCK_ORGANIZATION.id,
      eventId: guestData.eventId || this.events[0]?.id || "evt_sharma_wedding_2026",
      name: guestData.name || "Guest",
      mobile: guestData.mobile || "+919999999999",
      email: guestData.email,
      familyGroupName: guestData.familyGroupName,
      category: guestData.category || "General",
      isVip: guestData.isVip || false,
      city: guestData.city,
      preferredLanguage: guestData.preferredLanguage || "English",
      invitedSessionIds: guestData.invitedSessionIds || [],
      allowedCompanions: guestData.allowedCompanions || 0,
      confirmedCompanions: 0,
      relationshipWithHost: guestData.relationshipWithHost,
      assignedRelationshipManager: guestData.assignedRelationshipManager,
      consentSource: "manual_entry",
      consentTimestamp: new Date().toISOString(),
      rsvpStatus: "no_response",
      reminderStatus: "scheduled",
      checkInStatus: "not_checked_in",
      notes: guestData.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.guests.unshift(newGuest);
    return newGuest;
  }

  async updateGuest(id: string, updates: Partial<Guest>): Promise<Guest> {
    await delay(150);
    const index = this.guests.findIndex((g) => g.id === id);
    if (index === -1) throw new Error("Guest not found");
    this.guests[index] = { ...this.guests[index], ...updates, updatedAt: new Date().toISOString() };
    return this.guests[index];
  }

  // CSV Import Wizard Simulation
  async previewGuestImport(fileName: string, totalRows = 25): Promise<ImportPreviewResult> {
    await delay(400);
    return {
      importId: `imp_${Date.now()}`,
      totalRows,
      validRows: totalRows - 3,
      errorRows: 1,
      duplicateCount: 2,
      columnMappings: [
        { csvHeader: "Full Name", targetField: "name" },
        { csvHeader: "Mobile Number", targetField: "mobile" },
        { csvHeader: "Email Address", targetField: "email" },
        { csvHeader: "Guest Category", targetField: "category" },
        { csvHeader: "VIP Status (Y/N)", targetField: "isVip" },
        { csvHeader: "Allowed Pax", targetField: "allowedCompanions" },
        { csvHeader: "City", targetField: "city" },
      ],
      previewRows: [
        { "Full Name": "Harshvardhan Goenka", "Mobile Number": "+919820011999", "Email Address": "h.goenka@rpg.in", "Guest Category": "VVIP", "VIP Status (Y/N)": "Y", "Allowed Pax": "3", City: "Mumbai" },
        { "Full Name": "Ananya Birla", "Mobile Number": "+919811099111", "Email Address": "ananya@birla.org", "Guest Category": "VIP", "VIP Status (Y/N)": "Y", "Allowed Pax": "1", City: "Mumbai" },
        { "Full Name": "Suresh Trivedi", "Mobile Number": "9820000000", "Email Address": "suresh@trivedi.in", "Guest Category": "Family", "VIP Status (Y/N)": "N", "Allowed Pax": "2", City: "Jaipur" },
        { "Full Name": "Sunil Singhania", "Mobile Number": "+919820112233", "Email Address": "sunil.singhania@corp.in", "Guest Category": "VVIP", "VIP Status (Y/N)": "Y", "Allowed Pax": "3", City: "Mumbai" },
      ],
      validationIssues: [
        { rowNumber: 14, field: "mobile", message: "Mobile number has 9 digits instead of 10. Needs correction.", severity: "error" },
        { rowNumber: 18, field: "email", message: "Invalid email syntax format. Will be imported without email.", severity: "warning" },
      ],
      duplicates: [
        { rowNumber: 4, mobile: "+919820112233", name: "Sunil Singhania", existingGuestName: "Sunil & Radhika Singhania", action: "overwrite" },
        { rowNumber: 22, mobile: "+919820077665", name: "K. J. Bindra", existingGuestName: "Karan Johar Bindra", action: "skip" },
      ],
    };
  }

  async commitGuestImport(importId: string, count = 22): Promise<{ importedCount: number; updatedCount: number }> {
    await delay(500);
    return { importedCount: count - 2, updatedCount: 2 };
  }

  // WhatsApp Templates
  async getTemplates(): Promise<WhatsAppTemplate[]> {
    await delay(100);
    return this.templates;
  }

  // Campaigns
  async getCampaigns(eventId?: string): Promise<Campaign[]> {
    await delay(150);
    if (eventId) return this.campaigns.filter((c) => c.eventId === eventId);
    return this.campaigns;
  }

  async createCampaign(campaignData: Partial<Campaign>): Promise<Campaign> {
    await delay(300);
    const tmpl = this.templates.find((t) => t.id === campaignData.templateId);
    if (tmpl && tmpl.approvalStatus !== "APPROVED") {
      throw new Error("Cannot send an unapproved WhatsApp template.");
    }

    const newCampaign: Campaign = {
      id: `cmp_${Date.now()}`,
      organizationId: MOCK_ORGANIZATION.id,
      eventId: campaignData.eventId || this.events[0]?.id || "evt_sharma_wedding_2026",
      eventName: this.events.find((e) => e.id === campaignData.eventId)?.name || "Sharma & Verma Grand Wedding",
      name: campaignData.name || "New Campaign",
      templateId: campaignData.templateId || this.templates[0].id,
      templateName: tmpl?.name || "Template",
      status: campaignData.scheduledFor ? "scheduled" : "running",
      targetSegment: campaignData.targetSegment || {},
      scheduledFor: campaignData.scheduledFor,
      startedAt: campaignData.scheduledFor ? undefined : new Date().toISOString(),
      metrics: {
        totalTargeted: 150,
        sent: campaignData.scheduledFor ? 0 : 150,
        delivered: campaignData.scheduledFor ? 0 : 142,
        read: campaignData.scheduledFor ? 0 : 110,
        failed: 0,
        suppressed: 8,
      },
      createdAt: new Date().toISOString(),
    };
    this.campaigns.unshift(newCampaign);
    return newCampaign;
  }

  async pauseCampaign(id: string): Promise<Campaign> {
    await delay(150);
    const c = this.campaigns.find((c) => c.id === id);
    if (!c) throw new Error("Campaign not found");
    c.status = "paused";
    return c;
  }

  async resumeCampaign(id: string): Promise<Campaign> {
    await delay(150);
    const c = this.campaigns.find((c) => c.id === id);
    if (!c) throw new Error("Campaign not found");
    c.status = "running";
    return c;
  }

  // RSVPs
  async getRSVPs(eventId?: string): Promise<RSVPRecord[]> {
    await delay();
    if (eventId) return this.rsvps.filter((r) => r.eventId === eventId);
    return this.rsvps;
  }

  async getRSVPSummary(eventId?: string): Promise<RSVPSummary> {
    await delay(100);
    const rsvps = eventId ? this.rsvps.filter((r) => r.eventId === eventId) : this.rsvps;
    return {
      totalInvited: rsvps.length || 350,
      attending: rsvps.filter((r) => r.status === "attending").length || 268,
      declined: 32,
      maybe: 18,
      noResponse: 32,
      incomplete: 0,
      checkedIn: 184,
      noShow: 8,
      expectedFootfall: 520, // Primary + allowed companions
      totalCompanions: 252,
      dietaryCounts: {
        vegetarian: 180,
        non_vegetarian: 68,
        jain: 42,
        vegan: 12,
        other: 4,
      },
      accommodationRequestedCount: 94,
      transportRequestedCount: 78,
    };
  }

  async updateRSVP(guestId: string, status: RSVPStatus, count?: number, requirements?: RSVPRecord["requirements"]): Promise<RSVPRecord> {
    await delay(200);
    let record = this.rsvps.find((r) => r.guestId === guestId);
    if (!record) {
      const g = this.guests.find((g) => g.id === guestId);
      record = {
        id: `rsvp_${Date.now()}`,
        guestId,
        guestName: g?.name || "Guest",
        guestMobile: g?.mobile || "+919999999999",
        eventId: g?.eventId || this.events[0]?.id || "",
        status,
        attendingCount: count || 1,
        companionsCount: Math.max(0, (count || 1) - 1),
        attendingSessionIds: g?.invitedSessionIds || [],
        requirements: requirements || {},
        source: "manual_staff_entry",
        respondedAt: new Date().toISOString(),
        updatedBy: "Staff Organizer",
      };
      this.rsvps.push(record);
    } else {
      record.status = status;
      if (count !== undefined) {
        record.attendingCount = count;
        record.companionsCount = Math.max(0, count - 1);
      }
      if (requirements) record.requirements = { ...record.requirements, ...requirements };
      record.updatedBy = "Staff Organizer";
    }

    // Also update guest entity rsvpStatus & auto-suppress reminders if attending/declined!
    const gIndex = this.guests.findIndex((g) => g.id === guestId);
    if (gIndex !== -1) {
      this.guests[gIndex].rsvpStatus = status;
      if (status === "attending" || status === "declined") {
        this.guests[gIndex].reminderStatus = "suppressed"; // Automatic suppression requirement
      }
    }

    return record;
  }

  // Reminders
  async getReminderRules(eventId?: string): Promise<ReminderRule[]> {
    await delay();
    if (eventId) return this.reminderRules.filter((r) => r.eventId === eventId);
    return this.reminderRules;
  }

  async createReminderRule(ruleData: Partial<ReminderRule>): Promise<ReminderRule> {
    await delay(250);
    const newRule: ReminderRule = {
      id: `rem_${Date.now()}`,
      organizationId: MOCK_ORGANIZATION.id,
      eventId: ruleData.eventId || this.events[0]?.id || "evt_sharma_wedding_2026",
      name: ruleData.name || "Reminder Rule",
      reminderType: ruleData.reminderType || "rsvp_deadline",
      triggerType: ruleData.triggerType || "relative_to_deadline",
      relativeTo: ruleData.relativeTo || "rsvp_deadline",
      offsetMinutes: ruleData.offsetMinutes || -2880,
      targetFilters: ruleData.targetFilters || { rsvpStatuses: ["no_response"] },
      channel: "whatsapp",
      templateId: ruleData.templateId || this.templates[1].id,
      templateName: this.templates.find((t) => t.id === ruleData.templateId)?.name,
      maximumAttempts: ruleData.maximumAttempts || 2,
      quietHours: ruleData.quietHours || { enabled: true, start: "21:00", end: "09:00" },
      requiresApproval: ruleData.requiresApproval !== undefined ? ruleData.requiresApproval : true,
      fallbackChannel: ruleData.fallbackChannel || "none",
      stopConditions: ["rsvp_received", "opt_out", "max_attempts"],
      status: "active",
      audienceCount: 45,
      estimatedCost: 135,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      suppressedCount: 12,
      createdAt: new Date().toISOString(),
    };
    this.reminderRules.unshift(newRule);
    return newRule;
  }

  // Digital Passes
  async getPasses(eventId?: string): Promise<DigitalPass[]> {
    await delay();
    if (eventId) return this.passes.filter((p) => p.eventId === eventId);
    return this.passes;
  }

  async resendPass(id: string): Promise<{ success: boolean; message: string }> {
    await delay(200);
    const pass = this.passes.find((p) => p.id === id);
    if (pass) {
      pass.deliveryStatus = "delivered";
      pass.lastSentAt = new Date().toISOString();
    }
    return { success: true, message: "Pass resent via WhatsApp successfully." };
  }

  async revokePass(id: string): Promise<DigitalPass> {
    await delay(200);
    const pass = this.passes.find((p) => p.id === id);
    if (!pass) throw new Error("Pass not found");
    pass.status = "revoked";
    return pass;
  }

  // Check-In
  async scanQRCode(qrData: string, gateId: string, paxCount = 1): Promise<CheckInResponse> {
    await delay(300);

    // Look for pass matching code or token
    const pass = this.passes.find(
      (p) => p.passCode.toLowerCase() === qrData.trim().toLowerCase() || p.signedToken === qrData.trim() || p.qrPayloadUrl.includes(qrData.trim())
    );

    if (!pass) {
      // Also check mobile lookup or guest ID
      const guest = this.guests.find((g) => g.mobile.includes(qrData.trim()) || g.id === qrData.trim());
      if (guest) {
        return this.manualCheckIn(guest.id, gateId, paxCount);
      }

      return {
        success: false,
        isDuplicate: false,
        message: "Invalid or unrecognized QR pass token.",
      };
    }

    if (pass.status === "revoked") {
      return {
        success: false,
        isDuplicate: false,
        message: "This digital pass has been revoked by event organizers.",
      };
    }

    // Check duplicate check-in warning
    const previousCheckIn = this.checkIns.find((c) => c.guestId === pass.guestId);
    if (previousCheckIn) {
      return {
        success: false,
        isDuplicate: true,
        message: `DUPLICATE ENTRY DETECTED! Guest was already admitted at ${new Date(previousCheckIn.scannedAt).toLocaleTimeString()} at ${previousCheckIn.gateName}.`,
        guest: {
          id: pass.guestId,
          name: pass.guestName,
          mobile: pass.guestMobile,
          isVip: pass.isVip,
          category: pass.category,
          allowedPax: pass.allowedPax,
          alreadyCheckedInPax: pass.admittedPax,
          previousCheckInAt: previousCheckIn.scannedAt,
          previousGate: previousCheckIn.gateName,
        },
      };
    }

    // Admitted successfully
    pass.admittedPax = paxCount;
    pass.status = "used";

    const record: CheckInRecord = {
      id: `chk_${Date.now()}`,
      guestId: pass.guestId,
      guestName: pass.guestName,
      guestMobile: pass.guestMobile,
      isVip: pass.isVip,
      category: pass.category,
      eventId: pass.eventId,
      gateId,
      gateName: gateId === "gate_2" ? "Gate 2 (VIP/Valet)" : "Gate 1 (Main Entrance)",
      paxAdmitted: paxCount,
      totalAllowedPax: pass.allowedPax,
      scannedAt: new Date().toISOString(),
      executiveName: "Current Operator",
      status: "admitted",
    };

    this.checkIns.unshift(record);

    // Update guest record
    const gIndex = this.guests.findIndex((g) => g.id === pass.guestId);
    if (gIndex !== -1) {
      this.guests[gIndex].checkInStatus = "checked_in";
      this.guests[gIndex].checkedInAt = record.scannedAt;
      this.guests[gIndex].checkedInCount = paxCount;
    }

    return {
      success: true,
      isDuplicate: false,
      message: `Verified! Admitted ${paxCount} guest(s) for ${pass.guestName}.`,
      guest: {
        id: pass.guestId,
        name: pass.guestName,
        mobile: pass.guestMobile,
        isVip: pass.isVip,
        category: pass.category,
        allowedPax: pass.allowedPax,
        alreadyCheckedInPax: paxCount,
      },
      record,
    };
  }

  async manualCheckIn(guestId: string, gateId: string, paxCount: number): Promise<CheckInResponse> {
    await delay(250);
    const guest = this.guests.find((g) => g.id === guestId);
    if (!guest) throw new Error("Guest not found");

    const previousCheckIn = this.checkIns.find((c) => c.guestId === guestId);
    if (previousCheckIn) {
      return {
        success: false,
        isDuplicate: true,
        message: `Duplicate check-in warning: Already admitted at ${previousCheckIn.gateName}.`,
        guest: {
          id: guest.id,
          name: guest.name,
          mobile: guest.mobile,
          isVip: guest.isVip,
          category: guest.category,
          allowedPax: guest.allowedCompanions + 1,
          alreadyCheckedInPax: guest.checkedInCount || 1,
          previousCheckInAt: previousCheckIn.scannedAt,
          previousGate: previousCheckIn.gateName,
        },
      };
    }

    const record: CheckInRecord = {
      id: `chk_${Date.now()}`,
      guestId: guest.id,
      guestName: guest.name,
      guestMobile: guest.mobile,
      isVip: guest.isVip,
      category: guest.category,
      eventId: guest.eventId,
      gateId,
      gateName: gateId === "gate_2" ? "Gate 2 (VIP/Valet)" : "Gate 1 (Main Entrance)",
      paxAdmitted: paxCount,
      totalAllowedPax: guest.allowedCompanions + 1,
      scannedAt: new Date().toISOString(),
      executiveName: "Current Operator",
      status: "admitted",
    };

    this.checkIns.unshift(record);
    guest.checkInStatus = "checked_in";
    guest.checkedInAt = record.scannedAt;
    guest.checkedInCount = paxCount;

    return {
      success: true,
      isDuplicate: false,
      message: `Manual check-in confirmed for ${guest.name} (${paxCount} Pax).`,
      guest: {
        id: guest.id,
        name: guest.name,
        mobile: guest.mobile,
        isVip: guest.isVip,
        category: guest.category,
        allowedPax: guest.allowedCompanions + 1,
        alreadyCheckedInPax: paxCount,
      },
      record,
    };
  }

  async getCheckInLiveSummary(eventId?: string): Promise<CheckInLiveSummary> {
    await delay(100);
    const eventScans = eventId ? this.checkIns.filter((c) => c.eventId === eventId) : this.checkIns;
    return {
      totalExpectedPax: 520,
      checkedInPax: eventScans.reduce((acc, c) => acc + c.paxAdmitted, 0) + 180,
      pendingPax: 335,
      recentScans: eventScans.slice(0, 10),
      gateBreakdown: [
        { gateId: "gate_1", gateName: "Gate 1 (Main Entrance)", count: 124 },
        { gateId: "gate_2", gateName: "Gate 2 (VIP/Valet)", count: 61 },
      ],
    };
  }

  // Reports
  async getInvitationFunnelReport(eventId?: string): Promise<InvitationFunnelReport> {
    await delay(100);
    return {
      eventId: eventId || "evt_sharma_wedding_2026",
      eventName: "Sharma & Verma Grand Wedding",
      totalGuests: 350,
      stages: [
        { stage: "Sent to WhatsApp", count: 325, percentage: 100 },
        { stage: "Delivered", count: 312, percentage: 96 },
        { stage: "Read / Opened", count: 284, percentage: 87 },
      ],
    };
  }

  async getRSVPFunnelReport(eventId?: string): Promise<RSVPFunnelReport> {
    await delay(100);
    return {
      eventId: eventId || "evt_sharma_wedding_2026",
      totalInvited: 350,
      attending: 268,
      declined: 32,
      maybe: 18,
      noResponse: 32,
      expectedFootfall: 520,
      responseRatePercentage: 91,
    };
  }

  async getAttendanceReport(eventId?: string): Promise<AttendanceReport> {
    await delay(100);
    return {
      eventId: eventId || "evt_sharma_wedding_2026",
      totalExpected: 520,
      actualCheckedIn: 185,
      turnoutPercentage: 35.5,
      peakEntryHour: "19:00 - 20:00",
      hourlyCheckIns: [
        { hour: "16:00", count: 12 },
        { hour: "17:00", count: 28 },
        { hour: "18:00", count: 45 },
        { hour: "19:00", count: 68 },
        { hour: "20:00", count: 32 },
      ],
    };
  }

  async getReminderConversionReport(eventId?: string): Promise<ReminderConversionReport> {
    await delay(100);
    return {
      eventId: eventId || "evt_sharma_wedding_2026",
      remindersSent: 110,
      rsvpsReceivedAfterReminder: 48,
      conversionRatePercentage: 43.6,
      savingsFromSuppressionCount: 74,
    };
  }

  async getDeliveryFailureReport(eventId?: string): Promise<DeliveryFailureReport> {
    await delay(100);
    return {
      eventId: eventId || "evt_sharma_wedding_2026",
      totalFailures: 7,
      failureReasons: [
        { reason: "INVALID_PHONE_NUMBER", count: 4, description: "Phone number not registered on WhatsApp or country code missing." },
        { reason: "USER_OPTED_OUT", count: 2, description: "Recipient opted out of marketing communications." },
        { reason: "RATE_LIMIT_DELAY", count: 1, description: "Transient network issue, queued for automated retry." },
      ],
      recentFailedRecipients: [
        { guestName: "Rajesh & Kavita Jindal", mobile: "+919930011224", campaignName: "Wave 2 Invitations", reason: "INVALID_PHONE_NUMBER", failedAt: "2026-09-22T09:12:00Z" },
        { guestName: "Devendra Verma", mobile: "+919899001122", campaignName: "Wave 1 Invitations", reason: "USER_OPTED_OUT", failedAt: "2026-08-25T14:30:00Z" },
      ],
    };
  }

  async getEventSummaryReport(eventId?: string): Promise<EventSummaryReport> {
    await delay(100);
    return {
      eventId: eventId || "evt_sharma_wedding_2026",
      eventName: "Sharma & Verma Grand Wedding",
      eventDates: "Oct 24 - 26, 2026",
      venueName: "Taj Aravali Resort & Spa, Udaipur",
      totalGuests: 350,
      invitationsDelivered: 312,
      deliveryRate: 89.1,
      attendingCount: 268,
      actualCheckedInPax: 185,
      turnoutRate: 69.0,
    };
  }

  // Audit Logs & Consent
  async getAuditLogs(): Promise<AuditLog[]> {
    await delay(100);
    return this.auditLogs;
  }

  async getConsentRecords(): Promise<ConsentRecord[]> {
    await delay(100);
    return this.consentRecords;
  }
}

export const mockAdapter = new MockAdapter();
