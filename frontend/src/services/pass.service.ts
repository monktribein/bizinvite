import { apiClient } from "@/lib/api/client";
import { mockAdapter } from "@/lib/api/mock-adapter";
import { isMockEnabled } from "./config";
import { DigitalPass, GeneratePassesInput } from "@/types/pass";

export const passService = {
  async getPasses(eventId?: string): Promise<DigitalPass[]> {
    if (isMockEnabled()) {
      return mockAdapter.getPasses(eventId);
    }
    const response = await apiClient.get<DigitalPass[]>("/api/v1/passes", { eventId });
    return response.data;
  },

  async resendPass(passId: string): Promise<{ success: boolean; message: string }> {
    if (isMockEnabled()) {
      return mockAdapter.resendPass(passId);
    }
    const response = await apiClient.post<{ success: boolean; message: string }>(`/api/v1/passes/${passId}/resend`);
    return response.data;
  },

  async generatePasses(input: GeneratePassesInput): Promise<{ created: number; skipped: number }> {
    if (isMockEnabled()) {
      return mockAdapter.generatePasses(input);
    }
    const response = await apiClient.post<{ created: number; skipped: number }>("/api/v1/passes/generate", input);
    return response.data;
  },

  async sendAllPasses(eventId: string, onlyUnsent = true): Promise<{ queued: number; message: string }> {
    if (isMockEnabled()) {
      return mockAdapter.sendAllPasses(eventId, onlyUnsent);
    }
    const response = await apiClient.post<{ queued: number; message: string }>("/api/v1/passes/send", { eventId, onlyUnsent });
    return response.data;
  },

  async reissuePass(passId: string): Promise<DigitalPass> {
    if (isMockEnabled()) {
      return mockAdapter.reissuePass(passId);
    }
    const response = await apiClient.post<DigitalPass>(`/api/v1/passes/${passId}/reissue`);
    return response.data;
  },

  async revokePass(passId: string): Promise<DigitalPass> {
    if (isMockEnabled()) {
      return mockAdapter.revokePass(passId);
    }
    const response = await apiClient.post<DigitalPass>(`/api/v1/passes/${passId}/revoke`);
    return response.data;
  },
};
