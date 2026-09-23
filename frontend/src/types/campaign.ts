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
  scheduledFor?: string;
  startedAt?: string;
  completedAt?: string;
  metrics: CampaignMetrics;
  createdAt: string;
}
