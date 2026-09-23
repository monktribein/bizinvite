"use client";

import React, { useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useAuth } from "@/lib/auth/context";
import { campaignService } from "@/services/campaign.service";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { CAMPAIGN_STATUS_CONFIG } from "@/config/constants";
import { formatDate } from "@/lib/utils/formatters";
import {
  Send,
  Plus,
  Play,
  Pause,
  AlertCircle,
  Clock,
} from "lucide-react";

export default function CampaignsPage() {
  const { currentEventId, can } = useAuth();
  const {
    campaigns,
    isLoadingCampaigns,
    templates,
    createCampaign,
    pauseCampaign,
    resumeCampaign,
  } = useCampaigns(currentEventId);

  const [activeTab, setActiveTab] = useState<"campaigns" | "templates">("campaigns");

  // New Campaign Launcher Modal State
  const [isNewCampaignModalOpen, setIsNewCampaignModalOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [targetSegment, setTargetSegment] = useState<string>("all");
  const [scheduleChoice, setScheduleChoice] = useState<"now" | "later">("now");
  const [scheduledDateTime, setScheduledDateTime] = useState("2026-10-01T10:00");
  const [testMobileNumber, setTestMobileNumber] = useState("+91 98200 12345");
  const [testSentMessage, setTestSentMessage] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);

  const approvedTemplates = templates.filter((t) => t.approvalStatus === "APPROVED");
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || approvedTemplates[0];

  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate || selectedTemplate.approvalStatus !== "APPROVED") {
      alert("Error: Only approved WhatsApp templates can be dispatched.");
      return;
    }

    await createCampaign({
      eventId: currentEventId,
      name: campaignName,
      templateId: selectedTemplate.id,
      scheduledFor: scheduleChoice === "later" ? new Date(scheduledDateTime).toISOString() : undefined,
      targetSegment: {
        category: targetSegment === "all" ? undefined : targetSegment,
      },
    });

    setIsNewCampaignModalOpen(false);
    setCampaignName("");
  };

  const handleSendTestMessage = async () => {
    if (!testMobileNumber) return;
    setIsSendingTest(true);
    setTestSentMessage("");
    try {
      const res = await campaignService.testCampaign("test_draft", testMobileNumber);
      setTestSentMessage(res.message);
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <DashboardShell>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            WhatsApp Invitation Campaigns
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Dispatch approved Meta WhatsApp templates, track real-time delivery status, and test messages.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {can("campaigns:create") && (
            <Button
              size="sm"
              onClick={() => {
                setSelectedTemplateId(approvedTemplates[0]?.id || "");
                setIsNewCampaignModalOpen(true);
              }}
              className="text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> New Invitation Wave
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("campaigns")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "campaigns"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Active & Scheduled Campaigns ({campaigns.length})
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "templates"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Approved WhatsApp Templates ({templates.length})
        </button>
      </div>

      {/* TAB 1: CAMPAIGNS LIST */}
      {activeTab === "campaigns" && (
        <div className="space-y-4">
          {isLoadingCampaigns ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
              No campaigns scheduled for this event yet.
            </div>
          ) : (
            campaigns.map((camp) => {
              const statusCfg = CAMPAIGN_STATUS_CONFIG[camp.status] || CAMPAIGN_STATUS_CONFIG.draft;
              const isRunning = camp.status === "running";
              const isPaused = camp.status === "paused";

              return (
                <Card key={camp.id} className="hover:border-slate-300 transition-all">
                  <div className="p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{camp.name}</h3>
                          <Badge className={statusCfg.color} size="sm">
                            {statusCfg.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Template: <span className="font-mono font-medium text-slate-700">{camp.templateName}</span> • Target: {camp.targetSegment.category || "All Guests"}
                        </p>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-2">
                        {isRunning && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => pauseCampaign(camp.id)}
                            className="text-xs text-amber-700"
                          >
                            <Pause className="w-3.5 h-3.5 mr-1" /> Pause Campaign
                          </Button>
                        )}
                        {isPaused && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => resumeCampaign(camp.id)}
                            className="text-xs"
                          >
                            <Play className="w-3.5 h-3.5 mr-1" /> Resume Dispatch
                          </Button>
                        )}
                        {camp.scheduledFor && (
                          <span className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Scheduled: {formatDate(camp.scheduledFor)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delivery & Engagement Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-4 text-xs">
                      <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Total Targeted</span>
                        <p className="text-base font-bold text-slate-900">{camp.metrics?.totalTargeted || 0}</p>
                      </div>
                      <div className="rounded-lg bg-indigo-50/50 p-2.5 border border-indigo-100">
                        <span className="text-[10px] uppercase font-bold text-indigo-500">Sent Outbound</span>
                        <p className="text-base font-bold text-indigo-700">{camp.metrics?.sent || 0}</p>
                      </div>
                      <div className="rounded-lg bg-sky-50/50 p-2.5 border border-sky-100">
                        <span className="text-[10px] uppercase font-bold text-sky-500">Delivered</span>
                        <p className="text-base font-bold text-sky-700">{camp.metrics?.delivered || 0}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50/50 p-2.5 border border-emerald-100">
                        <span className="text-[10px] uppercase font-bold text-emerald-600">Read / Opened</span>
                        <p className="text-base font-bold text-emerald-700">{camp.metrics?.read || 0}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Suppressed</span>
                        <p className="text-base font-bold text-slate-700">{camp.metrics?.suppressed || 0}</p>
                      </div>
                      <div className="rounded-lg bg-rose-50/50 p-2.5 border border-rose-100">
                        <span className="text-[10px] uppercase font-bold text-rose-500">Failed</span>
                        <p className="text-base font-bold text-rose-700">{camp.metrics?.failed || 0}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: WHATSAPP APPROVED TEMPLATES */}
      {activeTab === "templates" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((tmpl) => {
            const isApproved = tmpl.approvalStatus === "APPROVED";

            return (
              <Card key={tmpl.id} className="flex flex-col justify-between">
                <CardHeader className="pb-3 border-b-0">
                  <div className="flex items-center justify-between">
                    <Badge variant={isApproved ? "success" : "warning"} size="sm">
                      {tmpl.approvalStatus}
                    </Badge>
                    <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold">
                      {tmpl.category} • {tmpl.language.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-2 font-mono truncate">{tmpl.name}</h3>
                </CardHeader>

                <CardContent className="pt-0 space-y-3">
                  {/* WhatsApp Chat Bubble Mock Preview */}
                  <div className="rounded-xl bg-emerald-50/60 p-3.5 border border-emerald-200/80 text-xs shadow-2xs">
                    {tmpl.headerType === "TEXT" && (
                      <p className="font-bold text-slate-900 mb-1.5">{tmpl.headerContent}</p>
                    )}
                    <p className="whitespace-pre-line text-slate-800 leading-relaxed font-sans">
                      {tmpl.bodyText}
                    </p>
                    {tmpl.footerText && (
                      <p className="text-[10px] text-slate-400 mt-2 italic">{tmpl.footerText}</p>
                    )}

                    {/* Interactive Buttons */}
                    {tmpl.buttons && tmpl.buttons.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t border-emerald-200/60 pt-2">
                        {tmpl.buttons.map((btn, bIdx) => (
                          <div
                            key={bIdx}
                            className="rounded-lg bg-white p-1.5 text-center text-[11px] font-semibold text-indigo-700 shadow-2xs border border-slate-200/70"
                          >
                            {btn.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                    <span>Variables: <b>{tmpl.variables.length}</b> placeholders</span>
                    {!isApproved && (
                      <span className="text-amber-700 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Meta Pending
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Campaign Creation Modal */}
      <Modal
        isOpen={isNewCampaignModalOpen}
        onClose={() => setIsNewCampaignModalOpen(false)}
        title="Schedule Invitation Campaign"
        description="Select an approved WhatsApp template, choose your target audience, and dispatch."
        maxWidth="3xl"
      >
        <form onSubmit={handleLaunchCampaign} className="space-y-4">
          <Input
            label="Campaign Wave Name"
            required
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="e.g. VIP Wave 1 - Formal Invitation"
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Approved WhatsApp Template
              </label>
              <select
                aria-label="Approved WhatsApp Template"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900"
              >
                {approvedTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (Approved • {t.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Audience Segment Filter
              </label>
              <select
                aria-label="Audience Segment Filter"
                value={targetSegment}
                onChange={(e) => setTargetSegment(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              >
                <option value="all">All Uninvited Guests</option>
                <option value="VVIP">VVIP Guests Only</option>
                <option value="VIP">VIP Tier</option>
                <option value="Family">Family Circle</option>
                <option value="Corporate">Corporate & Partners</option>
              </select>
            </div>
          </div>

          {/* Live Template Preview Container */}
          {selectedTemplate && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Live WhatsApp Message Preview:
              </span>
              <div className="rounded-lg bg-white p-3 border border-emerald-200/90 text-xs shadow-2xs">
                <p className="whitespace-pre-line text-slate-800 leading-relaxed">
                  {selectedTemplate.bodyText}
                </p>
                {selectedTemplate.buttons?.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                    {selectedTemplate.buttons.map((b, i) => (
                      <span key={i} className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200">
                        {b.text}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Test WhatsApp Message Sending */}
          <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-2">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              Send Test Message to Staff Phone:
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={testMobileNumber}
                onChange={(e) => setTestMobileNumber(e.target.value)}
                placeholder="+91 98200 12345"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono text-slate-900"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSendTestMessage}
                isLoading={isSendingTest}
              >
                Send Test
              </Button>
            </div>
            {testSentMessage && (
              <p className="text-xs text-emerald-700 font-semibold">{testSentMessage}</p>
            )}
          </div>

          {/* Dispatch Timing */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Dispatch Schedule
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleChoice("now")}
                  className={`flex-1 rounded-lg p-2 text-xs font-semibold border ${
                    scheduleChoice === "now"
                      ? "bg-indigo-50 border-indigo-600 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  Dispatch Now
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleChoice("later")}
                  className={`flex-1 rounded-lg p-2 text-xs font-semibold border ${
                    scheduleChoice === "later"
                      ? "bg-indigo-50 border-indigo-600 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  Schedule Later
                </button>
              </div>
            </div>

            {scheduleChoice === "later" && (
              <Input
                label="Scheduled Date / Time"
                type="datetime-local"
                value={scheduledDateTime}
                onChange={(e) => setScheduledDateTime(e.target.value)}
              />
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsNewCampaignModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              <Send className="w-3.5 h-3.5 mr-1" />
              {scheduleChoice === "now" ? "Dispatch Campaign" : "Schedule Wave"}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
