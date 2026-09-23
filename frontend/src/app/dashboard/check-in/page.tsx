"use client";

import React, { useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useCheckIn } from "@/hooks/useCheckIn";
import { useGuests } from "@/hooks/useGuests";
import { useAuth } from "@/lib/auth/context";
import { CheckInResponse } from "@/types/checkin";
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
  Camera,
  ShieldAlert,
} from "lucide-react";

export default function CheckInPage() {
  const { currentEventId } = useAuth();
  const { summary, scanQR, isScanning, manualCheckIn } =
    useCheckIn(currentEventId);
  const { guests } = useGuests(currentEventId);

  const [selectedGate, setSelectedGate] = useState("gate_1");
  const [activeTab, setActiveTab] = useState<"camera" | "manual">("camera");

  // Scanner Simulator / Camera Input
  const [qrInput, setQrInput] = useState("");
  const [paxCount, setPaxCount] = useState(1);
  const [lastResult, setLastResult] = useState<CheckInResponse | null>(null);

  // Manual search lookup
  const [manualSearch, setManualSearch] = useState("");

  const matchedGuests = manualSearch
    ? guests.filter(
        (g) =>
          g.name.toLowerCase().includes(manualSearch.toLowerCase()) ||
          g.mobile.includes(manualSearch)
      )
    : [];

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrInput.trim()) return;

    const result = await scanQR({
      qrData: qrInput.trim(),
      gateId: selectedGate,
      paxCount,
    });

    setLastResult(result);
    setQrInput("");
  };

  const handleQuickSimulateScan = async (code: string) => {
    const result = await scanQR({
      qrData: code,
      gateId: selectedGate,
      paxCount: 1,
    });
    setLastResult(result);
  };

  const handlePerformManualCheckIn = async (guest: Guest) => {
    const result = await manualCheckIn({
      guestId: guest.id,
      gateId: selectedGate,
      paxCount: guest.allowedCompanions + 1,
    });
    setLastResult(result);
    setManualSearch("");
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
            onChange={(e) => setSelectedGate(e.target.value)}
            className="w-full sm:w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:ring-2 focus:ring-indigo-600"
          >
            <option value="gate_1">Gate 1 (Main Entrance)</option>
            <option value="gate_2">Gate 2 (VIP & Valet Porch)</option>
            <option value="gate_3">Gate 3 (Ballroom Direct)</option>
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
                {/* Simulated Camera Viewfinder */}
                <div className="relative mx-auto flex h-60 w-full max-w-sm flex-col items-center justify-center rounded-2xl bg-slate-900 text-white shadow-inner overflow-hidden border-2 border-indigo-500/50">
                  <div className="absolute inset-x-8 top-1/2 h-0.5 bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-pulse" />
                  <div className="absolute inset-8 rounded-xl border-2 border-dashed border-white/40 pointer-events-none" />

                  <Camera className="h-10 w-10 text-white/50 mb-2" />
                  <span className="text-xs font-semibold text-white/80">
                    Camera Viewfinder Active
                  </span>
                  <span className="text-[10px] text-white/50">
                    Align guest pass QR inside the frame
                  </span>
                </div>

                {/* Form to submit scanned QR string or manual PassCode */}
                <form onSubmit={handleScanSubmit} className="mt-6 space-y-4">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        label="Pass Code or Scanned QR String"
                        placeholder="e.g. BIZ-2026-X79K or paste signed token"
                        value={qrInput}
                        onChange={(e) => setQrInput(e.target.value)}
                        required
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="w-28">
                      <Input
                        label="Pax Entering"
                        type="number"
                        min={1}
                        max={10}
                        value={paxCount}
                        onChange={(e) => setPaxCount(parseInt(e.target.value) || 1)}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" isLoading={isScanning}>
                    <ScanLine className="w-4 h-4 mr-2" /> Verify & Admit Guest
                  </Button>
                </form>

                {/* Quick Simulation Buttons for Easy Demonstration */}
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Quick-Test Live Passes:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickSimulateScan("BIZ-2026-A12B")}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-mono text-indigo-700 hover:bg-indigo-50 font-semibold cursor-pointer"
                    >
                      BIZ-2026-A12B (Roy - Active)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickSimulateScan("BIZ-2026-X79K")}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-mono text-amber-800 hover:bg-amber-100 font-semibold cursor-pointer"
                    >
                      BIZ-2026-X79K (Trigger Duplicate)
                    </button>
                  </div>
                </div>
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
                      <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                        ✓
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-slate-900">{scan.guestName}</span>
                          <span className="font-bold text-slate-700">{scan.paxAdmitted} Pax</span>
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
