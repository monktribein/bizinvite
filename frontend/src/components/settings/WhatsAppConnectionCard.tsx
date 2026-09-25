"use client";

import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, CircleSlash, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { useAuth } from "@/lib/auth/context";
import { organizationService } from "@/services/organization.service";
import { formatDate } from "@/lib/utils/formatters";

const SENDER_SOURCE_LABEL = {
  organization: "Your organization's own number",
  platform: "Shared platform number",
  none: "No sender number configured",
} as const;

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right font-semibold text-slate-900 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
      <span className={ok ? "text-slate-700" : "text-rose-800"}>{label}</span>
    </li>
  );
}

/** Real WhatsApp Cloud API connection state for the organization (no placeholder values). */
export function WhatsAppConnectionCard() {
  const { data: status, isLoading, isError, refetch, isFetching } = useWhatsAppStatus();
  const { organization, can } = useAuth();
  const queryClient = useQueryClient();
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState("");

  const subscribe = async () => {
    if (!organization) return;
    setSubscribeError("");
    setSubscribing(true);
    try {
      const next = await organizationService.subscribeWhatsAppWebhooks(organization.id);
      queryClient.setQueryData(["whatsapp_status", organization.id], next);
    } catch (err) {
      setSubscribeError(err instanceof Error ? err.message : "Could not subscribe webhooks.");
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader title="WhatsApp Business API (WABA) Connection" subtitle="Live Cloud API state reported by the BizInvite server" />
      <CardContent className="space-y-4 text-xs">
        {isLoading ? (
          <p className="text-slate-400">Checking WhatsApp connection...</p>
        ) : isError || !status ? (
          <p className="text-rose-600">Could not load the WhatsApp connection status.</p>
        ) : (
          <>
            <div
              className={`rounded-xl border p-4 flex items-center justify-between gap-3 ${
                status.ready
                  ? "border-emerald-200 bg-emerald-50/50"
                  : status.dryRun
                    ? "border-amber-300 bg-amber-50"
                    : "border-rose-200 bg-rose-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-full text-white flex items-center justify-center ${
                    status.ready ? "bg-emerald-600" : status.dryRun ? "bg-amber-500" : "bg-rose-600"
                  }`}
                >
                  {status.ready ? <CheckCircle2 className="w-6 h-6" /> : status.dryRun ? <CircleSlash className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {status.dryRun ? "Dry-run: messages are not delivered" : status.ready ? "Live: messages are delivered" : "Live, but setup is incomplete"}
                    </span>
                    <Badge variant={status.ready ? "success" : status.dryRun ? "warning" : "danger"} size="sm">
                      {status.mode === "live" ? "LIVE" : "DRY-RUN"}
                    </Badge>
                  </div>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    {status.dryRun
                      ? "The server has no WhatsApp Cloud API credentials. Campaigns run end to end, but messages are only logged."
                      : SENDER_SOURCE_LABEL[status.sender.source]}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} isLoading={isFetching} className="text-xs shrink-0">
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
              </Button>
            </div>

            {status.warnings.length > 0 && (
              <ul className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-1 list-disc pl-7 text-amber-900">
                {status.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}

            <dl className="divide-y divide-slate-100">
              <Row label="Sender number" value={status.sender.phoneNumber ?? (status.sender.source === "platform" ? "Platform default" : "—")} mono />
              {status.sender.phoneNumberId && <Row label="Phone number ID" value={status.sender.phoneNumberId} mono />}
              {status.sender.verification?.checked && (
                <Row
                  label="Verified with Meta"
                  value={
                    status.sender.verification.ok ? (
                      <Badge variant="success" size="sm">
                        Cloud API number verified
                      </Badge>
                    ) : (
                      <span className="text-rose-700">{status.sender.verification.error ?? "Failed"}</span>
                    )
                  }
                />
              )}
              <Row label="Verified display name" value={status.sender.businessDisplayName ?? "—"} />
              <Row label="WhatsApp Business Account ID" value={status.sender.wabaId ?? (status.sender.source === "platform" ? "Platform account" : "—")} mono />
              <Row
                label="Quality rating"
                value={
                  <Badge
                    size="sm"
                    variant={status.sender.qualityRating === "GREEN" ? "success" : status.sender.qualityRating === "YELLOW" ? "warning" : status.sender.qualityRating === "RED" ? "danger" : "default"}
                  >
                    {status.sender.qualityRating}
                    {status.sender.tier ? ` • ${status.sender.tier}` : ""}
                  </Badge>
                }
              />
              <Row
                label="Approved templates"
                value={`${status.templates.approved} of ${status.templates.total}${status.templates.sendable !== undefined ? ` (${status.templates.sendable} ready to send)` : ""}${status.templates.lastSyncAt ? ` • synced ${formatDate(status.templates.lastSyncAt)}` : ""}`}
              />
            </dl>

            {status.mode === "live" && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Webhooks (delivery, read and RSVP replies)</span>
                <ul className="space-y-1">
                  <Check ok={status.webhook.verifyTokenConfigured} label="Verify token set, so Meta can subscribe" />
                  <Check ok={status.webhook.signatureVerification} label="App secret set, so webhook signatures are verified" />
                  {status.webhook.wabaSubscribed !== null && status.webhook.wabaSubscribed !== undefined && (
                    <Check ok={status.webhook.wabaSubscribed} label="App subscribed to the WhatsApp Business Account's webhooks" />
                  )}
                </ul>
                {status.webhook.wabaSubscribed === false && can("settings:manage") && (
                  <Button size="sm" onClick={subscribe} isLoading={subscribing} className="text-xs">
                    Subscribe webhooks
                  </Button>
                )}
                {subscribeError && <p className="text-rose-600">{subscribeError}</p>}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
