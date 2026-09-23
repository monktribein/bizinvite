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
      }
      return;
    }
    try {
      await apiClient.post("/api/v1/auth/logout");
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("bizinvite_access_token");
        localStorage.removeItem("bizinvite_refresh_token");
      }
    }
  },
};
