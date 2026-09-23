import {
  LayoutDashboard,
  Calendar,
  Users,
  Send,
  CheckSquare,
  BellRing,
  QrCode,
  ScanLine,
  BarChart3,
  Settings,
} from "lucide-react";
import { Permission } from "@/types/auth";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  requiredPermission?: Permission;
}

export const NAVIGATION_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Events",
    href: "/dashboard/events",
    icon: Calendar,
    requiredPermission: "events:view",
  },
  {
    title: "Guests",
    href: "/dashboard/guests",
    icon: Users,
    requiredPermission: "guests:view",
  },
  {
    title: "Invitations",
    href: "/dashboard/campaigns",
    icon: Send,
    requiredPermission: "campaigns:view",
  },
  {
    title: "RSVP",
    href: "/dashboard/rsvp",
    icon: CheckSquare,
    requiredPermission: "rsvp:view",
  },
  {
    title: "Reminders",
    href: "/dashboard/reminders",
    icon: BellRing,
    requiredPermission: "reminders:view",
  },
  {
    title: "Digital Passes",
    href: "/dashboard/passes",
    icon: QrCode,
    requiredPermission: "passes:manage",
  },
  {
    title: "Check-in",
    href: "/dashboard/check-in",
    icon: ScanLine,
    requiredPermission: "checkin:perform",
    badge: "Live",
  },
  {
    title: "Reports",
    href: "/dashboard/reports",
    icon: BarChart3,
    requiredPermission: "reports:view",
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    requiredPermission: "settings:manage",
  },
];
