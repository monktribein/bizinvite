"use client";

import React, { useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useAudiencePreview, useCampaigns } from "@/hooks/useCampaigns";
import { useGuests } from "@/hooks/useGuests";
import { GuestPicker } from "@/components/campaigns/GuestPicker";
import { useAuth } from "@/lib/auth/context";
import { campaignService } from "@/services/campaign.service";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { CreateTemplateModal } from "@/components/campaigns/CreateTemplateModal";
import { CampaignRecipientsModal } from "@/components/campaigns/CampaignRecipientsModal";
import { WhatsAppStatusBanner } from "@/components/campaigns/WhatsAppStatusBanner";
import { CAMPAIGN_STATUS_CONFIG } from "@/config/constants";
import { formatDate } from "@/lib/utils/formatters";
import { ApiError } from "@/lib/api/client";
import {
  CampaignGuestSelection,
  clearCampaignSelection,
  getCampaignSelection,
  getComposeRequest,
  markComposerOpened,
} from "@/lib/campaign-selection";
import { CAMPAIGN_MEDIA_LIMITS, Campaign, CampaignMedia, CampaignMediaType, CampaignTargetSegment, WhatsAppTemplate } from "@/types/campaign";
import { TemplateMappingModal } from "@/components/campaigns/TemplateMappingModal";
import {
  Send,
  Plus,
  Play,
  Pause,
  AlertCircle,
  Clock,
  ImageIcon,
  Video,
  Upload,
  X,
  RefreshCw,
  Users,
  Ban,
  FileText,
  ListChecks,
} from "lucide-react";

type AudienceMode = "segment" | "selected";

/** Segment dropdown values: "all", "uninvited", or a guest category. */
const SEGMENT_OPTIONS = [
  { value: "VVIP", label: "VVIP guests only" },
  { value: "VIP", label: "VIP tier" },
  { value: "Family", label: "Family circle" },
  { value: "Friend", label: "Friends" },
  { value: "Corporate", label: "Corporate & partners" },
];

const SUPPRESSION_LABELS: Record<string, string> = {
  opted_out: "opted out",
  suppressed: "suppressed",
  invalid_mobile: "invalid number",
  contact_missing: "removed",
};

/** A selection handed over from the Guests page ("Send invitation to N selected"). */
function readComposeHandoff(): CampaignGuestSelection | null {
  return typeof window === "undefined" ? null : getComposeRequest();
}

function describeSegment(segment: CampaignTargetSegment): string {
  const parts: string[] = [];
  const selected = segment.selectedGuestCount ?? segment.eventGuestIds?.length ?? 0;
  if (selected > 0) parts.push(`${selected} selected guest${selected === 1 ? "" : "s"}`);
  if (segment.category) parts.push(segment.category);
  if (segment.onlyVip) parts.push("VIP only");
  if (segment.rsvpStatus) parts.push(`RSVP: ${segment.rsvpStatus}`);
  if (segment.onlyUninvited) parts.push("not yet invited");
  return parts.length ? parts.join(" • ") : "All guests";
}

const MEDIA_ACCEPT = [...CAMPAIGN_MEDIA_LIMITS.image.mimeTypes, ...CAMPAIGN_MEDIA_LIMITS.video.mimeTypes].join(",");

function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

function errorMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.fields) return Object.values(err.fields).flat().join(" ") || err.message;
  return err instanceof Error ? err.message : fallback;
}

