"use client";

import React, { useRef, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { QrScanner } from "@/components/check-in/QrScanner";
import { useCheckIn } from "@/hooks/useCheckIn";
import { useEventDetail } from "@/hooks/useEvents";
import { useGuests } from "@/hooks/useGuests";
import { useAuth } from "@/lib/auth/context";
import { isMockEnabled } from "@/services/config";
import { CheckInRecord, CheckInResponse } from "@/types/checkin";
import { Guest } from "@/types/guest";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils/formatters";
import {
  ScanLine,
  Search,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Keyboard,
} from "lucide-react";

/** Same slug the backend derives from a gate name (common/utils/text.ts gateIdFromName). */
function gateIdFromName(name: string): string {
  const base = name.replace(/\(.*?\)/g, "").trim().toLowerCase();
  return base.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

const DEFAULT_GATES = ["Main Gate"];

function scanFailure(err: unknown): CheckInResponse {
  return {
    success: false,
    isDuplicate: false,
    message: err instanceof Error ? err.message : "Could not verify the pass. Check the connection and try again.",
  };
}

function RecentScanIcon({ status }: { status: CheckInRecord["status"] }) {
  const style =
    status === "admitted"
      ? "bg-emerald-100 text-emerald-800"
      : status === "duplicate_warning"
      ? "bg-amber-100 text-amber-800"
      : "bg-rose-100 text-rose-800";
  return (
    <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px] ${style}`}>
      {status === "admitted" ? "✓" : status === "duplicate_warning" ? "!" : "✕"}
    </div>
  );
}

export default function CheckInPage() {
  const { currentEventId } = useAuth();
  const { summary, scanQR, isScanning, manualCheckIn } =
    useCheckIn(currentEventId);
  const { guests } = useGuests(currentEventId);
  const { data: event } = useEventDetail(currentEventId);

  const gateNames = event?.checkInConfig?.activeGates?.length ? event.checkInConfig.activeGates : DEFAULT_GATES;
  const gates = gateNames.map((name) => ({ id: gateIdFromName(name) || name, name }));
  const [chosenGate, setChosenGate] = useState("");
  const selectedGate = gates.some((g) => g.id === chosenGate) ? chosenGate : gates[0].id;
  const [activeTab, setActiveTab] = useState<"camera" | "manual">("camera");

  // QR scanner and typed pass codes
  const [qrInput, setQrInput] = useState("");
  const [paxCount, setPaxCount] = useState(1);
  const [lastResult, setLastResult] = useState<CheckInResponse | null>(null);
  const verifyingRef = useRef(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Manual search lookup
  const [manualSearch, setManualSearch] = useState("");

  const matchedGuests = manualSearch
    ? guests.filter(
        (g) =>
          g.name.toLowerCase().includes(manualSearch.toLowerCase()) ||
          g.mobile.includes(manualSearch)
      )
    : [];

  const verify = async (qrData: string) => {
    // One verification at a time: the camera keeps decoding while a request is in flight.
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setIsVerifying(true);
    try {
      setLastResult(await scanQR({ qrData, gateId: selectedGate, paxCount }));
      setPaxCount(1);
    } catch (err) {
      setLastResult(scanFailure(err));
    } finally {
      verifyingRef.current = false;
      setIsVerifying(false);
    }
  };

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrInput.trim()) return;
    await verify(qrInput.trim());
    setQrInput("");
  };

  const handlePerformManualCheckIn = async (guest: Guest) => {
    try {
      const result = await manualCheckIn({
        guestId: guest.id,
        gateId: selectedGate,
        paxCount: guest.allowedCompanions + 1,
      });
      setLastResult(result);
      setManualSearch("");
    } catch (err) {
      setLastResult(scanFailure(err));
    }
  };

  return (
    <DashboardShell>
      {/* Mobile-first Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Gate Check-in Station
            </h1>
            <Badge variant="success" size="sm">
              Live Scanner
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Optimized for tablet & smartphone operation at reception entrances.
          </p>
        </div>

        {/* Gate Selection Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">Gate:</span>
          <select
            value={selectedGate}
            onChange={(e) => setChosenGate(e.target.value)}
            className="w-full sm:w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:ring-2 focus:ring-indigo-600"
          >
            {gates.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Live Counter Meter */}
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-center sm:p-4 shadow-2xs">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-700 block">
            Admitted Pax
          </span>
          <p className="mt-1 text-2xl sm:text-3xl font-black text-indigo-900">
            {summary?.checkedInPax || 0}
          </p>
          <span className="text-[10px] text-indigo-600">Through all gates</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center sm:p-4 shadow-2xs">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 block">
            Pending Entry
          </span>
          <p className="mt-1 text-2xl sm:text-3xl font-black text-slate-700">
            {summary?.pendingPax || 0}
          </p>
          <span className="text-[10px] text-slate-400">Awaiting arrival</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center sm:p-4 shadow-2xs">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 block">
            Expected Footfall
          </span>
          <p className="mt-1 text-2xl sm:text-3xl font-black text-slate-900">
            {summary?.totalExpectedPax || 0}
          </p>
          <span className="text-[10px] text-slate-400">Total RSVP&apos;d Pax</span>
        </div>
      </div>

      {/* Scan Outcome Alert Banner */}
      {lastResult && (
        <div
          className={`mb-6 rounded-xl border p-4 shadow-md transition-all ${
            lastResult.isDuplicate
              ? "border-amber-400 bg-amber-50 text-amber-950"
              : lastResult.success
              ? "border-emerald-300 bg-emerald-50 text-emerald-950"
              : "border-rose-300 bg-rose-50 text-rose-950"
          }`}
        >
          <div className="flex items-start gap-3">
            {lastResult.isDuplicate ? (
              <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            ) : lastResult.success ? (
              <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            )}

            <div className="flex-1">
              <h3 className="text-sm font-bold">
                {lastResult.isDuplicate
                  ? "DUPLICATE ENTRY DETECTED"
                  : lastResult.success
                  ? "ENTRY VERIFIED & ADMITTED"
                  : "ADMISSION REJECTED"}
              </h3>
              <p className="text-xs mt-0.5 leading-relaxed">{lastResult.message}</p>

              {lastResult.guest && (
                <div className="mt-3 rounded-lg bg-white/80 p-3 border border-slate-200/60 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      {lastResult.guest.name}
                      {lastResult.guest.isVip && <Badge variant="vip">VIP</Badge>}
                    </span>
                    <span className="text-slate-500 font-mono">{lastResult.guest.mobile}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-100">
                    <span>Category: <b>{lastResult.guest.category}</b></span>
                    <span>Allowed Allowance: <b>{lastResult.guest.allowedPax} Pax</b></span>
                  </div>
                  {lastResult.guest.previousCheckInAt && (
                    <p className="text-[11px] text-amber-800 font-semibold pt-1">
                      Prior admission recorded at: {new Date(lastResult.guest.previousCheckInAt).toLocaleTimeString()} ({lastResult.guest.previousGate})
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Check-In Control Box */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Mode Switcher */}
          <div className="flex rounded-xl bg-slate-200/80 p-1">
            <button
              onClick={() => setActiveTab("camera")}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === "camera"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ScanLine className="w-4 h-4" /> QR Code Scanner
            </button>
            <button
              onClick={() => setActiveTab("manual")}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === "manual"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Search className="w-4 h-4" /> Manual Guest Lookup
            </button>
          </div>

          {/* TAB 1: QR CODE SCANNER VIEW */}
          {activeTab === "camera" && (
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                {/* Live camera: each decoded QR is verified and admitted by the backend */}
                <QrScanner onScan={(data) => void verify(data)} paused={isVerifying} />

                <div className="mt-4 flex items-center gap-2">
                  <div className="w-36">
                    <Input
                      label="Pax Entering"
                      type="number"
                      min={1}
                      max={51}
                      value={paxCount}
                      onChange={(e) => setPaxCount(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>
                  <p className="flex-1 pt-5 text-[11px] text-slate-500">
                    People entering with the next scan (never more than the pass allows). Resets to 1 after each scan.
                  </p>
                </div>

                {/* Fallback: pass code typed from the guest's message */}
                <form onSubmit={handleScanSubmit} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                  <Input
                    label="Or type the pass code"
                    placeholder="e.g. BIZ-2026-X79K2P"
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    required
                    autoCapitalize="characters"
                    className="font-mono text-sm"
                  />
                  <Button type="submit" variant="outline" className="w-full" isLoading={isScanning}>
                    <Keyboard className="w-4 h-4 mr-2" /> Verify & Admit Guest
                  </Button>
                </form>

                {isMockEnabled() && (
                  <p className="mt-4 text-[11px] text-slate-400">
                    Mock mode: generate passes on the Passes page, then type a pass code here.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* TAB 2: MANUAL LOOKUP */}
          {activeTab === "manual" && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by full name or phone number..."
                    value={manualSearch}
                    onChange={(e) => setManualSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                  {matchedGuests.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      {manualSearch
                        ? "No matching guests found"
                        : "Type guest name or 10-digit mobile number above"}
                    </div>
                  ) : (
                    matchedGuests.map((gst) => (
                      <div
                        key={gst.id}
                        className="p-3.5 flex items-center justify-between hover:bg-slate-50 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            {gst.name}
                            {gst.isVip && <Badge variant="vip">VIP</Badge>}
                          </div>
                          <p className="text-slate-500 font-mono text-[11px]">{gst.mobile}</p>
                          <span className="text-[10px] text-slate-400">
                            Allowed Pax: {gst.allowedCompanions + 1} • Status: {gst.checkInStatus}
                          </span>
                        </div>

                        <div>
                          {gst.checkInStatus === "checked_in" ? (
                            <Badge variant="warning" size="sm">
                              Already Admitted
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handlePerformManualCheckIn(gst)}
                              className="text-xs bg-emerald-600 hover:bg-emerald-700"
                            >
                              Admit Guest ({gst.allowedCompanions + 1} Pax)
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Live Gate Feed */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Recent Gate Admissions"
              subtitle="Live chronological stream from active gates"
            />
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {summary?.recentScans && summary.recentScans.length > 0 ? (
                  summary.recentScans.map((scan) => (
                    <div key={scan.id} className="p-3 text-xs flex items-start gap-2.5">
                      <RecentScanIcon status={scan.status} />
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-slate-900">{scan.guestName}</span>
                          <span className="font-bold text-slate-700">
                            {scan.status === "admitted" ? `${scan.paxAdmitted} Pax` : scan.status === "duplicate_warning" ? "Duplicate" : "Rejected"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">{scan.gateName}</p>
                        <span className="text-[10px] text-slate-400">
                          {formatDate(scan.scannedAt)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No gate entries recorded yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
