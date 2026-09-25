"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";

/**
 * Warns when campaigns will not reach guests' phones: dry-run mode (the server only logs
 * messages) or a live connection that is missing something (sender, webhooks, templates).
 */
export function WhatsAppStatusBanner() {
  const { data: status } = useWhatsAppStatus();
  if (!status || status.ready) return null;

  const dryRun = status.mode === "dry_run";
  return (
    <div
      role="status"
      className={`mb-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs ${
        dryRun ? "border-amber-300 bg-amber-50 text-amber-900" : "border-rose-200 bg-rose-50 text-rose-900"
      }`}
    >
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="space-y-1">
        <p className="font-semibold">
          {dryRun
            ? "WhatsApp dry-run: campaigns run end to end, but messages are only logged by the server and are not delivered to guests."
            : "WhatsApp is connected but not fully ready. Some messages or replies may not arrive."}
        </p>
        {!dryRun && (
          <ul className="list-disc pl-4 space-y-0.5">
            {status.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
