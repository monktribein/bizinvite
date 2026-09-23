export interface Gate {
  id: string;
  name: string;
  location?: string;
}

export interface ScanRequest {
  qrData: string;
  gateId: string;
  paxCount?: number;
  executiveUserId?: string;
}

export interface ManualCheckInRequest {
  guestId: string;
  gateId: string;
  paxCount: number;
  executiveUserId?: string;
  notes?: string;
}

export interface CheckInRecord {
  id: string;
  guestId: string;
  guestName: string;
  guestMobile: string;
  isVip: boolean;
  category: string;
  eventId: string;
  gateId: string;
  gateName: string;
  paxAdmitted: number;
  totalAllowedPax: number;
  scannedAt: string;
  executiveName: string;
  status: "admitted" | "duplicate_warning" | "rejected";
}

export interface CheckInResponse {
  success: boolean;
  isDuplicate: boolean;
  message: string;
  guest?: {
    id: string;
    name: string;
    mobile: string;
    isVip: boolean;
    category: string;
    allowedPax: number;
    alreadyCheckedInPax: number;
    previousCheckInAt?: string;
    previousGate?: string;
  };
  record?: CheckInRecord;
}

export interface CheckInLiveSummary {
  totalExpectedPax: number;
  checkedInPax: number;
  pendingPax: number;
  recentScans: CheckInRecord[];
  gateBreakdown: Array<{
    gateId: string;
    gateName: string;
    count: number;
  }>;
}
