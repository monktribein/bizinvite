"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, TableBody, TableCell, TableEmptyState, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useCampaignRecipients } from "@/hooks/useCampaigns";
import { formatDate, formatPhone } from "@/lib/utils/formatters";
import { Campaign, CampaignRecipient, RecipientStatus } from "@/types/campaign";

const PAGE_SIZE = 50;

const STATUS_FILTERS: Array<{ value: RecipientStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "delivered", label: "Delivered" },
  { value: "read", label: "Read" },
  { value: "failed", label: "Failed" },
  { value: "suppressed", label: "Suppressed" },
];

const STATUS_BADGE: Record<RecipientStatus, "default" | "info" | "success" | "danger" | "warning" | "outline"> = {
  pending: "default",
  sent: "info",
  delivered: "info",
  read: "success",
  failed: "danger",
  suppressed: "warning",
};

/** Why a recipient was not messaged (backend suppression reasons). */
const SUPPRESSION_LABELS: Record<string, string> = {
  opted_out: "Guest opted out",
  opt_out: "Guest opted out",
  suppressed: "Communication suppressed by organizer",
  organizer_suppressed: "Communication suppressed by organizer",
  invalid_mobile: "Number cannot receive WhatsApp",
  contact_missing: "Guest record removed",
  invitation_cancelled: "Invitation cancelled",
  event_cancelled: "Event cancelled",
  template_not_approved: "Template no longer approved",
  campaign_cancelled: "Campaign cancelled before sending",
};

/** WhatsApp Cloud API error codes worth explaining to organizers. */
const ERROR_CODE_HINTS: Record<number, string> = {
  131026: "Number is not on WhatsApp or cannot receive messages",
  131021: "Recipient cannot be the sender number",
  131047: "More than 24 hours since the guest last replied",
  131049: "Meta limited marketing messages to this guest; try again later",
  131050: "Guest stopped marketing messages from this business (now opted out)",
  132001: "Template does not exist in WhatsApp",
  132015: "Template is paused by Meta",
  132016: "Template is disabled by Meta",
};

function recipientDetail(r: CampaignRecipient): string {
  if (r.status === "suppressed") return SUPPRESSION_LABELS[r.suppressionReason ?? ""] ?? r.suppressionReason ?? "Not sent";
  if (r.status === "failed") {
    const hint = r.errorCode !== undefined ? ERROR_CODE_HINTS[r.errorCode] : undefined;
    const code = r.errorCode !== undefined ? ` (error ${r.errorCode})` : "";
    return `${hint ?? r.errorMessage ?? "Delivery failed"}${code}`;
  }
  return "";
}

function lastUpdate(r: CampaignRecipient): string | undefined {
  return r.readAt ?? r.deliveredAt ?? r.failedAt ?? r.sentAt;
}

export function CampaignRecipientsModal({ campaign, onClose }: { campaign: Campaign | null; onClose: () => void }) {
  const [status, setStatus] = useState<RecipientStatus | "all">("all");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useCampaignRecipients(campaign?.id ?? null, status === "all" ? undefined : status, page, PAGE_SIZE);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const close = () => {
    setStatus("all");
    setPage(1);
    onClose();
  };

  return (
    <Modal
      isOpen={!!campaign}
      onClose={close}
      title={campaign ? `Recipients: ${campaign.name}` : "Recipients"}
      description="Per-number WhatsApp status. Delivered and read receipts arrive from Meta webhooks."
      maxWidth="4xl"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter recipients by status">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={status === f.value}
              onClick={() => {
                setStatus(f.value);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold cursor-pointer ${
                status === f.value ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guest</TableHead>
              <TableHead>WhatsApp Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Update</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-400">
                  Loading recipients...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-rose-600">
                  Could not load recipients.
                </td>
              </tr>
            ) : !data || data.items.length === 0 ? (
              <TableEmptyState
                message={campaign?.status === "draft" || campaign?.status === "scheduled" ? "Recipients are listed once the campaign starts sending" : "No recipients for this filter"}
                colSpan={5}
              />
            ) : (
              data.items.map((r) => {
                const updated = lastUpdate(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-semibold text-slate-900">{r.guestName}</TableCell>
                    <TableCell className="font-mono">{formatPhone(r.mobile)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[r.status] ?? "default"} size="sm" className="capitalize">
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500">{updated ? formatDate(updated) : "—"}</TableCell>
                    <TableCell className="text-slate-600 max-w-xs">{recipientDetail(r) || "—"}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {total} recipient{total === 1 ? "" : "s"}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4" /> Previous
              </Button>
              <span className="text-xs text-slate-700">
                Page {page} of {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
