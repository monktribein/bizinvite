"use client";

import React from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, CircleSlash } from "lucide-react";
import { useAuth } from "@/lib/auth/context";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { cn } from "@/lib/utils/cn";

type State = "ready" | "dry_run" | "incomplete";

const LABELS: Record<State, { pill: string; footer: string; detail: string }> = {
  ready: { pill: "WA: Live", footer: "WhatsApp live", detail: "Messages are delivered" },
  dry_run: { pill: "WA: Dry-run", footer: "WhatsApp dry-run", detail: "Messages are logged, not delivered" },
  incomplete: { pill: "WA: Setup incomplete", footer: "WhatsApp setup incomplete", detail: "See Settings → WhatsApp" },
};

/**
 * Real WhatsApp connection state from the backend (never a hard-coded "active"). Hidden for
 * roles that cannot read the status.
 */
export function WhatsAppIndicator({ variant }: { variant: "pill" | "footer" }) {
  const { can } = useAuth();
  const allowed = can("settings:manage") || can("campaigns:view");
  const { data: status } = useWhatsAppStatus(allowed);
  if (!allowed || !status) return null;

  const state: State = status.ready ? "ready" : status.dryRun ? "dry_run" : "incomplete";
  const label = LABELS[state];
  const tone =
    state === "ready"
      ? { box: "bg-emerald-50 border-emerald-200 text-emerald-800", icon: "text-emerald-600", dot: "bg-emerald-500" }
      : state === "dry_run"
        ? { box: "bg-amber-50 border-amber-300 text-amber-900", icon: "text-amber-600", dot: "bg-amber-500" }
        : { box: "bg-rose-50 border-rose-200 text-rose-800", icon: "text-rose-600", dot: "bg-rose-500" };
  const Icon = state === "ready" ? CheckCircle2 : state === "dry_run" ? CircleSlash : AlertCircle;
  const href = can("settings:manage") ? "/dashboard/settings" : "/dashboard/campaigns";

  if (variant === "pill") {
    return (
      <Link
        href={href}
        title={label.detail}
        className={cn("hidden md:flex items-center gap-1.5 rounded-full px-2.5 py-1 border text-xs font-medium", tone.box)}
      >
        <Icon className={cn("w-3.5 h-3.5", tone.icon)} />
        <span>{label.pill}</span>
        {state === "ready" && status.sender.qualityRating !== "UNKNOWN" && (
          <span className={cn("text-[10px]", tone.icon)}>{status.sender.qualityRating}</span>
        )}
      </Link>
    );
  }
  return (
    <>
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", tone.dot, state === "ready" && "animate-pulse")} />
        <span className="text-xs font-medium text-slate-600">{label.footer}</span>
      </div>
      <p className="text-[11px] text-slate-400 mt-0.5">{status.sender.phoneNumber ?? label.detail}</p>
    </>
  );
}
