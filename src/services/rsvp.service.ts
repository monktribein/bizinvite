import { apiClient } from "@/lib/api/client";
import { mockAdapter } from "@/lib/api/mock-adapter";
import { isMockEnabled } from "./config";
import { RSVPRecord, RSVPSummary } from "@/types/rsvp";
import { RSVPStatus } from "@/types/guest";

export const rsvpService = {
  async getRSVPs(eventId?: string): Promise<RSVPRecord[]> {
    if (isMockEnabled()) {
      return mockAdapter.getRSVPs(eventId);
    }
    const response = await apiClient.get<RSVPRecord[]>("/api/v1/rsvps", { eventId });
    return response.data;
  },

  async getRSVPSummary(eventId?: string): Promise<RSVPSummary> {
    if (isMockEnabled()) {
      return mockAdapter.getRSVPSummary(eventId);
    }
    const response = await apiClient.get<RSVPSummary>("/api/v1/rsvps/summary", { eventId });
    return response.data;
  },

  async updateRSVP(guestId: string, status: RSVPStatus, count?: number, requirements?: RSVPRecord["requirements"]): Promise<RSVPRecord> {
    if (isMockEnabled()) {
      return mockAdapter.updateRSVP(guestId, status, count, requirements);
    }
    const response = await apiClient.patch<RSVPRecord>(`/api/v1/rsvps/${guestId}`, {
      status,
      count,
      requirements,
    });
    return response.data;
  },
};
