export type PassStatus = "active" | "used" | "revoked" | "expired";

export interface DigitalPass {
  id: string;
  passCode: string; // e.g. "BIZ-2026-X79K"
  organizationId: string;
  eventId: string;
  eventName: string;
  guestId: string;
  guestName: string;
  guestMobile: string;
  category: string;
  isVip: boolean;
  allowedPax: number;
  admittedPax: number;
  status: PassStatus;
  validSessions: string[];
  // Cryptographically signed payload string issued by backend
  signedToken: string;
  qrPayloadUrl: string;
  deliveryStatus: "delivered" | "sent" | "failed" | "not_sent";
  lastSentAt?: string;
  createdAt: string;
}
