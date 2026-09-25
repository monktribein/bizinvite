import { User, Role } from "@/types/auth";
import { Organization, TeamMember, WhatsAppConnectionStatus } from "@/types/organization";
import { Event } from "@/types/event";
import { Guest, RSVPStatus, ImportPreviewResult } from "@/types/guest";
import {
  AudiencePreview,
  Campaign,
  CampaignRecipient,
  CampaignRecipientPage,
  CampaignTargetSegment,
  RecipientStatus,
  WhatsAppTemplate,
} from "@/types/campaign";
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
  logoUrl: "",
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
    email: "admin@bizinvite.com",
    name: "Kabir Malhotra",
    role: "ORGANIZATION_OWNER",
    organizationId: "org_biz_aura_001",
    organizationName: "Aura Events & Hospitality",
    status: "active",
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
    id: "usr_guest_01",
    email: "guestmanager@bizinvite.io",
    name: "Sunita Rao",
    role: "GUEST_MANAGER",
    organizationId: "org_biz_aura_001",
    organizationName: "Aura Events & Hospitality",
    createdAt: "2026-02-15T10:00:00Z",
  },
  {
    id: "usr_comms_01",
    email: "comms@bizinvite.io",
    name: "Aryan Kapoor",
    role: "COMMUNICATION_MANAGER",
    organizationId: "org_biz_aura_001",
    organizationName: "Aura Events & Hospitality",
    createdAt: "2026-02-20T10:00:00Z",
  },
  {
    id: "usr_checkin_01",
    email: "checkin@bizinvite.io",
    name: "Pooja Hegde",
    role: "CHECK_IN_EXECUTIVE",
    organizationId: "org_biz_aura_001",
    organizationName: "Aura Events & Hospitality",
    createdAt: "2026-03-01T10:00:00Z",
  },
  {
    id: "usr_viewer_01",
    email: "viewer@bizinvite.io",
    name: "Vikram Mehta",
    role: "READ_ONLY_VIEWER",
    organizationId: "org_biz_aura_001",
    organizationName: "Aura Events & Hospitality",
    createdAt: "2026-03-05T10:00:00Z",
  },
];

export const MOCK_USER_PASSWORDS: Record<string, string> = {
  "admin@bizinvite.com": "admin123",
  "admin@bizinvite.io": "admin123",
  "superadmin@bizinvite.io": "admin123",
  "eventmgr@bizinvite.io": "admin123",
  "guestmanager@bizinvite.io": "admin123",
  "comms@bizinvite.io": "admin123",
  "checkin@bizinvite.io": "admin123",
  "viewer@bizinvite.io": "admin123",
};

// Clean Collections (All dummy records removed)
export const MOCK_EVENTS: Event[] = [];
export const MOCK_GUESTS: Guest[] = [];
export const MOCK_CAMPAIGNS: Campaign[] = [];
export const MOCK_REMINDER_RULES: ReminderRule[] = [];
export const MOCK_RSVPS: RSVPRecord[] = [];
export const MOCK_PASSES: DigitalPass[] = [];
export const MOCK_CHECKIN_RECORDS: CheckInRecord[] = [];
export const MOCK_AUDIT_LOGS: AuditLog[] = [];
export const MOCK_CONSENT_RECORDS: ConsentRecord[] = [];

// Approved WhatsApp Templates available for selection
export const MOCK_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: "tmpl_official_invite",
    name: "official_event_invitation_v1",
    language: "en",
    category: "MARKETING",
    approvalStatus: "APPROVED",
    headerType: "IMAGE",
    headerContent: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&auto=format&fit=crop&q=80",
    bodyText:
      "Dear {{guest_name}},\n\nYou are cordially invited to attend {{event_name}} on {{start_date}} at {{venue_name}}.\n\nPlease confirm your attendance by {{rsvp_deadline}}.",
    footerText: "BizInvite Automated Concierge",
    variables: ["guest_name", "event_name", "start_date", "venue_name", "rsvp_deadline"],
    buttons: [
      { type: "QUICK_REPLY", text: "Accept & RSVP", payload: "ACTION_RSVP_YES" },
      { type: "QUICK_REPLY", text: "Decline with Regrets", payload: "ACTION_RSVP_NO" },
      { type: "URL", text: "View Venue Location", url: "https://maps.google.com" },
    ],
  },
  {
    id: "tmpl_rsvp_reminder",
    name: "rsvp_deadline_reminder_v1",
    language: "en",
    category: "UTILITY",
    approvalStatus: "APPROVED",
    headerType: "NONE",
    bodyText:
      "Hello {{guest_name}},\n\nThis is a friendly reminder that the RSVP deadline for {{event_name}} is approaching.\n\nKindly let us know if you will be attending so we can finalize logistics.",
    footerText: "BizInvite Automated Concierge",
    variables: ["guest_name", "event_name", "rsvp_deadline"],
    buttons: [
      { type: "QUICK_REPLY", text: "Attending", payload: "ACTION_RSVP_YES" },
      { type: "QUICK_REPLY", text: "Cannot Attend", payload: "ACTION_RSVP_NO" },
    ],
  },
  {
    id: "tmpl_pass_delivery",
    name: "digital_entry_pass_v1",
    language: "en",
    category: "UTILITY",
    approvalStatus: "APPROVED",
    headerType: "DOCUMENT",
    bodyText:
      "Hello {{guest_name}},\n\nYour digital pass for {{event_name}} is ready.\n\nPass Code: {{pass_code}}\nAdmit Pax: {{allowed_pax}}\nGate: {{active_gate}}\n\nPlease show this QR pass at the entrance gate for quick admission.",
    footerText: "BizInvite Access Control",
    variables: ["guest_name", "event_name", "pass_code", "allowed_pax", "active_gate"],
    buttons: [
      { type: "URL", text: "Open Digital QR Pass", url: "https://bizinvite.io/pass/sample" },
    ],
  },
];

