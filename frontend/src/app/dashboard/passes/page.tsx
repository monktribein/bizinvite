"use client";

import React, { useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PassQrCode } from "@/components/passes/PassQrCode";
import { PassSettingsCard } from "@/components/passes/PassSettingsCard";
import { usePasses } from "@/hooks/usePasses";
import { useAuth } from "@/lib/auth/context";
import { ApiError } from "@/lib/api/client";
import { DigitalPass } from "@/types/pass";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmptyState,
} from "@/components/ui/Table";
import { PASS_STATUS_CONFIG } from "@/config/constants";
import { formatDate, formatPhone } from "@/lib/utils/formatters";
import {
  QrCode,
  Send,
  Ban,
  Search,
  CheckCircle,
  AlertCircle,
  Eye,
  Shield,
  Crown,
  Sparkles,
  Download,
  RefreshCw,
} from "lucide-react";

const DELIVERY_STYLES: Record<DigitalPass["deliveryStatus"], string> = {
  delivered: "text-emerald-700",
  sent: "text-indigo-700",
  failed: "text-rose-600",
  not_sent: "text-slate-400",
};

function errorText(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.fields) return Object.values(err.fields).flat().join(" ") || err.message;
  return err instanceof Error ? err.message : fallback;
}

export default function PassesPage() {
  const { currentEventId, can } = useAuth();
  const {
    passes,
    isLoading,
    resendPass,
    revokePass,
    reissuePass,
    generatePasses,
    sendAllPasses,
    isResending,
    isRevoking,
    isReissuing,
    isGenerating,
    isSendingAll,
  } = usePasses(currentEventId);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPassForQR, setSelectedPassForQR] = useState<DigitalPass | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [onlyAttending, setOnlyAttending] = useState(true);

  const filteredPasses = passes.filter((p) => {
    const matchesSearch =
      p.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.passCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.guestMobile.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const unsentCount = passes.filter((p) => p.status === "active" && (p.deliveryStatus === "not_sent" || p.deliveryStatus === "failed")).length;

  const showNotice = (ok: boolean, text: string) => {
    setNotice({ ok, text });
    setTimeout(() => setNotice(null), 6000);
  };

  const run = async (action: () => Promise<string>, fallback: string) => {
    try {
      showNotice(true, await action());
    } catch (err) {
      showNotice(false, errorText(err, fallback));
    }
  };

  const handleResend = (passId: string) =>
    run(async () => (await resendPass(passId)).message, "Could not send the pass.");

  const handleSendAll = () =>
    run(async () => (await sendAllPasses(true)).message, "Could not send the passes.");

  const handleGenerate = () =>
    run(async () => {
      const res = await generatePasses({ eventId: currentEventId, onlyAttending });
      setIsGenerateOpen(false);
      return `${res.created} pass(es) generated${res.skipped ? `, ${res.skipped} guest(s) already had one` : ""}.`;
    }, "Could not generate passes.");

  const handleRevoke = async (passId: string) => {
    if (confirm("Are you sure you want to revoke this pass? It will invalidate entry at all gates.")) {
      await run(async () => {
        await revokePass(passId);
        return "Pass revoked.";
      }, "Could not revoke the pass.");
    }
  };

  const handleReissue = async (pass: DigitalPass) => {
    if (!confirm(`Issue a new pass for ${pass.guestName}? The current QR (${pass.passCode}) stops working.`)) return;
    await run(async () => {
      const fresh = await reissuePass(pass.id);
      setSelectedPassForQR(null);
      return `New pass ${fresh.passCode} issued. Send it to the guest with "Send".`;
    }, "Could not reissue the pass.");
  };

  const downloadQr = (pass: DigitalPass) => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${pass.passCode}.png`;
    link.click();
  };

  return (
    <DashboardShell>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Digital Entry Passes
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Backend-signed QR passes, WhatsApp delivery monitoring, and instant revocation.
          </p>
        </div>
        {can("passes:manage") && currentEventId && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsGenerateOpen(true)}>
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate passes
            </Button>
            <Button size="sm" onClick={handleSendAll} isLoading={isSendingAll} disabled={unsentCount === 0}>
              <Send className="w-3.5 h-3.5 mr-1.5" /> Send unsent passes ({unsentCount})
            </Button>
          </div>
        )}
      </div>

      {notice && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg p-3 text-xs border ${
            notice.ok ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {notice.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      {currentEventId && can("events:edit") && <PassSettingsCard eventId={currentEventId} />}

      {/* Security Architecture Notice */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            QR tokens are HMAC-signed by the BizInvite backend and re-checked on every scan. Passes are also issued automatically when a
            campaign is sent with <b>Include QR entry pass</b>.
          </span>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by pass code (e.g. BIZ-2026), guest name, or mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <div className="w-full sm:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            <option value="all">All Pass Statuses</option>
            <option value="active">Active</option>
            <option value="used">Admitted / Used</option>
            <option value="revoked">Revoked</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Passes Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pass Code</TableHead>
                <TableHead>Guest Name & Category</TableHead>
                <TableHead>Contact (WhatsApp)</TableHead>
                <TableHead>Admitted / Allowed</TableHead>
                <TableHead>Pass Status</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    Loading digital passes...
                  </td>
                </tr>
              ) : filteredPasses.length === 0 ? (
                <TableEmptyState
                  message={passes.length === 0 ? 'No passes yet. Use "Generate passes", or send a campaign with the QR entry pass included.' : "No passes found matching criteria"}
                  colSpan={7}
                />
              ) : (
                filteredPasses.map((p) => {
                  const statusCfg = PASS_STATUS_CONFIG[p.status] || PASS_STATUS_CONFIG.active;

                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <QrCode className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {p.passCode}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="font-semibold text-slate-900 flex items-center gap-1">
                          {p.guestName}
                          {p.isVip && (
                            <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">{p.category}</span>
                      </TableCell>

                      <TableCell>
                        <span className="font-mono text-slate-800">{formatPhone(p.guestMobile)}</span>
                      </TableCell>

                      <TableCell>
                        <div className="font-medium text-slate-900">
                          {p.admittedPax} of {p.allowedPax} Pax Admitted
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge className={statusCfg.color} size="sm">
                          {statusCfg.label}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <span className={`font-medium capitalize ${DELIVERY_STYLES[p.deliveryStatus] ?? "text-slate-600"}`}>
                          {p.deliveryStatus.replace("_", " ")}
                        </span>
                        {p.lastSentAt && (
                          <span className="text-[10px] text-slate-400 block">
                            {formatDate(p.lastSentAt)}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setQrDataUrl("");
                              setSelectedPassForQR(p);
                            }}
                            className="text-xs text-indigo-600"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> View QR
                          </Button>

                          {can("passes:manage") && (
                            <>
                              {p.status === "active" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleResend(p.id)}
                                  className="text-xs"
                                  disabled={isResending}
                                >
                                  <Send className="w-3.5 h-3.5 mr-1" /> {p.deliveryStatus === "not_sent" ? "Send" : "Resend"}
                                </Button>
                              )}

                              {(p.status === "active" || p.status === "used") && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRevoke(p.id)}
                                  className="text-xs text-rose-600 hover:text-rose-800"
                                  disabled={isRevoking}
                                  title="Revoke pass"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Generate Passes Modal */}
      <Modal
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        title="Generate entry passes"
        description="Issues a signed QR pass for each guest of this event who does not have one yet."
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyAttending}
              onChange={(e) => setOnlyAttending(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            <span>
              <b>Only guests who RSVP&apos;d attending</b>
              <span className="block text-slate-500">Untick to issue passes for every invited guest (cancelled invitations are always skipped).</span>
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setIsGenerateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleGenerate} isLoading={isGenerating}>
              <Sparkles className="w-3.5 h-3.5 mr-1" /> Generate
            </Button>
          </div>
        </div>
      </Modal>

      {/* QR Preview Modal */}
      {selectedPassForQR && (
        <Modal
          isOpen={!!selectedPassForQR}
          onClose={() => setSelectedPassForQR(null)}
          title={`Digital Pass • ${selectedPassForQR.passCode}`}
          description={`Entry pass for ${selectedPassForQR.guestName}`}
          maxWidth="md"
        >
          <div className="text-center space-y-4">
            <div className="mx-auto flex w-fit flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <PassQrCode token={selectedPassForQR.signedToken} size={224} onDataUrl={setQrDataUrl} />
              <span className="font-mono text-xs font-bold tracking-widest text-indigo-700">
                {selectedPassForQR.passCode}
              </span>
            </div>
            {selectedPassForQR.status !== "active" && (
              <p className="text-xs font-semibold text-rose-600">
                This pass is {selectedPassForQR.status}: scanning it will not admit anyone.
              </p>
            )}

            <div className="rounded-lg bg-slate-50 p-3 text-left text-xs border border-slate-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Attendee:</span>
                <span className="font-semibold text-slate-900">{selectedPassForQR.guestName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Admissible Pax:</span>
                <span className="font-semibold text-slate-900">{selectedPassForQR.allowedPax} Guests</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-emerald-700 capitalize">{selectedPassForQR.status}</span>
              </div>
              {selectedPassForQR.expiresAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Valid until:</span>
                  <span className="text-slate-900">{formatDate(selectedPassForQR.expiresAt)}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => downloadQr(selectedPassForQR)} disabled={!qrDataUrl}>
                <Download className="w-3.5 h-3.5 mr-1" /> Download
              </Button>
              {can("passes:manage") && (
                <Button variant="outline" size="sm" onClick={() => handleReissue(selectedPassForQR)} isLoading={isReissuing}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reissue
                </Button>
              )}
              {can("passes:manage") && selectedPassForQR.status === "active" && (
                <Button
                  size="sm"
                  onClick={() => {
                    handleResend(selectedPassForQR.id);
                    setSelectedPassForQR(null);
                  }}
                >
                  <Send className="w-3.5 h-3.5 mr-1" /> Send to WhatsApp
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </DashboardShell>
  );
}
