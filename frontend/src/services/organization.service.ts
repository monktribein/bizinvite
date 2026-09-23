import { apiClient } from "@/lib/api/client";
import { mockAdapter } from "@/lib/api/mock-adapter";
import { isMockEnabled } from "./config";
import { Organization, TeamMember } from "@/types/organization";
import { AuditLog, ConsentRecord } from "@/types/audit";

export const organizationService = {
  async getOrganization(orgId: string): Promise<Organization> {
    if (isMockEnabled()) {
      return mockAdapter.getOrganization();
    }
    const response = await apiClient.get<Organization>(`/api/v1/organizations/${orgId}`);
    return response.data;
  },

  async getTeamMembers(orgId: string): Promise<TeamMember[]> {
    if (isMockEnabled()) {
      return mockAdapter.getTeamMembers();
    }
    const response = await apiClient.get<TeamMember[]>(`/api/v1/organizations/${orgId}/team`);
    return response.data;
  },

  async getAuditLogs(orgId: string): Promise<AuditLog[]> {
    if (isMockEnabled()) {
      return mockAdapter.getAuditLogs();
    }
    const response = await apiClient.get<AuditLog[]>(`/api/v1/organizations/${orgId}/audit-logs`);
    return response.data;
  },

  async getConsentRecords(orgId: string): Promise<ConsentRecord[]> {
    if (isMockEnabled()) {
      return mockAdapter.getConsentRecords();
    }
    const response = await apiClient.get<ConsentRecord[]>(`/api/v1/organizations/${orgId}/consents`);
    return response.data;
  },
};
