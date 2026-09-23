"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Permission } from "@/types/auth";
import { Organization } from "@/types/organization";
import { authService } from "@/services/auth.service";
import { organizationService } from "@/services/organization.service";
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
  const [currentEventId, setCurrentEventId] = useState<string>("evt_sharma_wedding_2026");

  useEffect(() => {
    async function initAuth() {
      try {
        const storedToken = typeof window !== "undefined" ? localStorage.getItem("bizinvite_access_token") : null;
        if (storedToken || process.env.NEXT_PUBLIC_USE_MOCK_API !== "false") {
          const currentUser = await authService.getCurrentUser();
          setUser(currentUser);
          if (currentUser.organizationId) {
            const org = await organizationService.getOrganization(currentUser.organizationId);
            setOrganization(org);
          }
        }
      } catch (err) {
        console.error("Auth initialization failed:", err);
      } finally {
        setIsLoading(false);
      }
    }
    initAuth();
  }, []);

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
    await authService.logout();
    setUser(null);
    setOrganization(null);
    router.push("/login");
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
