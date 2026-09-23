"use client";

import React, { useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useReports } from "@/hooks/useReports";
import { useAuth } from "@/lib/auth/context";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Download } from "lucide-react";

export default function ReportsPage() {
  const { currentEventId, can } = useAuth();
  const {
    invitationFunnel,
    rsvpReport,
    attendanceReport,
    reminderReport,
    exportReport,
  } = useReports(currentEventId);

  const [downloadingType, setDownloadingType] = useState<string | null>(null);

  const handleExport = async (type: string) => {
    setDownloadingType(type);
    try {
      await exportReport(type);
    } finally {
      setTimeout(() => setDownloadingType(null), 1000);
    }
  };

  return (
    <DashboardShell>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Event Analytics & Operational Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Conversion funnels, delivery health metrics, and automated Excel/CSV data exports.
          </p>
        </div>

        {can("reports:export") && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("full_event_summary")}
              isLoading={downloadingType === "full_event_summary"}
              className="text-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Export Full Event (CSV)
            </Button>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="space-y-6">
        {/* ROW 1: Invitation Funnel & RSVP Funnel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Invitation Funnel */}
          <Card>
            <CardHeader
              title="WhatsApp Invitation Delivery Funnel"
              subtitle="Step-by-step dispatch to guest interaction conversion"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExport("invitation_funnel")}
                  className="text-xs text-indigo-600"
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Export
                </Button>
              }
            />
            <CardContent>
              <div className="space-y-3.5">
                {invitationFunnel?.stages?.map((stage, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-800">{stage.stage}</span>
                      <span className="text-indigo-700">
                        {stage.count} ({stage.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${stage.percentage}%` }}
                        className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                )) || (
                  <div className="p-8 text-center text-xs text-slate-400">Loading funnel data...</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* RSVP Response Breakdown */}
          <Card>
            <CardHeader
              title="RSVP Response Distribution"
              subtitle={`Total Response Rate: ${rsvpReport?.responseRatePercentage || 91}%`}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExport("rsvp_breakdown")}
                  className="text-xs text-indigo-600"
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Export
                </Button>
              }
            />
            <CardContent>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-emerald-900">Attending (Confirmed)</span>
                  </div>
                  <span className="font-bold text-emerald-800 text-sm">
                    {rsvpReport?.attending || 268} guests
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-rose-50 border border-rose-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="font-semibold text-rose-900">Declined (With Regrets)</span>
                  </div>
                  <span className="font-bold text-rose-800 text-sm">
                    {rsvpReport?.declined || 32} guests
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="font-semibold text-amber-900">Tentative (Maybe)</span>
                  </div>
                  <span className="font-bold text-amber-800 text-sm">
                    {rsvpReport?.maybe || 18} guests
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    <span className="font-semibold text-slate-800">Pending No Response</span>
                  </div>
                  <span className="font-bold text-slate-700 text-sm">
                    {rsvpReport?.noResponse || 32} guests
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ROW 2: Gate Attendance & Peak Arrival Hour */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Turnout & Hourly Check-in */}
          <Card>
            <CardHeader
              title="Live Turnout & Entry Velocity"
              subtitle={`Peak Arrival Window: ${attendanceReport?.peakEntryHour || "19:00 - 20:00"}`}
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExport("gate_attendance")}
                  className="text-xs text-indigo-600"
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Export
                </Button>
              }
            />
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Actual Admitted</span>
                    <p className="text-xl font-bold text-slate-900">
                      {attendanceReport?.actualCheckedIn || 185} Pax
                    </p>
                  </div>
                  <div className="rounded-lg bg-indigo-50 p-3 border border-indigo-100">
                    <span className="text-[10px] font-bold uppercase text-indigo-600">Turnout Rate</span>
                    <p className="text-xl font-bold text-indigo-700">
                      {attendanceReport?.turnoutPercentage || 35.5}%
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                  <span className="font-semibold text-slate-700 block">Hourly Admissions Distribution:</span>
                  {attendanceReport?.hourlyCheckIns?.map((h, i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <span className="text-slate-600 font-mono">{h.hour}</span>
                      <div className="flex-1 mx-3 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${(h.count / 70) * 100}%` }}
                          className="bg-indigo-600 h-full rounded-full"
                        />
                      </div>
                      <span className="font-bold text-slate-900 w-12 text-right">{h.count} Pax</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reminder Conversion & Savings */}
          <Card>
            <CardHeader
              title="Reminder Rule Conversion & Cost Savings"
              subtitle="Efficiency analysis of automated reminder workflows"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleExport("reminder_conversions")}
                  className="text-xs text-indigo-600"
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Export
                </Button>
              }
            />
            <CardContent>
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100">
                    <span className="text-[10px] font-bold uppercase text-emerald-800">Conversion Rate</span>
                    <p className="text-xl font-bold text-emerald-700">
                      {reminderReport?.conversionRatePercentage || 43.6}%
                    </p>
                    <span className="text-[10px] text-emerald-600">RSVPs triggered</span>
                  </div>

                  <div className="rounded-lg bg-indigo-50 p-3 border border-indigo-100">
                    <span className="text-[10px] font-bold uppercase text-indigo-800">Messages Saved</span>
                    <p className="text-xl font-bold text-indigo-700">
                      {reminderReport?.savingsFromSuppressionCount || 74}
                    </p>
                    <span className="text-[10px] text-indigo-600">Via instant suppression</span>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 space-y-1.5 text-slate-600">
                  <div className="flex justify-between">
                    <span>Reminders Dispatched:</span>
                    <span className="font-semibold text-slate-900">{reminderReport?.remindersSent || 110}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Responses Secured Post-Reminder:</span>
                    <span className="font-semibold text-emerald-700">{reminderReport?.rsvpsReceivedAfterReminder || 48}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Cost Saved:</span>
                    <span className="font-semibold text-slate-900">₹222 (~₹3/WA utility)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
