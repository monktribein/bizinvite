import { apiClient } from "@/lib/api/client";
import { mockAdapter } from "@/lib/api/mock-adapter";
import { isMockEnabled } from "./config";
import { Campaign, WhatsAppTemplate } from "@/types/campaign";

export const campaignService = {
  async getTemplates(): Promise<WhatsAppTemplate[]> {
    if (isMockEnabled()) {
      return mockAdapter.getTemplates();
    }
    const response = await apiClient.get<WhatsAppTemplate[]>("/api/v1/templates");
    return response.data;
  },

  async getCampaigns(eventId?: string): Promise<Campaign[]> {
    if (isMockEnabled()) {
      return mockAdapter.getCampaigns(eventId);
    }
    const response = await apiClient.get<Campaign[]>("/api/v1/campaigns", { eventId });
    return response.data;
  },

  async createCampaign(campaignData: Partial<Campaign>): Promise<Campaign> {
    if (isMockEnabled()) {
      return mockAdapter.createCampaign(campaignData);
    }
    const response = await apiClient.post<Campaign>("/api/v1/campaigns", campaignData);
    return response.data;
  },

  async testCampaign(campaignId: string, testMobile: string): Promise<{ success: boolean; message: string }> {
    if (isMockEnabled()) {
      return { success: true, message: `Sample test WhatsApp message sent to ${testMobile}` };
    }
    const response = await apiClient.post<{ success: boolean; message: string }>(`/api/v1/campaigns/${campaignId}/test`, {
      mobile: testMobile,
    });
    return response.data;
  },

  async pauseCampaign(campaignId: string): Promise<Campaign> {
    if (isMockEnabled()) {
      return mockAdapter.pauseCampaign(campaignId);
    }
    const response = await apiClient.post<Campaign>(`/api/v1/campaigns/${campaignId}/pause`);
    return response.data;
  },

  async resumeCampaign(campaignId: string): Promise<Campaign> {
    if (isMockEnabled()) {
      return mockAdapter.resumeCampaign(campaignId);
    }
    const response = await apiClient.post<Campaign>(`/api/v1/campaigns/${campaignId}/resume`);
    return response.data;
  },
};
