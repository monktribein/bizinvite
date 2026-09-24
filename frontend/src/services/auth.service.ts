import { apiClient } from "@/lib/api/client";
import { mockAdapter } from "@/lib/api/mock-adapter";
import { isMockEnabled } from "./config";
import { User, LoginResponse } from "@/types/auth";

export const authService = {
  async login(email: string, password?: string): Promise<LoginResponse> {
    if (isMockEnabled()) {
      return mockAdapter.login(email);
    }
    const response = await apiClient.post<LoginResponse>("/api/v1/auth/login", { email, password });
    return response.data;
  },

  async getCurrentUser(): Promise<User> {
    if (isMockEnabled()) {
      return mockAdapter.getCurrentUser();
    }
    const response = await apiClient.get<User>("/api/v1/auth/me");
    return response.data;
  },

  async logout(): Promise<void> {
    if (isMockEnabled()) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("bizinvite_access_token");
        localStorage.removeItem("bizinvite_refresh_token");
        localStorage.removeItem("bizinvite_current_user_email");
      }
      return;
    }
    try {
      // Best-effort server revoke; an expired or missing session must not block signing out locally
      if (typeof window !== "undefined" && localStorage.getItem("bizinvite_access_token")) {
        const refreshToken = localStorage.getItem("bizinvite_refresh_token") ?? undefined;
        await apiClient.post("/api/v1/auth/logout", { refreshToken });
      }
    } catch {
      // Session already invalid server-side; nothing to revoke
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("bizinvite_access_token");
        localStorage.removeItem("bizinvite_refresh_token");
        localStorage.removeItem("bizinvite_current_user_email");
      }
    }
  },
};
