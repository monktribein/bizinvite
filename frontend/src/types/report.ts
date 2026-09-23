export interface FunnelStage {
  stage: string;
  count: number;
  percentage: number;
}

export interface InvitationFunnelReport {
  eventId: string;
  eventName: string;
  totalGuests: number;
  stages: FunnelStage[]; // Sent -> Delivered -> Read
}

export interface RSVPFunnelReport {
  eventId: string;
  totalInvited: number;
  attending: number;
  declined: number;
  maybe: number;
  noResponse: number;
  expectedFootfall: number;
  responseRatePercentage: number;
}

export interface AttendanceReport {
  eventId: string;
  totalExpected: number;
  actualCheckedIn: number;
  turnoutPercentage: number;
  peakEntryHour: string;
  hourlyCheckIns: Array<{
    hour: string;
    count: number;
  }>;
}

export interface ReminderConversionReport {
  eventId: string;
  remindersSent: number;
  rsvpsReceivedAfterReminder: number;
  conversionRatePercentage: number;
  savingsFromSuppressionCount: number;
}

export interface DeliveryFailureReport {
  eventId: string;
  totalFailures: number;
  failureReasons: Array<{
    reason: string;
    count: number;
    description: string;
  }>;
  recentFailedRecipients: Array<{
    guestName: string;
    mobile: string;
    campaignName: string;
    reason: string;
    failedAt: string;
  }>;
}

export interface EventSummaryReport {
  eventId: string;
  eventName: string;
  eventDates: string;
  venueName: string;
  totalGuests: number;
  invitationsDelivered: number;
  deliveryRate: number;
  attendingCount: number;
  actualCheckedInPax: number;
  turnoutRate: number;
}
