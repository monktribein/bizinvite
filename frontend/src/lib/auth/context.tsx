"use client";

import React, { createContext, useCallback, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Permission } from "@/types/auth";
import { Organization } from "@/types/organization";
import { authService } from "@/services/auth.service";
import { organizationService } from "@/services/organization.service";
import { isMockEnabled } from "@/services/config";
import { can as canCheck } from "./permissions";

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  currentEventId: string;
  setCurrentEventId: (eventId: string) => void;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Empty until the header picks one of the organization's real events
  const [currentEventId, setCurrentEventIdState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("bizinvite_current_event_id") ?? "";
  });

  const setCurrentEventId = useCallback((eventId: string) => {
    setCurrentEventIdState(eventId);
    if (typeof window !== "undefined") {
      localStorage.setItem("bizinvite_current_event_id", eventId);
    }
  }, []);

  useEffect(() => {
    async function initAuth() {
      try {
        const storedToken = typeof window !== "undefined" ? localStorage.getItem("bizinvite_access_token") : null;
        if (storedToken || isMockEnabled()) {
          const currentUser = await authService.getCurrentUser();
          setUser(currentUser);
          if (currentUser.organizationId) {
            const org = await organizationService.getOrganization(currentUser.organizationId);
            setOrganization(org);
          }
        }
      } catch (err) {
        console.warn("Auth initialization failed (session may be expired):", err);
        if (typeof window !== "undefined") {
          localStorage.removeItem("bizinvite_access_token");
          localStorage.removeItem("bizinvite_refresh_token");
          localStorage.removeItem("bizinvite_current_user_email");
        }
        setUser(null);
        setOrganization(null);
        if (typeof window !== "undefined" && window.location.pathname.startsWith("/dashboard")) {
          router.replace("/login");
        }
      } finally {
        setIsLoading(false);
      }
    }
    initAuth();
  }, [router]);

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    try {
      const response = await authService.login(email, password);
      setUser(response.user);
      if (typeof window !== "undefined") {
        localStorage.setItem("bizinvite_access_token", response.tokens.accessToken);
        localStorage.setItem("bizinvite_refresh_token", response.tokens.refreshToken);
      }
      if (response.user.organizationId) {
        const org = await organizationService.getOrganization(response.user.organizationId);
        setOrganization(org);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setOrganization(null);
      router.push("/login");
    }
  };

  const can = (permission: Permission) => {
    return canCheck(user, permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        isAuthenticated: !!user,
        isLoading,
        currentEventId,
        setCurrentEventId,
        login,
        logout,
        can,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