// Helper to simulate realistic async network delay
const delay = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock Adapter Class
class MockAdapter {
  private events: Event[] = [];
  private guests: Guest[] = [];
  private campaigns: Campaign[] = [];
  private templates: WhatsAppTemplate[] = [...MOCK_TEMPLATES];
  private reminderRules: ReminderRule[] = [];
  private rsvps: RSVPRecord[] = [];
  private passes: DigitalPass[] = [];
  private checkIns: CheckInRecord[] = [];
  private auditLogs: AuditLog[] = [];
  private consentRecords: ConsentRecord[] = [];

  // Auth
  async login(
    email: string,
    password?: string
  ): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string; expiresIn: number } }> {
    await delay(120);
    const normalizedEmail = email.trim().toLowerCase();

    // Match by email or alias
    const matched = MOCK_USERS.find(
      (u) =>
        u.email.toLowerCase() === normalizedEmail ||
        (normalizedEmail === "admin@bizinvite.io" && u.email.toLowerCase() === "admin@bizinvite.com")
    );

    if (!matched) {
      throw new Error(`Account not found for ${email}. (Organization Owner is admin@bizinvite.com)`);
    }

    if (matched.status === "suspended") {
      throw new Error("This account has been suspended by the Organization Administrator. Access denied.");
    }

    const expectedPassword = MOCK_USER_PASSWORDS[matched.email.toLowerCase()] || "admin123";
    if (password && password !== expectedPassword) {
      throw new Error("Invalid password. Please enter the correct password (default: admin123).");
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("bizinvite_current_user_email", matched.email);
    }
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
    if (typeof window !== "undefined") {
      const savedEmail = localStorage.getItem("bizinvite_current_user_email");
      if (savedEmail) {
        const found = MOCK_USERS.find(
          (u) =>
            u.email.toLowerCase() === savedEmail.toLowerCase() ||
            (savedEmail.toLowerCase() === "admin@bizinvite.io" && u.email.toLowerCase() === "admin@bizinvite.com")
        );
        if (found) return found;
      }
    }
    return MOCK_USERS[0];
  }

  // Organization
  async getOrganization(): Promise<Organization> {
    await delay(50);
    return MOCK_ORGANIZATION;
  }

  async getTeamMembers(): Promise<TeamMember[]> {
    await delay(100);
    return MOCK_USERS.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status || "active",
      createdAt: u.createdAt,
    }));
  }

  async inviteTeamMember(data: { name: string; email: string; role: Role; password?: string }): Promise<TeamMember> {
    await delay(150);
    const normalizedEmail = data.email.trim().toLowerCase();
    const existingIndex = MOCK_USERS.findIndex((u) => u.email.toLowerCase() === normalizedEmail);

    if (existingIndex >= 0) {
      MOCK_USERS[existingIndex].name = data.name.trim();
      MOCK_USERS[existingIndex].role = data.role;
      if (data.password && data.password.trim()) {
        MOCK_USER_PASSWORDS[normalizedEmail] = data.password.trim();
      }
      return {
        id: MOCK_USERS[existingIndex].id,
        name: data.name,
        email: data.email,
        role: data.role,
        status: MOCK_USERS[existingIndex].status || "active",
        createdAt: MOCK_USERS[existingIndex].createdAt,
      };
    }

    const newUser: User = {
      id: `usr_staff_${Date.now()}`,
      email: normalizedEmail,
      name: data.name.trim(),
      role: data.role,
      status: "active",
      organizationId: MOCK_ORGANIZATION.id,
      organizationName: MOCK_ORGANIZATION.name,
      createdAt: new Date().toISOString(),
    };

    MOCK_USERS.push(newUser);
    MOCK_USER_PASSWORDS[normalizedEmail] = (data.password && data.password.trim()) || "admin123";

    // Record an audit log for security
    this.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      organizationId: MOCK_ORGANIZATION.id,
      userId: "usr_admin_01",
      userName: "Kabir Malhotra",
      userRole: "ORGANIZATION_OWNER",
      action: "STAFF_INVITED",
      resourceType: "settings",
      resourceId: newUser.id,
      details: `Invited new team member ${newUser.name} (${newUser.email}) with role ${newUser.role}`,
      ipAddress: "127.0.0.1",
      timestamp: new Date().toISOString(),
    });

    return {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: "active",
      createdAt: newUser.createdAt,
    };
  }

  async updateTeamMember(
    memberId: string,
    data: {
      name?: string;
      role?: Role;
      status?: "active" | "invited" | "suspended";
      password?: string;
    }
  ): Promise<TeamMember> {
    await delay(150);
    const userIndex = MOCK_USERS.findIndex((u) => u.id === memberId);
    if (userIndex === -1) {
      throw new Error("Staff member not found.");
    }

    const user = MOCK_USERS[userIndex];
    if (data.name && data.name.trim()) user.name = data.name.trim();
    if (data.role) user.role = data.role;
    if (data.status) user.status = data.status;

    if (data.password && data.password.trim()) {
      MOCK_USER_PASSWORDS[user.email.toLowerCase()] = data.password.trim();
    }

    // Security audit log
    this.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      organizationId: MOCK_ORGANIZATION.id,
      userId: "usr_admin_01",
      userName: "Kabir Malhotra",
      userRole: "ORGANIZATION_OWNER",
      action: "STAFF_UPDATED",
      resourceType: "settings",
      resourceId: user.id,
      details: `Updated staff member ${user.name} (${user.email}) - Role: ${user.role}, Status: ${user.status || "active"}${data.password ? ", Password reset" : ""}`,
      ipAddress: "127.0.0.1",
      timestamp: new Date().toISOString(),
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status || "active",
      createdAt: user.createdAt,
    };
  }

  async deleteTeamMember(memberId: string): Promise<void> {
    await delay(150);
    const userIndex = MOCK_USERS.findIndex((u) => u.id === memberId);
    if (userIndex === -1) {
      throw new Error("Staff member not found.");
    }

    const user = MOCK_USERS[userIndex];
    if (user.id === "usr_admin_01" || user.email.toLowerCase() === "admin@bizinvite.com") {
      throw new Error("Cannot delete primary Organization Owner.");
    }

    MOCK_USERS.splice(userIndex, 1);
    delete MOCK_USER_PASSWORDS[user.email.toLowerCase()];

    // Security audit log
    this.auditLogs.unshift({
      id: `aud_${Date.now()}`,
      organizationId: MOCK_ORGANIZATION.id,
      userId: "usr_admin_01",
      userName: "Kabir Malhotra",
      userRole: "ORGANIZATION_OWNER",
      action: "STAFF_DELETED",
      resourceType: "settings",
      resourceId: user.id,
      details: `Removed staff member ${user.name} (${user.email}) from organization`,
      ipAddress: "127.0.0.1",
      timestamp: new Date().toISOString(),
    });
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
    await delay(200);
    const newEvent: Event = {
      id: `evt_${Date.now()}`,
      organizationId: MOCK_ORGANIZATION.id,
      name: eventData.name || "Untitled Event",
      category: eventData.category || "corporate",
      status: eventData.status || "upcoming",
      description: eventData.description || "",
      startDate: eventData.startDate || new Date().toISOString(),
      endDate: eventData.endDate || new Date(Date.now() + 86400000).toISOString(),
      rsvpDeadline: eventData.rsvpDeadline || new Date().toISOString(),
      venue: eventData.venue || { name: "Default Venue", address: "Main Road", city: "City" },
      hosts: eventData.hosts || [],
      contactPersons: eventData.contactPersons || [],
      languages: eventData.languages || ["English"],
      dressCode: eventData.dressCode,
      accommodationInfo: eventData.accommodationInfo,
      transportInfo: eventData.transportInfo,
      faqs: eventData.faqs || [],
      sessions: eventData.sessions || [],
      checkInConfig: eventData.checkInConfig || {
        allowMultipleEntries: true,
        requirePassVerification: true,
        activeGates: ["Gate 1 (Main Entrance)"],
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
  async getGuests(
    eventId?: string,
    search?: string,
    filters?: { category?: string; isVip?: boolean; rsvpStatus?: string; checkInStatus?: string }
  ): Promise<Guest[]> {
    await delay();
    let result = this.guests;
    if (eventId) result = result.filter((g) => g.eventId === eventId);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((g) => g.name.toLowerCase().includes(q) || g.mobile.includes(q) || g.email?.toLowerCase().includes(q));
    }
    if (filters?.category && filters.category !== "all") {
      result = result.filter((g) => g.category.toLowerCase() === filters.category?.toLowerCase());
    }
    if (filters?.isVip !== undefined) {
      result = result.filter((g) => g.isVip === filters.isVip);
    }
    if (filters?.rsvpStatus && filters.rsvpStatus !== "all") {
      result = result.filter((g) => g.rsvpStatus === filters.rsvpStatus);
    }
    if (filters?.checkInStatus && filters.checkInStatus !== "all") {
      result = result.filter((g) => g.checkInStatus === filters.checkInStatus);
    }
    return result;
  }

  async addGuest(guestData: Partial<Guest>): Promise<Guest> {
    await delay(200);
    const newGuest: Guest = {
      id: `gst_${Date.now()}`,
      organizationId: MOCK_ORGANIZATION.id,
      eventId: guestData.eventId || this.events[0]?.id || "",
      name: guestData.name || "Guest Name",
      mobile: guestData.mobile || "+919999999999",
      email: guestData.email,
      familyGroupName: guestData.familyGroupName,
      category: guestData.category || "Family",
      isVip: guestData.isVip || false,
      city: guestData.city,
      preferredLanguage: guestData.preferredLanguage || "English",
      invitedSessionIds: guestData.invitedSessionIds || [],
      allowedCompanions: guestData.allowedCompanions ?? 0,
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
    const evt = this.events.find((e) => e.id === newGuest.eventId);
    if (evt) {
      evt.totalGuestsCount = (evt.totalGuestsCount || 0) + 1;
    }
    return newGuest;
  }

  async updateGuest(id: string, updates: Partial<Guest>): Promise<Guest> {
    await delay(150);
    const index = this.guests.findIndex((g) => g.id === id);
    if (index === -1) throw new Error("Guest not found");
    this.guests[index] = { ...this.guests[index], ...updates, updatedAt: new Date().toISOString() };
    return this.guests[index];
  }

  async previewGuestImport(fileName: string, totalRows = 25): Promise<ImportPreviewResult> {
    await delay(400);
    return {
      importId: `imp_${Date.now()}`,
      totalRows,
      validRows: totalRows,
      errorRows: 0,
      duplicateCount: 0,
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
        { "Full Name": "Sample Invitee", "Mobile Number": "+919820011999", "Email Address": "sample@corp.in", "Guest Category": "Family", "VIP Status (Y/N)": "N", "Allowed Pax": "1", City: "Mumbai" },
      ],
      validationIssues: [],
      duplicates: [],
    };
  }

  async commitGuestImport(importId: string, count = 10): Promise<{ importedCount: number; updatedCount: number }> {
    await delay(300);
    return { importedCount: count, updatedCount: 0 };
  }

  // WhatsApp Templates
  async getTemplates(): Promise<WhatsAppTemplate[]> {
    await delay(50);
    return this.templates;
  }

  // Campaigns
  async getCampaigns(eventId?: string): Promise<Campaign[]> {
    await delay(100);
    if (eventId) return this.campaigns.filter((c) => c.eventId === eventId);
    return this.campaigns;
  }

  /** Mirrors the backend audience rules: segment filters, optional explicit selection, no cancelled invitations. */
  private audienceFor(eventId: string, segment: CampaignTargetSegment = {}): Guest[] {
    const selected = segment.eventGuestIds?.length ? new Set(segment.eventGuestIds) : null;
    return this.guests.filter(
      (g) =>
        g.eventId === eventId &&
        (!selected || selected.has(g.id)) &&
        (!segment.category || g.category === segment.category) &&
        (!segment.onlyVip || g.isVip) &&
        (!segment.rsvpStatus || g.rsvpStatus === segment.rsvpStatus)
    );
  }

  async createCampaign(campaignData: Partial<Campaign> & { draft?: boolean }): Promise<Campaign> {
    await delay(300);
    const tmpl = this.templates.find((t) => t.id === campaignData.templateId);
    if (tmpl && tmpl.approvalStatus !== "APPROVED") {
      throw new Error("Cannot send an unapproved WhatsApp template.");
    }
    const eventId = campaignData.eventId || this.events[0]?.id || "";
    const segment = campaignData.targetSegment || {};

    const newCampaign: Campaign = {
      id: `cmp_${Date.now()}`,
      organizationId: MOCK_ORGANIZATION.id,
      eventId,
      eventName: this.events.find((e) => e.id === campaignData.eventId)?.name || "Event",
      name: campaignData.name || "New Campaign",
      templateId: campaignData.templateId || this.templates[0].id,
      templateName: tmpl?.name || "Template",
      status: campaignData.draft ? "draft" : campaignData.scheduledFor ? "scheduled" : "running",
      targetSegment: { ...segment, selectedGuestCount: segment.eventGuestIds?.length ?? 0 },
      scheduledFor: campaignData.scheduledFor,
      // No dispatch job in mock mode: the recipient list counts as built immediately.
      recipientsBuiltAt: new Date().toISOString(),
      metrics: {
        totalTargeted: this.audienceFor(eventId, segment).length,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        suppressed: 0,
      },
      createdAt: new Date().toISOString(),
    };
    this.campaigns.unshift(newCampaign);
    return newCampaign;
  }

  async pauseCampaign(id: string): Promise<Campaign> {
    await delay(150);
    const c = this.campaigns.find((item) => item.id === id);
    if (!c) throw new Error("Campaign not found");
    c.status = "paused";
    return c;
  }

  async resumeCampaign(id: string): Promise<Campaign> {
    await delay(150);
    const c = this.campaigns.find((item) => item.id === id);
    if (!c) throw new Error("Campaign not found");
    c.status = "running";
    return c;
  }

  async sendCampaign(id: string): Promise<Campaign> {
    await delay(150);
    const c = this.campaigns.find((item) => item.id === id);
    if (!c) throw new Error("Campaign not found");
    if (c.status !== "draft" && c.status !== "scheduled") throw new Error(`A ${c.status} campaign cannot be sent`);
    c.status = "running";
    c.scheduledFor = undefined;
    c.startedAt = new Date().toISOString();
    c.recipientsBuiltAt = c.startedAt;
    return c;
  }

  async cancelCampaign(id: string): Promise<Campaign> {
    await delay(150);
    const c = this.campaigns.find((item) => item.id === id);
    if (!c) throw new Error("Campaign not found");
    if (!["draft", "scheduled", "running", "paused"].includes(c.status)) throw new Error("This campaign can no longer be cancelled");
    c.status = "cancelled";
    return c;
  }

  /** Mock mode sends nothing, so every targeted guest is listed as pending (or suppressed when blocked). */
  async getCampaignRecipients(id: string, status?: RecipientStatus): Promise<CampaignRecipientPage> {
    await delay(100);
    const c = this.campaigns.find((item) => item.id === id);
    if (!c) throw new Error("Campaign not found");
    const items: CampaignRecipient[] = this.audienceFor(c.eventId, c.targetSegment).map((g) => {
      const reason = g.optedOut ? "opted_out" : g.communicationSuppressed ? "suppressed" : g.mobileValid === false ? "invalid_mobile" : undefined;
      return {
        id: `rcp_${g.id}`,
        campaignId: c.id,
        guestId: g.id,
        guestName: g.name,
        mobile: g.mobile,
        status: reason ? "suppressed" : c.status === "cancelled" ? "suppressed" : "pending",
        suppressionReason: reason ?? (c.status === "cancelled" ? "campaign_cancelled" : undefined),
      };
    });
    const filtered = status ? items.filter((r) => r.status === status) : items;
    return { items: filtered, total: filtered.length };
  }

  async previewAudience(eventId: string, segment: CampaignTargetSegment): Promise<AudiencePreview> {
    await delay(80);
    const matched = this.audienceFor(eventId, segment);
    const suppressed: AudiencePreview["suppressed"] = {};
    for (const g of matched) {
      const reason = g.optedOut ? "opted_out" : g.communicationSuppressed ? "suppressed" : g.mobileValid === false ? "invalid_mobile" : null;
      if (reason) suppressed[reason] = (suppressed[reason] ?? 0) + 1;
    }
    const blocked = Object.values(suppressed).reduce((a, b) => a + (b ?? 0), 0);
    return {
      matched: matched.length,
      eligible: matched.length - blocked,
      suppressed,
      selectedNotMatched: segment.eventGuestIds ? segment.eventGuestIds.length - matched.length : 0,
    };
  }

  /** Mock mode never delivers messages. */
  async getWhatsAppStatus(): Promise<WhatsAppConnectionStatus> {
    await delay(50);
    return {
      mode: "dry_run",
      dryRun: true,
      sender: { source: "none", dedicatedNumber: false, qualityRating: "UNKNOWN" },
      webhook: { verifyTokenConfigured: false, signatureVerification: false },
      templates: { approved: this.templates.filter((t) => t.approvalStatus === "APPROVED").length, total: this.templates.length },
      ready: false,
      warnings: ["Mock API mode: nothing is sent to WhatsApp."],
    };
  }

  // RSVPs
  async getRSVPs(eventId?: string): Promise<RSVPRecord[]> {
    await delay();
    if (eventId) return this.rsvps.filter((r) => r.eventId === eventId);
    return this.rsvps;
  }

  async getRSVPSummary(eventId?: string): Promise<RSVPSummary> {
    await delay(50);
    const rsvps = eventId ? this.rsvps.filter((r) => r.eventId === eventId) : this.rsvps;
    const attendingRsvps = rsvps.filter((r) => r.status === "attending");
    const totalCompanions = attendingRsvps.reduce((acc, r) => acc + (r.companionsCount || 0), 0);

    return {
      totalInvited: rsvps.length,
      attending: attendingRsvps.length,
      declined: rsvps.filter((r) => r.status === "declined").length,
      maybe: rsvps.filter((r) => r.status === "maybe").length,
      noResponse: rsvps.filter((r) => r.status === "no_response").length,
      incomplete: rsvps.filter((r) => r.status === "incomplete").length,
      checkedIn: 0,
      noShow: 0,
      expectedFootfall: attendingRsvps.length + totalCompanions,
      totalCompanions,
      dietaryCounts: {
        vegetarian: rsvps.filter((r) => r.requirements?.dietaryPreference === "vegetarian").length,
        non_vegetarian: rsvps.filter((r) => r.requirements?.dietaryPreference === "non_vegetarian").length,
        jain: rsvps.filter((r) => r.requirements?.dietaryPreference === "jain").length,
        vegan: rsvps.filter((r) => r.requirements?.dietaryPreference === "vegan").length,
        other: rsvps.filter((r) => r.requirements?.dietaryPreference === "other").length,
      },
      accommodationRequestedCount: rsvps.filter((r) => r.requirements?.needsAccommodation).length,
      transportRequestedCount: rsvps.filter((r) => r.requirements?.needsTransport).length,
    };
  }

  async updateRSVP(guestId: string, status: RSVPStatus, count?: number, requirements?: RSVPRecord["requirements"]): Promise<RSVPRecord> {
    await delay(150);
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
        attendingCount: status === "attending" ? (count || 1) : 0,
        companionsCount: status === "attending" ? Math.max(0, (count || 1) - 1) : 0,
        attendingSessionIds: [],
        requirements: requirements || { dietaryPreference: "vegetarian" },
        source: "manual_staff_entry",
        respondedAt: new Date().toISOString(),
        updatedBy: "Staff Organizer",
      };
      this.rsvps.unshift(record);
    } else {
      record.status = status;
      record.attendingCount = status === "attending" ? (count || 1) : 0;
      record.companionsCount = status === "attending" ? Math.max(0, (count || 1) - 1) : 0;
      if (requirements) record.requirements = requirements;
      record.respondedAt = new Date().toISOString();
    }

    const guest = this.guests.find((g) => g.id === guestId);
    if (guest) {
      guest.rsvpStatus = status;
      if (status === "attending" || status === "declined") {
        guest.reminderStatus = "suppressed";
      }
    }
    return record;
  }

  // Reminders
  async getReminderRules(eventId?: string): Promise<ReminderRule[]> {
    await delay(100);
    if (eventId) return this.reminderRules.filter((r) => r.eventId === eventId);
    return this.reminderRules;
  }

  async createReminderRule(ruleData: Partial<ReminderRule>): Promise<ReminderRule> {
    await delay(200);
    const newRule: ReminderRule = {
      id: `rem_${Date.now()}`,
      organizationId: MOCK_ORGANIZATION.id,
      eventId: ruleData.eventId || this.events[0]?.id || "",
      name: ruleData.name || "New Reminder Rule",
      reminderType: ruleData.reminderType || "rsvp_deadline",
      triggerType: ruleData.triggerType || "relative_to_deadline",
      relativeTo: ruleData.relativeTo || "rsvp_deadline",
      offsetMinutes: ruleData.offsetMinutes || -1440,
      targetFilters: ruleData.targetFilters || { rsvpStatuses: ["no_response"] },
      channel: ruleData.channel || "whatsapp",
      templateId: ruleData.templateId || this.templates[0].id,
      templateName: this.templates.find((t) => t.id === ruleData.templateId)?.name || "Template",
      maximumAttempts: ruleData.maximumAttempts || 3,
      quietHours: ruleData.quietHours || { enabled: true, start: "21:00", end: "09:00" },
      requiresApproval: ruleData.requiresApproval ?? true,
      fallbackChannel: ruleData.fallbackChannel || "sms",
      stopConditions: ruleData.stopConditions || ["rsvp_received", "opt_out", "max_attempts"],
      status: "active",
      audienceCount: 0,
      estimatedCost: 0,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      suppressedCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.reminderRules.unshift(newRule);
    return newRule;
  }

  // Digital Passes
  async getPasses(eventId?: string): Promise<DigitalPass[]> {
    await delay(100);
    if (eventId) return this.passes.filter((p) => p.eventId === eventId);
    return this.passes;
  }

  async resendPass(id: string): Promise<{ success: boolean; message: string }> {
    await delay(200);
    const pass = this.passes.find((p) => p.id === id);
    if (!pass) throw new Error("Pass not found");
    pass.lastSentAt = new Date().toISOString();
    pass.deliveryStatus = "delivered";
    return { success: true, message: "Pass re-sent successfully via WhatsApp." };
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
    await delay(250);
    const pass = this.passes.find((p) => p.passCode === qrData || p.signedToken.includes(qrData));
    if (!pass) {
      return {
        success: false,
        isDuplicate: false,
        message: "Invalid or unrecognized pass code.",
      };
    }

    if (pass.status === "revoked") {
      return {
        success: false,
        isDuplicate: false,
        message: "Pass has been revoked by the organizer.",
      };
    }

    const previousCheckIn = this.checkIns.find((c) => c.guestId === pass.guestId);
    if (previousCheckIn) {
      return {
        success: false,
        isDuplicate: true,
        message: `Duplicate entry detected! Pass was already admitted at ${previousCheckIn.gateName} at ${previousCheckIn.scannedAt}.`,
        guest: {
          id: pass.guestId,
          name: pass.guestName,
          mobile: pass.guestMobile,
          isVip: pass.isVip,
          category: pass.category,
          allowedPax: pass.allowedPax,
          alreadyCheckedInPax: previousCheckIn.paxAdmitted,
          previousCheckInAt: previousCheckIn.scannedAt,
          previousGate: previousCheckIn.gateName,
        },
        record: previousCheckIn,
      };
    }

    const record: CheckInRecord = {
      id: `chk_${Date.now()}`,
      eventId: pass.eventId,
      guestId: pass.guestId,
      guestName: pass.guestName,
      guestMobile: pass.guestMobile,
      isVip: pass.isVip,
      category: pass.category,
      gateId,
      gateName: gateId === "gate_1" ? "Gate 1 (Main Entrance)" : "Gate 2 (VIP/Valet)",
      scannedAt: new Date().toISOString(),
      executiveName: "Pooja Hegde",
      paxAdmitted: paxCount,
      totalAllowedPax: pass.allowedPax,
      status: "admitted",
    };

    this.checkIns.unshift(record);
    pass.status = "used";
    pass.admittedPax = paxCount;

    const guest = this.guests.find((g) => g.id === pass.guestId);
    if (guest) {
      guest.checkInStatus = "checked_in";
      guest.checkedInAt = record.scannedAt;
      guest.checkedInCount = paxCount;
    }

    return {
      success: true,
      isDuplicate: false,
      message: `Admission approved for ${pass.guestName} (${paxCount} Pax).`,
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
    await delay(200);
    const guest = this.guests.find((g) => g.id === guestId);
    if (!guest) throw new Error("Guest not found");

    const record: CheckInRecord = {
      id: `chk_${Date.now()}`,
      eventId: guest.eventId,
      guestId: guest.id,
      guestName: guest.name,
      guestMobile: guest.mobile,
      isVip: guest.isVip,
      category: guest.category,
      gateId,
      gateName: gateId === "gate_1" ? "Gate 1 (Main Entrance)" : "Gate 2 (VIP/Valet)",
      scannedAt: new Date().toISOString(),
      executiveName: "Pooja Hegde",
      paxAdmitted: paxCount,
      totalAllowedPax: guest.allowedCompanions + 1,
      status: "admitted",
    };

    this.checkIns.unshift(record);
    guest.checkInStatus = "checked_in";
    guest.checkedInAt = record.scannedAt;
    guest.checkedInCount = paxCount;

    return {
      success: true,
      isDuplicate: false,
      message: `Manual check-in completed for ${guest.name}.`,
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
    await delay(50);
    const eventScans = eventId ? this.checkIns.filter((c) => c.eventId === eventId) : this.checkIns;
    const rsvps = eventId ? this.rsvps.filter((r) => r.eventId === eventId) : this.rsvps;
    const expectedPax = rsvps
      .filter((r) => r.status === "attending")
      .reduce((acc, r) => acc + 1 + (r.companionsCount || 0), 0);
    const checkedInPax = eventScans.reduce((acc, c) => acc + c.paxAdmitted, 0);

    return {
      totalExpectedPax: expectedPax,
      checkedInPax,
      pendingPax: Math.max(0, expectedPax - checkedInPax),
      recentScans: eventScans.slice(0, 10),
      gateBreakdown: [
        { gateId: "gate_1", gateName: "Gate 1 (Main Entrance)", count: eventScans.filter((s) => s.gateId === "gate_1").length },
        { gateId: "gate_2", gateName: "Gate 2 (VIP/Valet)", count: eventScans.filter((s) => s.gateId === "gate_2").length },
      ],
    };
  }

  // Reports
  async getInvitationFunnelReport(eventId?: string): Promise<InvitationFunnelReport> {
    await delay(50);
    const event = this.events.find((e) => e.id === eventId) || this.events[0];
    const eventCampaigns = eventId ? this.campaigns.filter((c) => c.eventId === eventId) : this.campaigns;
    const sent = eventCampaigns.reduce((acc, c) => acc + (c.metrics?.sent || 0), 0);
    const delivered = eventCampaigns.reduce((acc, c) => acc + (c.metrics?.delivered || 0), 0);
    const read = eventCampaigns.reduce((acc, c) => acc + (c.metrics?.read || 0), 0);

    return {
      eventId: eventId || "",
      eventName: event?.name || "Event",
      totalGuests: event?.totalGuestsCount || 0,
      stages: [
        { stage: "Dispatched", count: sent, percentage: sent > 0 ? 100 : 0 },
        { stage: "Delivered", count: delivered, percentage: sent > 0 ? Math.round((delivered / sent) * 100) : 0 },
        { stage: "Read / Opened", count: read, percentage: delivered > 0 ? Math.round((read / delivered) * 100) : 0 },
      ],
    };
  }

  async getRSVPFunnelReport(eventId?: string): Promise<RSVPFunnelReport> {
    await delay(50);
    const rsvps = eventId ? this.rsvps.filter((r) => r.eventId === eventId) : this.rsvps;
    const attending = rsvps.filter((r) => r.status === "attending").length;
    const totalCompanions = rsvps.filter((r) => r.status === "attending").reduce((acc, r) => acc + (r.companionsCount || 0), 0);
    const declined = rsvps.filter((r) => r.status === "declined").length;
    const maybe = rsvps.filter((r) => r.status === "maybe").length;
    const noResponse = rsvps.filter((r) => r.status === "no_response").length;
    const responded = attending + declined + maybe;

    return {
      eventId: eventId || "",
      totalInvited: rsvps.length,
      attending,
      declined,
      maybe,
      noResponse,
      expectedFootfall: attending + totalCompanions,
      responseRatePercentage: rsvps.length > 0 ? Math.round((responded / rsvps.length) * 100) : 0,
    };
  }

  async getAttendanceReport(eventId?: string): Promise<AttendanceReport> {
    await delay(50);
    const checkIns = eventId ? this.checkIns.filter((c) => c.eventId === eventId) : this.checkIns;
    const rsvps = eventId ? this.rsvps.filter((r) => r.eventId === eventId) : this.rsvps;
    const expected = rsvps.filter((r) => r.status === "attending").reduce((acc, r) => acc + 1 + (r.companionsCount || 0), 0);
    const actual = checkIns.reduce((acc, c) => acc + c.paxAdmitted, 0);

    return {
      eventId: eventId || "",
      totalExpected: expected,
      actualCheckedIn: actual,
      turnoutPercentage: expected > 0 ? Math.round((actual / expected) * 1000) / 10 : 0,
      peakEntryHour: checkIns.length > 0 ? "19:00 - 20:00" : "N/A",
      hourlyCheckIns: [],
    };
  }

  async getReminderConversionReport(eventId?: string): Promise<ReminderConversionReport> {
    await delay(50);
    return {
      eventId: eventId || "",
      remindersSent: 0,
      rsvpsReceivedAfterReminder: 0,
      conversionRatePercentage: 0,
      savingsFromSuppressionCount: 0,
    };
  }

  async getDeliveryFailureReport(eventId?: string): Promise<DeliveryFailureReport> {
    await delay(50);
    return {
      eventId: eventId || "",
      totalFailures: 0,
      failureReasons: [],
      recentFailedRecipients: [],
    };
  }

  async getEventSummaryReport(eventId?: string): Promise<EventSummaryReport> {
    await delay(50);
    const event = this.events.find((e) => e.id === eventId) || this.events[0];
    const rsvps = eventId ? this.rsvps.filter((r) => r.eventId === eventId) : this.rsvps;
    const attending = rsvps.filter((r) => r.status === "attending").length;
    const checkIns = eventId ? this.checkIns.filter((c) => c.eventId === eventId) : this.checkIns;

    return {
      eventId: event?.id || "",
      eventName: event?.name || "Event",
      eventDates: `${event?.startDate ? new Date(event.startDate).toLocaleDateString() : ""} - ${event?.endDate ? new Date(event.endDate).toLocaleDateString() : ""}`,
      venueName: event?.venue?.name || "N/A",
      totalGuests: rsvps.length,
      invitationsDelivered: 0,
      deliveryRate: 0,
      attendingCount: attending,
      actualCheckedInPax: checkIns.reduce((acc, c) => acc + c.paxAdmitted, 0),
      turnoutRate: 0,
    };
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    await delay(50);
    return this.auditLogs;
  }

  async getConsentRecords(): Promise<ConsentRecord[]> {
    await delay(50);
    return this.consentRecords;
  }
}

export const mockAdapter = new MockAdapter();