export default function CampaignsPage() {
  const { currentEventId, can } = useAuth();
  const {
    campaigns,
    isLoadingCampaigns,
    templates,
    isLoadingTemplates,
    templateCapabilities,
    createTemplate,
    syncTemplates,
    isSyncingTemplates,
    updateTemplateMapping,
    createCampaign,
    pauseCampaign,
    resumeCampaign,
    sendCampaign,
    cancelCampaign,
    refetchCampaigns,
  } = useCampaigns(currentEventId);

  const [activeTab, setActiveTab] = useState<"campaigns" | "templates">("campaigns");

  // Guests selected on the Guests page; the form opens in "Selected guests" mode for them.
  const [initialHandoff] = useState(readComposeHandoff);
  const [guestSelection, setGuestSelection] = useState<CampaignGuestSelection | null>(
    () => initialHandoff ?? (typeof window === "undefined" ? null : getCampaignSelection())
  );
  const [audienceMode, setAudienceMode] = useState<AudienceMode>(initialHandoff ? "selected" : "segment");
  useEffect(() => {
    // Handled: a reload or a later visit must not reopen the form (the selection itself stays available).
    if (initialHandoff) markComposerOpened();
  }, [initialHandoff]);

  // New Campaign Launcher Modal State
  const [isNewCampaignModalOpen, setIsNewCampaignModalOpen] = useState(initialHandoff !== null);
  const [campaignName, setCampaignName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [segmentChoice, setSegmentChoice] = useState<string>(initialHandoff ? "all" : "uninvited");

  // Campaign list actions
  const [recipientsCampaign, setRecipientsCampaign] = useState<Campaign | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Campaign | null>(null);
  const [actionError, setActionError] = useState("");
  const [busyCampaignId, setBusyCampaignId] = useState<string | null>(null);

  const runCampaignAction = async (campaignId: string, action: () => Promise<unknown>, fallback: string) => {
    setActionError("");
    setBusyCampaignId(campaignId);
    try {
      await action();
      return true;
    } catch (err) {
      setActionError(errorMessage(err, fallback));
      return false;
    } finally {
      setBusyCampaignId(null);
    }
  };

  // The event's guests for the form's picker. A selection made for another event is ignored.
  const { guests: eventGuests, isLoading: isLoadingGuests } = useGuests(currentEventId);
  const pickedIds = guestSelection && guestSelection.eventId === currentEventId ? guestSelection.eventGuestIds : [];
  const setPickedIds = (ids: string[]) => setGuestSelection({ eventId: currentEventId, eventGuestIds: ids });
  const usingSelection = audienceMode === "selected" && pickedIds.length > 0;

  const buildTargetSegment = (): CampaignTargetSegment => {
    const segment: CampaignTargetSegment = {};
    if (segmentChoice === "uninvited") segment.onlyUninvited = true;
    else if (segmentChoice !== "all") segment.category = segmentChoice;
    if (usingSelection) segment.eventGuestIds = pickedIds;
    return segment;
  };
  const targetSegment = buildTargetSegment();
  const audienceBlocked = audienceMode === "selected" && pickedIds.length === 0;
  const { data: audience, isFetching: isLoadingAudience } = useAudiencePreview(
    currentEventId,
    targetSegment,
    isNewCampaignModalOpen && !audienceBlocked && can("campaigns:create")
  );

  const switchAudienceMode = (mode: AudienceMode) => {
    setAudienceMode(mode);
    // "Selected guests" starts with no extra filter; the segment flow defaults to uninvited guests.
    setSegmentChoice(mode === "selected" ? "all" : "uninvited");
  };

  const [scheduleChoice, setScheduleChoice] = useState<"now" | "later">("now");
  const [scheduledDateTime, setScheduledDateTime] = useState("2026-10-01T10:00");
  const [mappingTemplate, setMappingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [launchError, setLaunchError] = useState("");
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);
  const [templateSyncMessage, setTemplateSyncMessage] = useState("");
  const [templateSyncError, setTemplateSyncError] = useState("");
  const isWhatsAppDryRun = templateCapabilities?.whatsapp?.dryRun ?? false;

  const handleSyncTemplates = async () => {
    setTemplateSyncMessage("");
    setTemplateSyncError("");
    try {
      const synced = await syncTemplates();
      setTemplateSyncMessage(`Synced ${synced.length} template${synced.length === 1 ? "" : "s"} from WhatsApp.`);
    } catch (err) {
      setTemplateSyncError(errorMessage(err, "Could not sync templates."));
    }
  };

  /** From the campaign form's empty state: go to the Templates tab (and open the test template form when possible). */
  const goToTemplates = () => {
    closeCampaignModal();
    setActiveTab("templates");
    if (isWhatsAppDryRun) setIsCreateTemplateOpen(true);
  };

  // Optional invitation image/video, uploaded as soon as it is picked
  const [campaignMedia, setCampaignMedia] = useState<CampaignMedia | null>(null);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: CampaignMediaType; name: string } | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState("");

  const clearMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview.url);
    setMediaPreview(null);
    setCampaignMedia(null);
  };

  const closeCampaignModal = () => {
    clearMedia();
    setMediaError("");
    setLaunchError("");
    setIsNewCampaignModalOpen(false);
  };

  const handleMediaSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMediaError("");

    const kind = (Object.keys(CAMPAIGN_MEDIA_LIMITS) as CampaignMediaType[]).find((k) =>
      CAMPAIGN_MEDIA_LIMITS[k].mimeTypes.includes(file.type)
    );
    if (!kind) {
      setMediaError("Only JPEG/PNG images or MP4/3GP videos can be attached.");
      return;
    }
    const limit = CAMPAIGN_MEDIA_LIMITS[kind];
    if (file.size > limit.maxBytes) {
      setMediaError(`${kind === "image" ? "Image" : "Video"} must be ${limit.label} or smaller (this file is ${formatFileSize(file.size)}).`);
      return;
    }

    clearMedia();
    const preview = { url: URL.createObjectURL(file), type: kind, name: file.name };
    setMediaPreview(preview);
    setIsUploadingMedia(true);
    try {
      setCampaignMedia(await campaignService.uploadCampaignMedia(file));
    } catch (err) {
      URL.revokeObjectURL(preview.url);
      setMediaPreview(null);
      setMediaError(errorMessage(err, "Could not upload the file."));
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Only templates Meta will accept: approved, fully mapped, and real (not local test templates) when live.
  const isSendable = (t: WhatsAppTemplate) =>
    t.approvalStatus === "APPROVED" && !t.mappingProblems?.length && !(t.source === "local" && !isWhatsAppDryRun);
  const approvedTemplates = templates.filter(isSendable);
  const unmappedApproved = templates.filter((t) => t.approvalStatus === "APPROVED" && !isSendable(t));
  const selectedTemplate = approvedTemplates.find((t) => t.id === selectedTemplateId) || approvedTemplates[0];

  // WhatsApp only carries media as the template header, so the approved template must declare a matching one
  const templateMediaType: CampaignMediaType | null =
    selectedTemplate?.headerType === "IMAGE" ? "image" : selectedTemplate?.headerType === "VIDEO" ? "video" : null;
  const mediaTemplateMismatch =
    !!campaignMedia && selectedTemplate?.source !== "local" && campaignMedia.type !== templateMediaType;
  // Meta rejects a media-header template sent without media.
  const headerMediaMissing =
    !!selectedTemplate &&
    selectedTemplate.source !== "local" &&
    ["IMAGE", "VIDEO", "DOCUMENT"].includes(selectedTemplate.headerType ?? "") &&
    !campaignMedia &&
    !selectedTemplate.headerMediaUrl;

  const [isSubmitting, setIsSubmitting] = useState<"send" | "draft" | null>(null);

  const submitCampaign = async (draft: boolean) => {
    if (!selectedTemplate || selectedTemplate.approvalStatus !== "APPROVED") {
      setLaunchError("Select an approved WhatsApp template first.");
      return;
    }
    if (!campaignName.trim()) {
      setLaunchError("Give the campaign a name.");
      return;
    }
    if (audienceBlocked) {
      setLaunchError("Select at least one guest to invite, or switch to Segment.");
      return;
    }

    setLaunchError("");
    setIsSubmitting(draft ? "draft" : "send");
    try {
      await createCampaign({
        eventId: currentEventId,
        name: campaignName,
        templateId: selectedTemplate.id,
        mediaId: campaignMedia?.id,
        draft: draft || undefined,
        scheduledFor: !draft && scheduleChoice === "later" ? new Date(scheduledDateTime).toISOString() : undefined,
        targetSegment,
      });
    } catch (err) {
      setLaunchError(errorMessage(err, "Could not create the campaign."));
      return;
    } finally {
      setIsSubmitting(null);
    }

    if (usingSelection) {
      // The selection has been saved on the campaign.
      clearCampaignSelection();
      setGuestSelection(null);
      switchAudienceMode("segment");
    }
    closeCampaignModal();
    setCampaignName("");
  };

  const handleLaunchCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    void submitCampaign(false);
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
            Send approved Meta WhatsApp templates, track real-time delivery status, and test messages.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {can("campaigns:create") && (
            <Button
              size="sm"
              onClick={() => {
                setSelectedTemplateId(approvedTemplates[0]?.id || "");
                switchAudienceMode(pickedIds.length ? "selected" : "segment");
                setIsNewCampaignModalOpen(true);
              }}
              className="text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> New Invitation Wave
            </Button>
          )}
        </div>
      </div>

      <WhatsAppStatusBanner />

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
          {actionError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {actionError}
            </p>
          )}
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
              const canStartNow = camp.status === "draft" || camp.status === "scheduled";
              const canCancel = ["draft", "scheduled", "running", "paused"].includes(camp.status);
              const canSend = can("campaigns:send");
              const isBusy = busyCampaignId === camp.id;

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
                          Template: <span className="font-mono font-medium text-slate-700">{camp.templateName}</span> • Target:{" "}
                          {describeSegment(camp.targetSegment)}
                        </p>
                        {camp.failureReason && (
                          <p className="text-xs text-rose-700 mt-0.5 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {camp.failureReason}
                          </p>
                        )}
                        {camp.media && (
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            {camp.media.type === "video" ? (
                              <Video className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                            )}
                            {camp.media.type === "video" ? "Video" : "Image"}: {camp.media.filename || "attachment"} ({formatFileSize(camp.media.size)})
                          </p>
                        )}
                      </div>

                      {/* Controls */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setRecipientsCampaign(camp)} className="text-xs text-indigo-700">
                          <ListChecks className="w-3.5 h-3.5 mr-1" /> Recipients
                        </Button>
                        {canSend && canStartNow && (
                          <Button
                            variant="primary"
                            size="sm"
                            isLoading={isBusy}
                            onClick={() => runCampaignAction(camp.id, () => sendCampaign(camp.id), "Could not start the campaign.")}
                            className="text-xs"
                          >
                            <Send className="w-3.5 h-3.5 mr-1" /> Send Now
                          </Button>
                        )}
                        {canSend && isRunning && (
                          <Button
                            variant="outline"
                            size="sm"
                            isLoading={isBusy}
                            onClick={() => runCampaignAction(camp.id, () => pauseCampaign(camp.id), "Could not pause the campaign.")}
                            className="text-xs text-amber-700"
                          >
                            <Pause className="w-3.5 h-3.5 mr-1" /> Pause Campaign
                          </Button>
                        )}
                        {canSend && isPaused && (
                          <Button
                            variant="primary"
                            size="sm"
                            isLoading={isBusy}
                            onClick={() => runCampaignAction(camp.id, () => resumeCampaign(camp.id), "Could not resume the campaign.")}
                            className="text-xs"
                          >
                            <Play className="w-3.5 h-3.5 mr-1" /> Resume Sending
                          </Button>
                        )}
                        {canSend && canCancel && (
                          <Button variant="outline" size="sm" disabled={isBusy} onClick={() => setCancelTarget(camp)} className="text-xs text-rose-700">
                            <Ban className="w-3.5 h-3.5 mr-1" /> Cancel
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
                        {isRunning && !camp.recipientsBuiltAt ? (
                          <p className="text-xs font-semibold text-slate-500 flex items-center gap-1 pt-1">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Preparing recipients...
                          </p>
                        ) : (
                          <p className="text-base font-bold text-slate-900">{camp.metrics?.totalTargeted || 0}</p>
                        )}
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
        <div className="mb-4 space-y-2">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-600">
              {isWhatsAppDryRun
                ? "WhatsApp is not connected: messages are logged by the server, not delivered. Create a test template to try campaigns."
                : "Templates are created and approved in Meta WhatsApp Manager, then synced here."}
            </p>
            {can("campaigns:create") && (
              <div className="flex shrink-0 gap-2">
                {isWhatsAppDryRun ? (
                  <Button size="sm" className="text-xs" onClick={() => setIsCreateTemplateOpen(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Create Test Template
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="text-xs" onClick={handleSyncTemplates} isLoading={isSyncingTemplates}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Sync from WhatsApp
                  </Button>
                )}
              </div>
            )}
          </div>
          {templateSyncMessage && <p className="text-xs text-emerald-700 font-semibold">{templateSyncMessage}</p>}
          {templateSyncError && <p className="text-xs text-rose-600">{templateSyncError}</p>}
          {!isLoadingTemplates && templates.length === 0 && (
            <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
              No templates yet.
            </div>
          )}
        </div>
      )}

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

                  {isApproved && tmpl.source === "local" && !isWhatsAppDryRun && (
                    <p className="text-[11px] text-rose-700">Local test template: it does not exist in WhatsApp and cannot be sent live.</p>
                  )}
                  {tmpl.mappingProblems && tmpl.mappingProblems.length > 0 && (
                    <ul className="text-[11px] text-amber-800 list-disc pl-4">
                      {tmpl.mappingProblems.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                    <span>
                      Variables: <b>{tmpl.variables.length}</b> placeholders
                      {["IMAGE", "VIDEO", "DOCUMENT"].includes(tmpl.headerType ?? "") && (
                        <Badge variant="info" size="sm" className="ml-1.5">
                          Needs {tmpl.headerType?.toLowerCase()}
                        </Badge>
                      )}
                    </span>
                    {tmpl.source !== "local" && (can("campaigns:create") || can("settings:manage")) && (
                      <Button
                        variant={tmpl.mappingProblems?.length ? "primary" : "ghost"}
                        size="sm"
                        className="text-[11px] h-7"
                        onClick={() => setMappingTemplate(tmpl)}
                      >
                        Map Fields
                      </Button>
                    )}
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

      <CreateTemplateModal
        isOpen={isCreateTemplateOpen}
        onClose={() => setIsCreateTemplateOpen(false)}
        variables={templateCapabilities?.variables ?? []}
        onCreate={createTemplate}
      />

      {/* New Campaign Creation Modal */}
      <Modal
        isOpen={isNewCampaignModalOpen}
        onClose={closeCampaignModal}
        title="Schedule Invitation Campaign"
        description={
          audienceMode === "selected"
            ? "Pick the guests to invite, choose an approved WhatsApp template, and send. Opt-outs and invalid numbers are always skipped."
            : "Select an approved WhatsApp template, choose your target audience, and send."
        }
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
              {unmappedApproved.length > 0 && (
                <p className="mb-1 text-[11px] text-amber-700">
                  {unmappedApproved.length} approved template{unmappedApproved.length === 1 ? " needs" : "s need"} fields mapped (Templates tab) before sending.
                </p>
              )}
              {approvedTemplates.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  No sendable templates yet.{" "}
                  <button type="button" onClick={goToTemplates} className="font-semibold underline cursor-pointer">
                    {isWhatsAppDryRun ? "Create a test template" : "Sync templates from WhatsApp"}
                  </button>
                </div>
              ) : (
              <select
                aria-label="Approved WhatsApp Template"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900"
              >
                {approvedTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.source === "local" ? "Test" : "Approved"} • {t.category})
                  </option>
                ))}
              </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                {usingSelection ? "Additional Filter (Optional)" : "Audience Segment"}
              </label>
              <select
                aria-label={usingSelection ? "Additional filter for selected guests" : "Audience Segment"}
                value={segmentChoice}
                onChange={(e) => setSegmentChoice(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              >
                {usingSelection ? (
                  <>
                    <option value="all">No extra filter: all selected guests</option>
                    <option value="uninvited">Only selected guests not yet invited</option>
                  </>
                ) : (
                  <>
                    <option value="uninvited">All guests not yet invited</option>
                    <option value="all">All guests (including already invited)</option>
                  </>
                )}
                {SEGMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {usingSelection ? `Only selected: ${o.label}` : o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Audience: segment, or the guests selected on the Guests page */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Audience</span>
              <div className="flex gap-1.5" role="radiogroup" aria-label="Audience mode">
                <button
                  type="button"
                  role="radio"
                  aria-checked={audienceMode === "segment"}
                  onClick={() => switchAudienceMode("segment")}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                    audienceMode === "segment" ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"
                  }`}
                >
                  Segment
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={audienceMode === "selected"}
                  onClick={() => switchAudienceMode("selected")}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                    audienceMode === "selected" ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"
                  }`}
                >
                  <Users className="w-3.5 h-3.5 inline mr-1" />
                  Selected guests ({pickedIds.length})
                </button>
              </div>
            </div>

            {audienceMode === "selected" && (
              <GuestPicker guests={eventGuests} selectedIds={pickedIds} onChange={setPickedIds} isLoading={isLoadingGuests} />
            )}
            {audienceBlocked ? (
              <p className="text-xs text-slate-500">Tick one or more guests to invite.</p>
            ) : (
              <p className="text-xs text-slate-600" aria-live="polite">
                {isLoadingAudience && !audience ? (
                  "Counting recipients..."
                ) : audience ? (
                  <>
                    <b className="text-slate-900">{audience.eligible}</b> guest{audience.eligible === 1 ? "" : "s"} will receive this invitation
                    {Object.entries(audience.suppressed).some(([, n]) => n) && (
                      <>
                        {" "}
                        • skipped:{" "}
                        {Object.entries(audience.suppressed)
                          .filter(([, n]) => n)
                          .map(([reason, n]) => `${n} ${SUPPRESSION_LABELS[reason] ?? reason}`)
                          .join(", ")}
                      </>
                    )}
                    {audience.selectedNotMatched > 0 && <> • {audience.selectedNotMatched} selected guest{audience.selectedNotMatched === 1 ? "" : "s"} excluded by the filter or a cancelled invitation</>}
                  </>
                ) : null}
              </p>
            )}
          </div>

          {/* Invitation Media (optional) */}
          <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Invitation Image / Video (Optional)
              </span>
              <span className="text-[11px] text-slate-500">
                Image JPEG/PNG up to {CAMPAIGN_MEDIA_LIMITS.image.label} • Video MP4/3GP up to {CAMPAIGN_MEDIA_LIMITS.video.label}
              </span>
            </div>

            {mediaPreview ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                {mediaPreview.type === "video" ? (
                  <video src={mediaPreview.url} className="h-16 w-24 rounded object-cover bg-black" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaPreview.url} alt="Invitation attachment preview" className="h-16 w-24 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0 text-xs">
                  <p className="font-semibold text-slate-800 truncate">{mediaPreview.name}</p>
                  <p className="text-slate-500">
                    {isUploadingMedia
                      ? "Uploading..."
                      : campaignMedia && `${campaignMedia.type === "video" ? "Video" : "Image"} • ${formatFileSize(campaignMedia.size)}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearMedia}
                  disabled={isUploadingMedia}
                  aria-label="Remove attachment"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 disabled:opacity-50 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs font-medium text-slate-600 hover:border-indigo-500 hover:text-indigo-600">
                <Upload className="w-4 h-4" />
                Attach an image or video
                <input type="file" accept={MEDIA_ACCEPT} onChange={handleMediaSelected} className="hidden" />
              </label>
            )}

            {mediaError && <p className="text-xs text-rose-600">{mediaError}</p>}
            {headerMediaMissing && (
              <p className="text-xs text-amber-700 flex items-start gap-1">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {selectedTemplate?.headerType === "DOCUMENT"
                  ? "This template was approved with a DOCUMENT header: set its document link in Map Fields before sending."
                  : `This template was approved with ${selectedTemplate?.headerType === "VIDEO" ? "a VIDEO" : "an IMAGE"} header: attach one to send it.`}
              </p>
            )}
            {mediaTemplateMismatch && (
              <p className="text-xs text-amber-700 flex items-start gap-1">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                WhatsApp sends media only as the template header. Pick a template approved with{" "}
                {campaignMedia?.type === "video" ? "a VIDEO" : "an IMAGE"} header, or remove the attachment.
              </p>
            )}
          </div>

          {/* Live Template Preview Container */}
          {selectedTemplate && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Live WhatsApp Message Preview:
              </span>
              <div className="rounded-lg bg-white p-3 border border-emerald-200/90 text-xs shadow-2xs">
                {mediaPreview?.type === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaPreview.url} alt="" className="mb-2 max-h-48 w-full rounded object-cover" />
                )}
                {mediaPreview?.type === "video" && (
                  <video src={mediaPreview.url} controls className="mb-2 max-h-48 w-full rounded bg-black" />
                )}
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

          {/* Dispatch Timing */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Send Schedule
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
                  Send
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
                  Schedule
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

          {launchError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{launchError}</p>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={closeCampaignModal}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              isLoading={isSubmitting === "draft"}
              disabled={isUploadingMedia || mediaTemplateMismatch || !selectedTemplate || audienceBlocked || isSubmitting !== null}
              onClick={() => void submitCampaign(true)}
            >
              <FileText className="w-3.5 h-3.5 mr-1" /> Save as Draft
            </Button>
            {can("campaigns:send") && (
              <Button
                type="submit"
                size="sm"
                isLoading={isSubmitting === "send"}
                disabled={isUploadingMedia || mediaTemplateMismatch || headerMediaMissing || !selectedTemplate || audienceBlocked || isSubmitting !== null || audience?.eligible === 0}
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                {scheduleChoice === "now" ? "Send Campaign" : "Schedule Campaign"}
              </Button>
            )}
          </div>
        </form>
      </Modal>

      <CampaignRecipientsModal
        campaign={recipientsCampaign}
        onClose={() => {
          setRecipientsCampaign(null);
          // The modal may have shown newer statuses than the card: bring the metrics up to date.
          void refetchCampaigns();
        }}
      />

      {mappingTemplate && (
        <TemplateMappingModal
          template={mappingTemplate}
          fields={templateCapabilities?.variables ?? []}
          onClose={() => setMappingTemplate(null)}
          onSave={(mapping) => updateTemplateMapping({ id: mappingTemplate.id, mapping })}
        />
      )}

      {/* Cancel confirmation */}
      <Modal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Cancel this campaign?"
        description={cancelTarget ? `"${cancelTarget.name}"` : undefined}
        maxWidth="md"
      >
        <div className="space-y-4 text-xs text-slate-700">
          <p>
            Guests who have not been messaged yet will not receive it. Messages already sent cannot be recalled. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setCancelTarget(null)}>
              Keep Campaign
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={!!cancelTarget && busyCampaignId === cancelTarget.id}
              onClick={async () => {
                if (!cancelTarget) return;
                const ok = await runCampaignAction(cancelTarget.id, () => cancelCampaign(cancelTarget.id), "Could not cancel the campaign.");
                if (ok) setCancelTarget(null);
              }}
            >
              <Ban className="w-3.5 h-3.5 mr-1" /> Cancel Campaign
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardShell>
  );
}
