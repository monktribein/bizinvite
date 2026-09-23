/**
 * Centralized RBAC definitions. Role names and permission strings mirror
 * frontend/src/types/auth.ts and frontend/src/lib/auth/permissions.ts exactly.
 */
export const ROLES = [
  "PLATFORM_SUPER_ADMIN",
  "ORGANIZATION_OWNER",
  "EVENT_ADMINISTRATOR",
  "GUEST_MANAGER",
  "COMMUNICATION_MANAGER",
  "CHECK_IN_EXECUTIVE",
  "READ_ONLY_VIEWER",
] as const;

export type Role = (typeof ROLES)[number];

/** Roles that can be held inside an organization (super admin is platform-level only). */
export const ORGANIZATION_ROLES = ROLES.filter((r) => r !== "PLATFORM_SUPER_ADMIN") as Exclude<
  Role,
  "PLATFORM_SUPER_ADMIN"
>[];
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const PERMISSIONS = [
  "events:create",
  "events:edit",
  "events:delete",
  "events:view",
  "guests:import",
  "guests:manage",
  "guests:view",
  "campaigns:create",
  "campaigns:send",
  "campaigns:view",
  "rsvp:update",
  "rsvp:view",
  "reminders:configure",
  "reminders:view",
  "passes:manage",
  "checkin:perform",
  "reports:view",
  "reports:export",
  "settings:manage",
  "team:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  PLATFORM_SUPER_ADMIN: PERMISSIONS,
  ORGANIZATION_OWNER: PERMISSIONS,
  EVENT_ADMINISTRATOR: [
    "events:create",
    "events:edit",
    "events:view",
    "guests:import",
    "guests:manage",
    "guests:view",
    "campaigns:create",
    "campaigns:send",
    "campaigns:view",
    "rsvp:update",
    "rsvp:view",
    "reminders:configure",
    "reminders:view",
    "passes:manage",
    "checkin:perform",
    "reports:view",
    "reports:export",
  ],
  GUEST_MANAGER: [
    "events:view",
    "guests:import",
    "guests:manage",
    "guests:view",
    "rsvp:update",
    "rsvp:view",
    "passes:manage",
    "checkin:perform",
    "reports:view",
  ],
  COMMUNICATION_MANAGER: [
    "events:view",
    "guests:view",
    "campaigns:create",
    "campaigns:send",
    "campaigns:view",
    "rsvp:view",
    "reminders:configure",
    "reminders:view",
    "reports:view",
  ],
  CHECK_IN_EXECUTIVE: ["events:view", "guests:view", "checkin:perform"],
  READ_ONLY_VIEWER: ["events:view", "guests:view", "campaigns:view", "rsvp:view", "reminders:view", "reports:view"],
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Relative rank used to stop users from granting roles above their own. */
export const ROLE_RANK: Record<Role, number> = {
  PLATFORM_SUPER_ADMIN: 100,
  ORGANIZATION_OWNER: 90,
  EVENT_ADMINISTRATOR: 70,
  GUEST_MANAGER: 50,
  COMMUNICATION_MANAGER: 50,
  CHECK_IN_EXECUTIVE: 30,
  READ_ONLY_VIEWER: 10,
};
