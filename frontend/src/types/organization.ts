export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  whatsAppStatus: WhatsAppIntegrationStatus;
  plan: "starter" | "growth" | "enterprise";
  createdAt: string;
}

export interface WhatsAppIntegrationStatus {
  connected: boolean;
  phoneNumber?: string;
  wabaId?: string;
  businessDisplayName?: string;
  qualityRating?: "GREEN" | "YELLOW" | "RED" | "UNKNOWN";
  tier?: string;
  lastSyncAt?: string;
}

/** Live connection state from GET /organizations/:id/whatsapp-status. */
export interface WhatsAppConnectionStatus {
  /** live = messages are delivered; dry_run = the server only logs them. */
  mode: "live" | "dry_run";
  dryRun: boolean;
  sender: {
    source: "organization" | "platform" | "none";
    dedicatedNumber: boolean;
    phoneNumber?: string;
    businessDisplayName?: string;
    wabaId?: string;
    qualityRating: "GREEN" | "YELLOW" | "RED" | "UNKNOWN";
    tier?: string;
    phoneNumberId?: string;
    /** Live check with Meta that the access token can use the sender number on the Cloud API. */
    verification?: { checked: boolean; ok: boolean; error?: string; platformType?: string };
  };
  webhook: {
    verifyTokenConfigured: boolean;
    signatureVerification: boolean;
    /** Whether Meta delivers this WABA's webhooks to the app; null when it could not be checked. */
    wabaSubscribed?: boolean | null;
  };
  templates: { approved: number; sendable?: number; total: number; lastSyncAt?: string };
  ready: boolean;
  warnings: string[];
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: import("./auth").Role;
  status: "active" | "invited" | "suspended";
  lastLoginAt?: string;
  createdAt: string;
}
