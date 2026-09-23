"use client";

import React, { useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useReminders } from "@/hooks/useReminders";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useAuth } from "@/lib/auth/context";
import { ReminderRule } from "@/types/reminder";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import {
  BellRing,
  Plus,
  ShieldCheck,
  Coins,
  Moon,
  Ban,
} from "lucide-react";

export default function RemindersPage() {
  const { currentEventId, can } = useAuth();
  const { rules, isLoading, createRule } = useReminders(currentEventId);
  const { templates } = useCampaigns(currentEventId);

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);

  // New Rule Form State
  const [ruleName, setRuleName] = useState("");
  const [reminderType, setReminderType] = useState<ReminderRule["reminderType"]>("rsvp_deadline");
  const triggerType: ReminderRule["triggerType"] = "relative_to_deadline";
  const [hoursBefore, setHoursBefore] = useState(48);
  const [templateId, setTemplateId] = useState(templates[1]?.id || "");
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true);
  const [quietStart, setQuietStart] = useState("21:00");
  const [quietEnd, setQuietEnd] = useState("09:00");
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [fallbackChannel, setFallbackChannel] = useState<"none" | "sms">("sms");

  const approvedTemplates = templates.filter((t) => t.approvalStatus === "APPROVED");

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRule({
      eventId: currentEventId,
      name: ruleName,
      reminderType,
      triggerType,
      relativeTo: "rsvp_deadline",
      offsetMinutes: -(hoursBefore * 60),
      channel: "whatsapp",
      templateId: templateId || approvedTemplates[0]?.id || "",
      maximumAttempts: 3,
      quietHours: {
        enabled: quietHoursEnabled,
        start: quietStart,
        end: quietEnd,
      },
      requiresApproval,
      fallbackChannel,
      stopConditions: ["rsvp_received", "opt_out", "max_attempts"],
      status: "active",
      audienceCount: 38,
      estimatedCost: 114,
    });

    setIsRuleModalOpen(false);
    setRuleName("");
  };

  return (
    <DashboardShell>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Reminder Control Centre
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Automate WhatsApp follow-ups with intelligent quiet-hours protection and instant RSVP suppression.
          </p>
        </div>

        {can("reminders:configure") && (
          <Button
            size="sm"
            onClick={() => {
              setTemplateId(approvedTemplates[1]?.id || approvedTemplates[0]?.id || "");
              setIsRuleModalOpen(true);
            }}
            className="text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Reminder Rule
          </Button>
        )}
      </div>

      {/* Intelligence & Auto-Suppression Policy Banner */}
      <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-emerald-950">
                Instant Automatic RSVP Suppression Active
              </span>
              <Badge variant="success" size="sm">
                Strict Guardrail
              </Badge>
            </div>
            <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
              As soon as an invitee confirms attendance or declines via WhatsApp Quick Reply or staff override, all pending reminders are instantly cancelled by the system, ensuring zero guest annoyance and eliminating wasted messaging credits.
            </p>
          </div>
        </div>
      </div>

      {/* Active Rules List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading reminder workflows...</div>
        ) : rules.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
            No reminder rules configured. Click &quot;Add Reminder Rule&quot; to create one.
          </div>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id} className="hover:border-slate-300 transition-all">
              <div className="p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                      <BellRing className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{rule.name}</h3>
                        <Badge variant="success" size="sm">
                          {rule.status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Trigger: <span className="font-semibold text-slate-700">{Math.abs(rule.offsetMinutes / 60)} hours before</span> {rule.relativeTo.replace("_", " ")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {rule.requiresApproval && (
                      <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                        Requires Organizer Approval
                      </span>
                    )}
                  </div>
                </div>

                {/* Workflow Specifications */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 text-xs border-b border-slate-100">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Target Audience</span>
                    <span className="font-bold text-slate-900 text-sm">{rule.audienceCount} Unresponded</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Auto-Suppressed</span>
                    <span className="font-bold text-emerald-700 text-sm flex items-center gap-1">
                      <Ban className="w-3.5 h-3.5" /> {rule.suppressedCount} RSVPed
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Quiet Hours</span>
                    <span className="font-medium text-slate-800 flex items-center gap-1">
                      <Moon className="w-3.5 h-3.5 text-indigo-500" />
                      {rule.quietHours.enabled ? `${rule.quietHours.start} to ${rule.quietHours.end}` : "None"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Est. WhatsApp Cost</span>
                    <span className="font-bold text-slate-900 text-sm flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-amber-500" /> ₹{rule.estimatedCost}
                    </span>
                  </div>
                </div>

                {/* Stop & Escalation Conditions */}
                <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-semibold">Stop Triggers:</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px]">RSVP Received</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px]">Opt-Out (&apos;STOP&apos;)</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px]">Max {rule.maximumAttempts} Attempts</span>
                  </div>

                  {rule.fallbackChannel === "sms" && (
                    <span className="text-[11px] text-indigo-700 font-medium">
                      Fallback: High-priority SMS if unread after 12h
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Reminder Rule Builder Modal */}
      <Modal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        title="Add Automated Reminder Rule"
        description="Configure timing, message template, quiet hours, and escalation rules."
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateRule} className="space-y-4">
          <Input
            label="Rule Name"
            required
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            placeholder="e.g. T-24H RSVP Urgent Push"
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Reminder Type"
              value={reminderType}
              onChange={(e) => setReminderType(e.target.value as ReminderRule["reminderType"])}
              options={[
                { label: "RSVP Deadline Reminder", value: "rsvp_deadline" },
                { label: "Event Eve Logistics Guidance", value: "event_eve" },
                { label: "Morning Function Dress Code", value: "event_day" },
                { label: "Session Specific Notice", value: "session_specific" },
              ]}
            />
            <Input
              label="Trigger Timing (Hours Prior)"
              type="number"
              min={1}
              max={168}
              required
              value={hoursBefore}
              onChange={(e) => setHoursBefore(parseInt(e.target.value) || 24)}
              helperText="Scheduled relative to event/RSVP deadline"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Approved WhatsApp Template
            </label>
            <select
              aria-label="Approved WhatsApp Template for Reminders"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900"
            >
              {approvedTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (Approved • {t.category})
                </option>
              ))}
            </select>
          </div>

          {/* Quiet Hours Configuration */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800">Quiet Hours Protection</span>
                <p className="text-[11px] text-slate-500">
                  Delay dispatches during late night / early morning hours to preserve recipient goodwill.
                </p>
              </div>
              <input
                type="checkbox"
                checked={quietHoursEnabled}
                onChange={(e) => setQuietHoursEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
            </div>

            {quietHoursEnabled && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <Input
                  label="Quiet Period Start (Night)"
                  type="time"
                  value={quietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                />
                <Input
                  label="Quiet Period End (Morning)"
                  type="time"
                  value={quietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Fallback Channel"
              value={fallbackChannel}
              onChange={(e) => setFallbackChannel(e.target.value as "none" | "sms")}
              options={[
                { label: "SMS Fallback if WA Undelivered", value: "sms" },
                { label: "None (WhatsApp Only)", value: "none" },
              ]}
            />

            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="appr_box"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              <label htmlFor="appr_box" className="text-xs font-semibold text-slate-800">
                Require Organizer Approval before sending
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsRuleModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save Reminder Workflow
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
