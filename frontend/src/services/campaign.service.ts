import { apiClient } from "@/lib/api/client";
import { mockAdapter } from "@/lib/api/mock-adapter";
import { isMockEnabled } from "./config";
import {
  Campaign,
  CampaignMedia,
  CreateCampaignInput,
  CreateLocalTemplateInput,
  TemplateCapabilities,
  WhatsAppTemplate,
} from "@/types/campaign";

export const campaignService = {
  async getTemplates(): Promise<WhatsAppTemplate[]> {
    if (isMockEnabled()) {
      return mockAdapter.getTemplates();
    }
    const response = await apiClient.get<WhatsAppTemplate[]>("/api/v1/templates");
    return response.data;
  },

  async getTemplateCapabilities(): Promise<TemplateCapabilities> {
    if (isMockEnabled()) {
      return { variables: ["guest_name", "event_name", "event_date", "venue"], whatsapp: { configured: false, dryRun: true } };
    }
    const response = await apiClient.get<TemplateCapabilities>("/api/v1/templates/variables");
    return response.data;
  },

  async createLocalTemplate(input: CreateLocalTemplateInput): Promise<WhatsAppTemplate> {
    if (isMockEnabled()) {
      throw new Error("Templates cannot be created in mock mode.");
    }
    const response = await apiClient.post<WhatsAppTemplate>("/api/v1/templates", input);
    return response.data;
  },

  async syncTemplates(): Promise<WhatsAppTemplate[]> {
    if (isMockEnabled()) {
      return mockAdapter.getTemplates();
    }
    const response = await apiClient.post<WhatsAppTemplate[]>("/api/v1/templates/sync");
    return response.data;
  },

  async getCampaigns(eventId?: string): Promise<Campaign[]> {
    if (isMockEnabled()) {
      return mockAdapter.getCampaigns(eventId);
    }
    const response = await apiClient.get<Campaign[]>("/api/v1/campaigns", { eventId });
    return response.data;
  },

  async uploadCampaignMedia(file: File): Promise<CampaignMedia> {
    if (isMockEnabled()) {
      return {
        id: `media_${Date.now()}`,
        type: file.type.startsWith("video/") ? "video" : "image",
        mimeType: file.type,
        size: file.size,
        filename: file.name,
      };
    }
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.upload<CampaignMedia>("/api/v1/campaigns/media", formData);
    return response.data;
  },

  async createCampaign(campaignData: CreateCampaignInput): Promise<Campaign> {
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

  /** Test send from the campaign form, before the campaign is created. */
  async testDraftCampaign(input: { eventId: string; templateId: string; mediaId?: string; mobile: string }): Promise<{ success: boolean; message: string }> {
    if (isMockEnabled()) {
      return { success: true, message: `Sample test WhatsApp message sent to ${input.mobile}` };
    }
    const response = await apiClient.post<{ success: boolean; message: string }>("/api/v1/campaigns/test", input);
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
