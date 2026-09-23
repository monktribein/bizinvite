import { Permission, Role, User } from "@/types/auth";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  PLATFORM_SUPER_ADMIN: [
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
  ],
  ORGANIZATION_OWNER: [
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
  ],
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
  CHECK_IN_EXECUTIVE: [
    "events:view",
    "guests:view",
    "checkin:perform",
  ],
  READ_ONLY_VIEWER: [
    "events:view",
    "guests:view",
    "campaigns:view",
    "rsvp:view",
    "reminders:view",
    "reports:view",
  ],
};

export function can(user: User | null | undefined, permission: Permission): boolean {
  if (!user || !user.role) return false;
  const permissions = ROLE_PERMISSIONS[user.role] || [];
  return permissions.includes(permission);
}

export function getRoleDisplayName(role: Role): string {
  switch (role) {
    case "PLATFORM_SUPER_ADMIN":
      return "Platform Super Admin";
    case "ORGANIZATION_OWNER":
      return "Organization Owner";
    case "EVENT_ADMINISTRATOR":
      return "Event Administrator";
    case "GUEST_MANAGER":
      return "Guest Manager";
    case "COMMUNICATION_MANAGER":
      return "Communication Manager";
    case "CHECK_IN_EXECUTIVE":
      return "Check-in Executive";
    case "READ_ONLY_VIEWER":
      return "Read-only Viewer";
    default:
      return role;
  }
}
