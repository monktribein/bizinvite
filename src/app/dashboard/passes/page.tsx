"use client";

import React, { useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { usePasses } from "@/hooks/usePasses";
import { useAuth } from "@/lib/auth/context";
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
  Eye,
  Shield,
  Crown,
} from "lucide-react";

export default function PassesPage() {
  const { currentEventId, can } = useAuth();
  const { passes, isLoading, resendPass, revokePass, isResending, isRevoking } =
    usePasses(currentEventId);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPassForQR, setSelectedPassForQR] = useState<DigitalPass | null>(null);
  const [resendStatusMsg, setResendStatusMsg] = useState("");

  const filteredPasses = passes.filter((p) => {
    const matchesSearch =
      p.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.passCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.guestMobile.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleResend = async (passId: string) => {
    const res = await resendPass(passId);
    setResendStatusMsg(res.message);
    setTimeout(() => setResendStatusMsg(""), 4000);
  };

  const handleRevoke = async (passId: string) => {
    if (confirm("Are you sure you want to revoke this pass? It will invalidate entry at all gates.")) {
      await revokePass(passId);
    }
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
            Backend-signed cryptographic QR passes, WhatsApp delivery monitoring, and instant revocation.
          </p>
        </div>
      </div>

      {resendStatusMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{resendStatusMsg}</span>
        </div>
      )}

      {/* Security Architecture Notice */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            <b>Zero Client Security Vulnerability</b>: Digital QR tokens are cryptographically generated and HMAC-signed exclusively by the BizInvite backend. Frontend never mints untrusted admission tokens.
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
                <TableEmptyState message="No passes found matching criteria" colSpan={7} />
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
                        <span className="text-emerald-700 font-medium capitalize">
                          {p.deliveryStatus}
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
                            onClick={() => setSelectedPassForQR(p)}
                            className="text-xs text-indigo-600"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> View QR
                          </Button>

                          {can("passes:manage") && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResend(p.id)}
                                className="text-xs"
                                disabled={isResending}
                              >
                                <Send className="w-3.5 h-3.5 mr-1" /> Resend
                              </Button>

                              {p.status !== "revoked" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRevoke(p.id)}
                                  className="text-xs text-rose-600 hover:text-rose-800"
                                  disabled={isRevoking}
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

      {/* QR Preview Modal */}
      {selectedPassForQR && (
        <Modal
          isOpen={!!selectedPassForQR}
          onClose={() => setSelectedPassForQR(null)}
          title={`Digital Pass • ${selectedPassForQR.passCode}`}
          description={`Cryptographic entry ticket for ${selectedPassForQR.guestName}`}
          maxWidth="md"
        >
          <div className="text-center space-y-4">
            {/* Visual QR Code Display */}
            <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-4 shadow-sm">
              <div className="flex flex-col items-center gap-2">
                <QrCode className="h-32 w-32 text-slate-800" />
                <span className="font-mono text-xs font-bold tracking-widest text-indigo-700">
                  {selectedPassForQR.passCode}
                </span>
              </div>
            </div>

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
              <div className="flex justify-between">
                <span className="text-slate-500">HMAC Signature:</span>
                <span className="font-mono text-[10px] text-slate-400 truncate max-w-[180px]">
                  {selectedPassForQR.signedToken}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedPassForQR(null)}
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  handleResend(selectedPassForQR.id);
                  setSelectedPassForQR(null);
                }}
              >
                <Send className="w-3.5 h-3.5 mr-1" /> Resend to WhatsApp
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </DashboardShell>
  );
}
