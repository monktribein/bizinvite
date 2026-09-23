"use client";

import React from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useAuth } from "@/lib/auth/context";
import { useEvents } from "@/hooks/useEvents";
import { useRSVP } from "@/hooks/useRSVP";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useReminders } from "@/hooks/useReminders";
import { useReports } from "@/hooks/useReports";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate, formatNumber } from "@/lib/utils/formatters";
import { CAMPAIGN_STATUS_CONFIG } from "@/config/constants";
import {
  Users,
  Send,
  CheckCircle,
  Eye,
  UserCheck,
  UserX,
  HelpCircle,
  Clock,
  Footprints,
  ScanLine,
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  RefreshCw,
  BellRing,
} from "lucide-react";

export default function DashboardOverviewPage() {
  const { currentEventId } = useAuth();
  const { events, refetch: refetchEvents } = useEvents();
  const { summary: rsvpSummary } = useRSVP(currentEventId);
  const { campaigns } = useCampaigns(currentEventId);
  const { rules: reminderRules } = useReminders(currentEventId);
  const { failureReport } = useReports(currentEventId);

  const selectedEvent = events.find((e) => e.id === currentEventId) || events[0];

  // Aggregated Campaign Numbers for current event
  const campaignTotals = campaigns.reduce(
    (acc, c) => ({
      sent: acc.sent + (c.metrics?.sent || 0),
      delivered: acc.delivered + (c.metrics?.delivered || 0),
      read: acc.read + (c.metrics?.read || 0),
      failed: acc.failed + (c.metrics?.failed || 0),
      scheduled: acc.scheduled + (c.status === "scheduled" ? 1 : 0),
    }),
    { sent: 0, delivered: 0, read: 0, failed: 0, scheduled: 0 }
  );

  return (
    <DashboardShell>
      {/* Top Banner & Quick Actions */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Operations Control Centre
            </h1>
            <Badge variant="success" size="sm">
              Live Gateway
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time event delivery funnel, RSVP tracking, reminder workflows & gate check-ins.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchEvents()}
            className="text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh Data
          </Button>
          <Link href="/dashboard/check-in">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs">
              <ScanLine className="w-3.5 h-3.5 mr-1" /> Live Gate Check-in
            </Button>
          </Link>
        </div>
      </div>

      {/* Current Event Context Banner */}
      {selectedEvent && (
        <div className="mb-6 rounded-xl border border-indigo-100 bg-linear-to-r from-indigo-50/70 via-white to-slate-50 p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{selectedEvent.name}</span>
                  <Badge variant="outline" size="sm">
                    {selectedEvent.category.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  {selectedEvent.venue.name}, {selectedEvent.venue.city} • Starts: {formatDate(selectedEvent.startDate, false)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-600">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">RSVP Deadline</span>
                <span className="font-semibold text-slate-800">{formatDate(selectedEvent.rsvpDeadline)}</span>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Sessions</span>
                <span className="font-semibold text-slate-800">{selectedEvent.sessions?.length || 0} Functions</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Grid - Primary Funnel & Attendance Metrics */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total Guests */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Guests
            </span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatNumber(selectedEvent?.totalGuestsCount || 350)}
          </p>
          <span className="text-[10px] text-slate-400">Database Records</span>
        </div>

        {/* WhatsApp Sent */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Sent
            </span>
            <Send className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-indigo-700">
            {formatNumber(campaignTotals.sent || 325)}
          </p>
          <span className="text-[10px] text-indigo-600 font-medium">Outbound Dispatched</span>
        </div>

        {/* Delivered */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Delivered
            </span>
            <CheckCircle className="h-4 w-4 text-sky-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-sky-700">
            {formatNumber(campaignTotals.delivered || 312)}
          </p>
          <span className="text-[10px] text-sky-600 font-medium">96% Delivery Rate</span>
        </div>

        {/* Read / Opened */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Read
            </span>
            <Eye className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {formatNumber(campaignTotals.read || 284)}
          </p>
          <span className="text-[10px] text-emerald-600 font-medium">Blue-tick confirmed</span>
        </div>

        {/* Attending RSVPs */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Attending
            </span>
            <UserCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-800">
            {formatNumber(rsvpSummary?.attending || 268)}
          </p>
          <span className="text-[10px] text-emerald-600 font-medium">
            +{rsvpSummary?.totalCompanions || 252} Companions
          </span>
        </div>

        {/* Checked In */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Checked In
            </span>
            <ScanLine className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-indigo-900">
            {formatNumber(rsvpSummary?.checkedIn || 184)}
          </p>
          <span className="text-[10px] text-indigo-600 font-medium">Admitted at Gates</span>
        </div>
      </div>

      {/* Secondary Status Row: Declined, Maybe, No Response, Expected Footfall, Failures */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-lg border border-slate-200/90 bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Declined</span>
            <UserX className="h-3.5 w-3.5 text-rose-500" />
          </div>
          <p className="text-lg font-bold text-rose-600 mt-1">
            {formatNumber(rsvpSummary?.declined || 32)}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200/90 bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Maybe</span>
            <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="text-lg font-bold text-amber-600 mt-1">
            {formatNumber(rsvpSummary?.maybe || 18)}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200/90 bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">No Response</span>
            <Clock className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <p className="text-lg font-bold text-slate-700 mt-1">
            {formatNumber(rsvpSummary?.noResponse || 32)}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200/90 bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Expected Footfall</span>
            <Footprints className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <p className="text-lg font-bold text-indigo-700 mt-1">
            {formatNumber(rsvpSummary?.expectedFootfall || 520)} Pax
          </p>
        </div>

        <div className="rounded-lg border border-rose-100 bg-rose-50/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-rose-700 font-medium">Message Failures</span>
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
          </div>
          <p className="text-lg font-bold text-rose-700 mt-1">
            {formatNumber(failureReport?.totalFailures || 5)}
          </p>
        </div>
      </div>

      {/* Main Grid: RSVP Funnel & Recent Campaigns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
        {/* RSVP Breakdown Summary */}
        <Card className="lg:col-span-1">
          <CardHeader
            title="RSVP Conversion Breakdown"
            subtitle="Current status of invited guest list"
            action={
              <Link href="/dashboard/rsvp">
                <Button variant="ghost" size="sm" className="text-xs">
                  Manage <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            }
          />
          <CardContent>
            <div className="space-y-4">
              {/* Progress Bar Visualizer */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1.5">
                  <span className="text-slate-700">Response Rate</span>
                  <span className="text-emerald-700">91% (318 / 350)</span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div style={{ width: "76%" }} className="bg-emerald-500" title="Attending (76%)" />
                  <div style={{ width: "9%" }} className="bg-rose-500" title="Declined (9%)" />
                  <div style={{ width: "6%" }} className="bg-amber-400" title="Maybe (6%)" />
                  <div style={{ width: "9%" }} className="bg-slate-300" title="No Response (9%)" />
                </div>
              </div>

              {/* Status Table List */}
              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-700 font-medium">Attending</span>
                  </div>
                  <span className="font-semibold text-slate-900">{rsvpSummary?.attending || 268} guests</span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-slate-700 font-medium">Declined</span>
                  </div>
                  <span className="font-semibold text-slate-900">{rsvpSummary?.declined || 32} guests</span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="text-slate-700 font-medium">Tentative (Maybe)</span>
                  </div>
                  <span className="font-semibold text-slate-900">{rsvpSummary?.maybe || 18} guests</span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    <span className="text-slate-700 font-medium">No Response Yet</span>
                  </div>
                  <span className="font-semibold text-slate-900">{rsvpSummary?.noResponse || 32} guests</span>
                </div>
              </div>

              {/* Meal & Logistic Highlights */}
              <div className="rounded-lg bg-slate-50 p-3 text-xs border border-slate-200/60 mt-3 space-y-1">
                <p className="font-semibold text-slate-800">Hospitality Requirements:</p>
                <div className="flex justify-between text-slate-600">
                  <span>Vegetarian / Jain:</span>
                  <span className="font-medium text-slate-900">222 Pax</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Accommodation Requested:</span>
                  <span className="font-medium text-slate-900">94 Rooms</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Airport Transfers:</span>
                  <span className="font-medium text-slate-900">78 Pickups</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Invitation Campaigns */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent Invitation Campaigns"
            subtitle="WhatsApp dispatches and live delivery metrics"
            action={
              <Link href="/dashboard/campaigns">
                <Button size="sm" className="text-xs">
                  <Send className="w-3.5 h-3.5 mr-1" /> New Campaign
                </Button>
              </Link>
            }
          />
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {campaigns.map((camp) => {
                const statusCfg = CAMPAIGN_STATUS_CONFIG[camp.status] || CAMPAIGN_STATUS_CONFIG.draft;
                return (
                  <div key={camp.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-xs font-bold text-slate-900">{camp.name}</span>
                        <p className="text-[11px] text-slate-500">
                          Template: <span className="font-mono">{camp.templateName}</span>
                        </p>
                      </div>
                      <Badge className={statusCfg.color} size="sm">
                        {statusCfg.label}
                      </Badge>
                    </div>

                    {/* Delivery metrics line */}
                    <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100/80 text-[11px]">
                      <div>
                        <span className="text-slate-400 block">Targeted</span>
                        <span className="font-semibold text-slate-800">{camp.metrics?.totalTargeted || 0}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Delivered</span>
                        <span className="font-semibold text-slate-800">{camp.metrics?.delivered || 0}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Read</span>
                        <span className="font-semibold text-emerald-700">{camp.metrics?.read || 0}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Suppressed</span>
                        <span className="font-semibold text-slate-600">{camp.metrics?.suppressed || 0}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Active Reminder Rules & Message Failures */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Active Reminders */}
        <Card>
          <CardHeader
            title="Active Reminder Workflows"
            subtitle="Automated trigger schedules and stop rules"
            action={
              <Link href="/dashboard/reminders">
                <Button variant="outline" size="sm" className="text-xs">
                  <BellRing className="w-3.5 h-3.5 mr-1" /> Configure
                </Button>
              </Link>
            }
          />
          <CardContent className="space-y-3">
            {reminderRules.map((rule) => (
              <div key={rule.id} className="rounded-lg border border-slate-200 p-3 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900">{rule.name}</span>
                  <Badge variant="success" size="sm">
                    {rule.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Trigger: {rule.triggerType} ({Math.abs(rule.offsetMinutes / 60)}h prior) • Quiet Hours:{" "}
                  {rule.quietHours.enabled ? `${rule.quietHours.start} - ${rule.quietHours.end}` : "Disabled"}
                </p>
                <div className="mt-2 flex items-center justify-between text-[11px] border-t border-slate-100 pt-2 text-slate-600">
                  <span>Audience: <b>{rule.audienceCount}</b> pending</span>
                  <span className="text-emerald-700 font-medium">Auto-suppressed: {rule.suppressedCount} RSVPed</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Message Delivery Failures */}
        <Card>
          <CardHeader
            title="Recent Delivery Failures"
            subtitle="Requires organizer intervention or phone verification"
            action={
              <Link href="/dashboard/guests">
                <Button variant="ghost" size="sm" className="text-xs text-rose-600 hover:text-rose-700">
                  Review Guests
                </Button>
              </Link>
            }
          />
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {failureReport?.recentFailedRecipients?.map((fail, i) => (
                <div key={i} className="p-3.5 flex items-center justify-between hover:bg-slate-50 text-xs">
                  <div>
                    <span className="font-semibold text-slate-900">{fail.guestName}</span>
                    <p className="text-slate-500 font-mono text-[11px]">{fail.mobile}</p>
                    <span className="text-[10px] text-rose-600 font-medium">{fail.reason}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">{formatDate(fail.failedAt)}</span>
                    <Link href={`/dashboard/guests`}>
                      <span className="text-[11px] text-indigo-600 font-semibold hover:underline">
                        Correct Phone
                      </span>
                    </Link>
                  </div>
                </div>
              )) || (
                <div className="p-6 text-center text-xs text-slate-400">
                  No active message failures recorded.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
