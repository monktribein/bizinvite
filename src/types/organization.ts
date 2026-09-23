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

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: import("./auth").Role;
  status: "active" | "invited" | "suspended";
  lastLoginAt?: string;
  createdAt: string;
}
