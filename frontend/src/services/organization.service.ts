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

  async inviteTeamMember(
    orgId: string,
    data: { name: string; email: string; role: import("@/types/auth").Role; password?: string }
  ): Promise<TeamMember> {
    if (isMockEnabled()) {
      return mockAdapter.inviteTeamMember(data);
    }
    const response = await apiClient.post<TeamMember>(`/api/v1/organizations/${orgId}/team`, data);
    return response.data;
  },

  async updateTeamMember(
    orgId: string,
    memberId: string,
    data: {
      name?: string;
      role?: import("@/types/auth").Role;
      status?: "active" | "invited" | "suspended";
      password?: string;
    }
  ): Promise<TeamMember> {
    if (isMockEnabled()) {
      return mockAdapter.updateTeamMember(memberId, data);
    }
    const response = await apiClient.patch<TeamMember>(`/api/v1/organizations/${orgId}/team/${memberId}`, data);
    return response.data;
  },

  async deleteTeamMember(orgId: string, memberId: string): Promise<void> {
    if (isMockEnabled()) {
      return mockAdapter.deleteTeamMember(memberId);
    }
    await apiClient.delete(`/api/v1/organizations/${orgId}/team/${memberId}`);
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
