import { apiClient } from "@/lib/api/client";
import { mockAdapter } from "@/lib/api/mock-adapter";
import { isMockEnabled } from "./config";
import { CheckInResponse, CheckInLiveSummary } from "@/types/checkin";

export const checkInService = {
  async scanQRCode(qrData: string, gateId: string, paxCount = 1): Promise<CheckInResponse> {
    if (isMockEnabled()) {
      return mockAdapter.scanQRCode(qrData, gateId, paxCount);
    }
    const response = await apiClient.post<CheckInResponse>("/api/v1/check-ins/scan", {
      qrData,
      gateId,
      paxCount,
    });
    return response.data;
  },

  async manualCheckIn(guestId: string, gateId: string, paxCount: number): Promise<CheckInResponse> {
    if (isMockEnabled()) {
      return mockAdapter.manualCheckIn(guestId, gateId, paxCount);
    }
    const response = await apiClient.post<CheckInResponse>("/api/v1/check-ins/manual", {
      guestId,
      gateId,
      paxCount,
    });
    return response.data;
  },

  async getLiveSummary(eventId?: string): Promise<CheckInLiveSummary> {
    if (isMockEnabled()) {
      return mockAdapter.getCheckInLiveSummary(eventId);
    }
    const response = await apiClient.get<CheckInLiveSummary>("/api/v1/check-ins/summary", { eventId });
    return response.data;
  },
};
