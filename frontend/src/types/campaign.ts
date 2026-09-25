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
  /** URL button whose link ends in a placeholder filled per message. */
  dynamicUrl?: boolean;
  /** Business field that fills a dynamic URL button. */
  urlVariable?: string;
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
  /** Default https media link for IMAGE/VIDEO/DOCUMENT headers. */
  headerMediaUrl?: string;
  /** Placeholder name in a TEXT header, if it has one. */
  headerParameterName?: string;
  /** Business field bound to the TEXT header placeholder. */
  headerVariable?: string;
  bodyText: string;
  footerText?: string;
  /** Business field bound to each body placeholder, in order (unbound ones look like "var_1"). */
  variables: string[];
  /** Meta's body placeholder names in order ("1", "2" or "first_name"). */
  parameterNames?: string[];
  namedParameters?: boolean;
  buttons: TemplateButton[];
  /** What still has to be mapped before the template can be sent; empty when ready. */
  mappingProblems?: string[];
}

/** PATCH /templates/:id body. */
export interface TemplateMappingInput {
  variables?: string[];
  headerVariable?: string | null;
  buttonUrlVariables?: Array<string | null>;
  buttonPayloads?: Array<string | null>;
  headerMediaUrl?: string | null;
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
  failedAt?: string;
  /** WhatsApp Cloud API error code for failed sends (e.g. 131026, 131049, 131050). */
  errorCode?: number;
  /** Why the recipient was not messaged: opted_out, suppressed, invalid_mobile, campaign_cancelled... */
  suppressionReason?: string;
  errorMessage?: string;
}

export interface CampaignRecipientPage {
  items: CampaignRecipient[];
  total: number;
}

/** Who a segment or guest selection would reach, before the campaign is created. */
export interface AudiencePreview {
  matched: number;
  eligible: number;
  suppressed: Partial<Record<"opted_out" | "suppressed" | "invalid_mobile" | "contact_missing", number>>;
  /** Selected guests that the other filters exclude (e.g. cancelled invitations). */
  selectedNotMatched: number;
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
  targetSegment: CampaignTargetSegment;
  media?: CampaignMedia;
  scheduledFor?: string;
  startedAt?: string;
  completedAt?: string;
  /** Unset while a running campaign is still building its recipient list. */
  recipientsBuiltAt?: string;
  metrics: CampaignMetrics;
  failureReason?: string;
  createdAt: string;
}

export interface CampaignTargetSegment {
  category?: string;
  rsvpStatus?: string;
  onlyVip?: boolean;
  sessionIds?: string[];
  groupIds?: string[];
  /** Only guests who have never received an invitation. */
  onlyUninvited?: boolean;
  /** Explicitly selected guests; narrows the other filters (sent on create, returned by GET /campaigns/:id). */
  eventGuestIds?: string[];
  /** Returned by the API: how many guests were explicitly selected. */
  selectedGuestCount?: number;
}

/** Body for creating a campaign; mediaId comes from uploadCampaignMedia. */
export type CreateCampaignInput = Partial<Omit<Campaign, "media">> & {
  mediaId?: string;
  /** Only save the campaign; it is sent later with "Send now". */
  draft?: boolean;
};

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
