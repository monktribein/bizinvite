export type Role =
  | "PLATFORM_SUPER_ADMIN"
  | "ORGANIZATION_OWNER"
  | "EVENT_ADMINISTRATOR"
  | "GUEST_MANAGER"
  | "COMMUNICATION_MANAGER"
  | "CHECK_IN_EXECUTIVE"
  | "READ_ONLY_VIEWER";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
  organizationName: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password?: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export type Permission =
  | "events:create"
  | "events:edit"
  | "events:delete"
  | "events:view"
  | "guests:import"
  | "guests:manage"
  | "guests:view"
  | "campaigns:create"
  | "campaigns:send"
  | "campaigns:view"
  | "rsvp:update"
  | "rsvp:view"
  | "reminders:configure"
  | "reminders:view"
  | "passes:manage"
  | "checkin:perform"
  | "reports:view"
  | "reports:export"
  | "settings:manage"
  | "team:manage";
