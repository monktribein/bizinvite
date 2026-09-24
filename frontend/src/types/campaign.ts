export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type RecipientStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "suppressed";

export type TemplateApprovalStatus = "APPROVED" | "PENDING" | "REJECTED";

export interface TemplateButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  payload?: string;
  url?: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  approvalStatus: TemplateApprovalStatus;
  /** "local" templates exist only in WhatsApp dry-run mode. */
  source?: "meta" | "local";
  headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE";
  headerContent?: string;
  bodyText: string;
  footerText?: string;
  variables: string[]; // e.g. ["guest_name", "event_name", "date", "venue"]
  buttons: TemplateButton[];
}

export interface CampaignRecipient {
  id: string;
  campaignId: string;
  guestId: string;
  guestName: string;
  mobile: string;
  status: RecipientStatus;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  errorMessage?: string;
}

export interface CampaignMetrics {
  totalTargeted: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  suppressed: number;
}

export type CampaignMediaType = "image" | "video";

/** Image or video sent as the invitation template header. */
export interface CampaignMedia {
  id: string;
  type: CampaignMediaType;
  mimeType: string;
  size: number;
  filename?: string;
}

/** Accepted attachments; WhatsApp supports these formats in template headers. */
export const CAMPAIGN_MEDIA_LIMITS: Record<CampaignMediaType, { maxBytes: number; mimeTypes: string[]; label: string }> = {
  image: { maxBytes: 2 * 1024 * 1024, mimeTypes: ["image/jpeg", "image/png"], label: "2 MB" },
  video: { maxBytes: 10 * 1024 * 1024, mimeTypes: ["video/mp4", "video/3gpp"], label: "10 MB" },
};

export interface Campaign {
  id: string;
  organizationId: string;
  eventId: string;
  eventName: string;
  name: string;
  templateId: string;
  templateName: string;
  status: CampaignStatus;
  targetSegment: {
    category?: string;
    rsvpStatus?: string;
    onlyVip?: boolean;
    sessionIds?: string[];
  };
  media?: CampaignMedia;
  scheduledFor?: string;
  startedAt?: string;
  completedAt?: string;
  metrics: CampaignMetrics;
  createdAt: string;
}

/** Body for creating a campaign; mediaId comes from uploadCampaignMedia. */
export type CreateCampaignInput = Partial<Omit<Campaign, "media">> & { mediaId?: string };

/** Supported placeholder names and whether WhatsApp is live or in dry-run (local templates allowed). */
export interface TemplateCapabilities {
  variables: string[];
  whatsapp: { configured: boolean; dryRun: boolean };
}

/** Local test template (dry-run only). Placeholders use supported names, e.g. {{guest_name}}. */
export interface CreateLocalTemplateInput {
  name: string;
  language?: string;
  bodyText: string;
  buttons?: Array<{ type: "QUICK_REPLY"; text: string }>;
}
