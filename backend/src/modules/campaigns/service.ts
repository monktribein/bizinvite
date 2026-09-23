import { Errors } from "../../common/errors/app-error";
import type { ActorContext } from "../../common/utils/context";
import { systemActor } from "../../common/utils/context";
import { logger } from "../../common/utils/logger";
import { CROSS_TENANT, isDuplicateKeyError, toObjectId } from "../../common/utils/model";
import { normalizeMobile } from "../../common/utils/mobile";
import type { Pagination } from "../../common/validators/common";
import { cancelPendingJobs, enqueueJob } from "../../scheduler/jobs";
import { recordAudit } from "../audit";
import { sendTemplateToGuest } from "../conversations/messaging.service";
import { INVALID_RECIPIENT_CODES, WhatsAppSendError } from "../conversations/whatsapp.client";
import { Event } from "../events/model";
import { findEventOrThrow } from "../events/service";
import { markMobileInvalid } from "../guests/consent.service";
import { EventGuest, Guest } from "../guests/model";
import { Organization } from "../organizations/model";
import { EventSession } from "../sessions/model";
import { buildVariableContext } from "../templates/context";
import { Template } from "../templates/model";
import { assertTemplateSendable, findTemplateOrThrow } from "../templates/service";
import { Campaign, CampaignDoc, CampaignRecipient } from "./model";
import type { CreateCampaignInput, UpdateCampaignInput } from "./schema";

const RECIPIENT_BATCH = 500;
const STALE_CLAIM_MS = 15 * 60 * 1000;
/** Recipients sent per run of the campaign.dispatch job; the job reschedules itself until none are left. */
export const CAMPAIGN_SEND_BATCH = 50;
/** Parallel WhatsApp sends within a batch (keeps well under Cloud API throughput limits). */
const SEND_CONCURRENCY = 5;
/** Transient send failures allowed per recipient before it is marked failed. */
const MAX_RECIPIENT_SEND_ATTEMPTS = 3;

type Metrics = { totalTargeted: number; sent: number; delivered: number; read: number; failed: number; suppressed: number; pending: number };

async function metricsFor(organizationId: string, campaignIds: string[]): Promise<Map<string, Metrics>> {
  const rows = await CampaignRecipient.aggregate<{ _id: { c: unknown; s: string }; n: number }>([
    { $match: { organizationId: toObjectId(organizationId), campaignId: { $in: campaignIds.map(toObjectId) } } },
    { $group: { _id: { c: "$campaignId", s: "$status" }, n: { $sum: 1 } } },
  ]);
  const map = new Map<string, Metrics>();
  for (const id of campaignIds) map.set(id, { totalTargeted: 0, sent: 0, delivered: 0, read: 0, failed: 0, suppressed: 0, pending: 0 });
  for (const row of rows) {
    const m = map.get(String(row._id.c))!;
    m.totalTargeted += row.n;
    // Cumulative funnel: a read message was also sent and delivered.
    if (["sent", "delivered", "read"].includes(row._id.s)) m.sent += row.n;
    if (["delivered", "read"].includes(row._id.s)) m.delivered += row.n;
    if (row._id.s === "read") m.read += row.n;
    if (row._id.s === "failed") m.failed += row.n;
    if (row._id.s === "suppressed") m.suppressed += row.n;
    if (row._id.s === "pending") m.pending += row.n;
  }
  return map;
}

/** Frontend `Campaign` shape. */
async function toCampaignDtos(organizationId: string, campaigns: CampaignDoc[]) {
  const ids = campaigns.map((c) => c.id as string);
  const [metrics, events] = await Promise.all([
    metricsFor(organizationId, ids),
    Event.find({ organizationId, _id: { $in: [...new Set(campaigns.map((c) => String(c.eventId)))] } }).select("name"),
  ]);
  const eventNames = new Map(events.map((e) => [e.id as string, e.name]));
  return campaigns.map((c) => {
    const m = metrics.get(c.id)!;
    return {
      id: c.id as string,
      organizationId: String(c.organizationId),
      eventId: String(c.eventId),
      eventName: eventNames.get(String(c.eventId)) ?? "",
      name: c.name,
      templateId: String(c.templateId),
      templateName: c.templateName,
      status: c.status,
      targetSegment: {
        category: c.targetSegment?.category ?? undefined,
        rsvpStatus: c.targetSegment?.rsvpStatus ?? undefined,
        onlyVip: c.targetSegment?.onlyVip ?? undefined,
        sessionIds: (c.targetSegment?.sessionIds ?? []).map(String),
        groupIds: (c.targetSegment?.groupIds ?? []).map(String),
        onlyUninvited: c.targetSegment?.onlyUninvited ?? undefined,
      },
      scheduledFor: c.scheduledFor?.toISOString(),
      startedAt: c.startedAt?.toISOString(),
      completedAt: c.completedAt?.toISOString(),
      metrics: { ...m, totalTargeted: Math.max(m.totalTargeted, c.totalTargeted ?? 0) },
      failureReason: c.failureReason ?? undefined,
      createdAt: (c.get("createdAt") as Date).toISOString(),
    };
  });
}

async function findCampaignOrThrow(organizationId: string, campaignId: string) {
  const campaign = await Campaign.findOne({ _id: campaignId, organizationId });
  if (!campaign) throw Errors.notFound("Campaign");
  return campaign;
}

export async function listCampaigns(organizationId: string, filters: { eventId?: string; status?: string }, page: Pagination) {
  const query: Record<string, unknown> = { organizationId };
  if (filters.eventId) query.eventId = filters.eventId;
  if (filters.status) query.status = filters.status;
  const [campaigns, total] = await Promise.all([
    Campaign.find(query)
      .sort({ createdAt: -1 })
      .skip((page.page - 1) * page.limit)
      .limit(page.limit),
    Campaign.countDocuments(query),
  ]);
  return { items: await toCampaignDtos(organizationId, campaigns), total };
}

export async function getCampaign(organizationId: string, campaignId: string) {
  const [dto] = await toCampaignDtos(organizationId, [await findCampaignOrThrow(organizationId, campaignId)]);
  return dto;
}

async function validateSegment(organizationId: string, eventId: string, segment: CreateCampaignInput["targetSegment"]) {
  if (segment.sessionIds?.length) {
    const n = await EventSession.countDocuments({ organizationId, eventId, _id: { $in: segment.sessionIds } });
    if (n !== new Set(segment.sessionIds).size) throw Errors.validation("Unknown session in segment", { "targetSegment.sessionIds": ["Unknown session"] });
  }
}

/**
 * Stores the campaign.dispatch job for the current generation, due at scheduledFor
 * (or now). Jobs of earlier generations are cancelled; they would be no-ops anyway.
 */
async function enqueueDispatch(campaign: CampaignDoc) {
  const organizationId = String(campaign.organizationId);
  await cancelPendingJobs(
    { organizationId, type: "campaign.dispatch", "payload.campaignId": campaign.id, "payload.generation": { $ne: campaign.dispatchGeneration } },
    "superseded"
  );
  const now = new Date();
  await enqueueJob({
    type: "campaign.dispatch",
    organizationId,
    payload: { campaignId: campaign.id, generation: campaign.dispatchGeneration },
    runAt: campaign.scheduledFor && campaign.scheduledFor > now ? campaign.scheduledFor : now,
    dedupeKey: `campaign:${campaign.id}:${campaign.dispatchGeneration}`,
    maxAttempts: 5,
  });
}

export async function createCampaign(actor: ActorContext, input: CreateCampaignInput) {
  const event = await findEventOrThrow(actor.organizationId, input.eventId);
  if (["cancelled", "completed"].includes(event.status)) throw Errors.conflict(`Cannot create a campaign for a ${event.status} event`);
  const template = await findTemplateOrThrow(actor.organizationId, input.templateId);
  assertTemplateSendable(template);
  await validateSegment(actor.organizationId, input.eventId, input.targetSegment);

  const scheduled = input.scheduledFor && input.scheduledFor.getTime() > Date.now();
  const status = input.draft ? "draft" : scheduled ? "scheduled" : "running";
  const campaign = await Campaign.create({
    organizationId: actor.organizationId,
    eventId: event._id,
    name: input.name,
    templateId: template._id,
    templateName: template.name,
    status,
    targetSegment: input.targetSegment,
    scheduledFor: input.scheduledFor,
    startedAt: status === "running" ? new Date() : undefined,
    createdBy: actor.userId,
  });
  if (status !== "draft") await enqueueDispatch(campaign);

  await recordAudit(actor, {
    action: status === "running" ? "campaign.sent" : "campaign.created",
    resourceType: "campaign",
    resourceId: campaign.id,
    details: `${status === "running" ? "Launched" : status === "scheduled" ? "Scheduled" : "Created"} campaign "${campaign.name}"`,
    metadata: { status, scheduledFor: input.scheduledFor, templateName: template.name, eventId: event.id },
  });
  return getCampaign(actor.organizationId, campaign.id);
}

export async function updateCampaign(actor: ActorContext, campaignId: string, changes: UpdateCampaignInput) {
  const campaign = await findCampaignOrThrow(actor.organizationId, campaignId);
  if (!["draft", "scheduled"].includes(campaign.status)) throw Errors.conflict(`A ${campaign.status} campaign cannot be edited`);
  if (changes.templateId) {
    const template = await findTemplateOrThrow(actor.organizationId, changes.templateId);
    assertTemplateSendable(template);
    campaign.templateId = template._id;
    campaign.templateName = template.name;
  }
  if (changes.targetSegment) {
    await validateSegment(actor.organizationId, String(campaign.eventId), changes.targetSegment);
    campaign.set("targetSegment", changes.targetSegment);
  }
  if (changes.name) campaign.name = changes.name;
  if (changes.scheduledFor !== undefined) campaign.scheduledFor = changes.scheduledFor ?? undefined;

  if (campaign.status === "scheduled") {
    campaign.dispatchGeneration += 1;
    if (!campaign.scheduledFor) campaign.status = "draft";
  }
  await campaign.save();
  if (campaign.status === "scheduled") await enqueueDispatch(campaign);
  await recordAudit(actor, { action: "campaign.updated", resourceType: "campaign", resourceId: campaign.id, details: `Updated campaign "${campaign.name}"`, metadata: { fields: Object.keys(changes) } });
  return getCampaign(actor.organizationId, campaignId);
}

/** Starts a draft/scheduled campaign now, or schedules it when scheduledFor is in the future. */
export async function sendCampaign(actor: ActorContext, campaignId: string) {
  const campaign = await findCampaignOrThrow(actor.organizationId, campaignId);
  if (!["draft", "scheduled"].includes(campaign.status)) throw Errors.conflict(`A ${campaign.status} campaign cannot be sent`);
  assertTemplateSendable(await findTemplateOrThrow(actor.organizationId, String(campaign.templateId)));
  campaign.dispatchGeneration += 1;
  campaign.scheduledFor = undefined;
  campaign.status = "running";
  campaign.startedAt = new Date();
  await campaign.save();
  await enqueueDispatch(campaign);
  await recordAudit(actor, { action: "campaign.sent", resourceType: "campaign", resourceId: campaign.id, details: `Launched campaign "${campaign.name}"` });
  return getCampaign(actor.organizationId, campaignId);
}

export async function pauseCampaign(actor: ActorContext, campaignId: string) {
  const campaign = await Campaign.findOneAndUpdate(
    { _id: campaignId, organizationId: actor.organizationId, status: { $in: ["running", "scheduled"] } },
    { $set: { status: "paused", pausedAt: new Date() }, $inc: { dispatchGeneration: 1 } },
    { new: true }
  );
  if (!campaign) {
    await findCampaignOrThrow(actor.organizationId, campaignId);
    throw Errors.conflict("Only running or scheduled campaigns can be paused");
  }
  await recordAudit(actor, { action: "campaign.paused", resourceType: "campaign", resourceId: campaign.id, details: `Paused campaign "${campaign.name}"` });
  return getCampaign(actor.organizationId, campaignId);
}

export async function resumeCampaign(actor: ActorContext, campaignId: string) {
  const current = await findCampaignOrThrow(actor.organizationId, campaignId);
  if (current.status !== "paused") throw Errors.conflict("Only paused campaigns can be resumed");
  const stillScheduled = !current.recipientsBuiltAt && current.scheduledFor && current.scheduledFor.getTime() > Date.now();
  const campaign = await Campaign.findOneAndUpdate(
    { _id: campaignId, organizationId: actor.organizationId, status: "paused" },
    {
      $set: { status: stillScheduled ? "scheduled" : "running", ...(stillScheduled ? {} : { startedAt: current.startedAt ?? new Date() }) },
      $unset: { pausedAt: 1 },
      $inc: { dispatchGeneration: 1 },
    },
    { new: true }
  );
  if (!campaign) throw Errors.conflict("Campaign state changed; please retry");
  await enqueueDispatch(campaign);
  await recordAudit(actor, { action: "campaign.resumed", resourceType: "campaign", resourceId: campaign.id, details: `Resumed campaign "${campaign.name}"` });
  return getCampaign(actor.organizationId, campaignId);
}

export async function cancelCampaign(actor: ActorContext, campaignId: string) {
  const campaign = await Campaign.findOneAndUpdate(
    { _id: campaignId, organizationId: actor.organizationId, status: { $in: ["draft", "scheduled", "running", "paused"] } },
    { $set: { status: "cancelled", cancelledAt: new Date() }, $inc: { dispatchGeneration: 1 } },
    { new: true }
  );
  if (!campaign) {
    await findCampaignOrThrow(actor.organizationId, campaignId);
    throw Errors.conflict("This campaign can no longer be cancelled");
  }
  await CampaignRecipient.updateMany(
    { organizationId: actor.organizationId, campaignId: campaign._id, status: "pending" },
    { $set: { status: "suppressed", suppressionReason: "campaign_cancelled" } }
  );
  await recordAudit(actor, { action: "campaign.cancelled", resourceType: "campaign", resourceId: campaign.id, details: `Cancelled campaign "${campaign.name}"` });
  return getCampaign(actor.organizationId, campaignId);
}

export async function cancelActiveCampaignsForEvent(actor: ActorContext, eventId: string) {
  const active = await Campaign.find({ organizationId: actor.organizationId, eventId, status: { $in: ["draft", "scheduled", "running", "paused"] } }).select("_id");
  for (const c of active) await cancelCampaign(actor, c.id as string);
}

/** Opt-out / suppression: pending sends to this contact are withdrawn. */
export async function suppressPendingRecipientsForGuest(organizationId: string, guestId: string, reason: string) {
  await CampaignRecipient.updateMany(
    { organizationId, guestId, status: "pending" },
    { $set: { status: "suppressed", suppressionReason: reason } }
  );
}

export async function listRecipients(organizationId: string, campaignId: string, filters: { status?: string }, page: Pagination) {
  await findCampaignOrThrow(organizationId, campaignId);
  const query: Record<string, unknown> = { organizationId, campaignId };
  if (filters.status) query.status = filters.status;
  const [items, total] = await Promise.all([
    CampaignRecipient.find(query)
      .sort({ guestName: 1 })
      .skip((page.page - 1) * page.limit)
      .limit(page.limit),
    CampaignRecipient.countDocuments(query),
  ]);
  return {
    items: items.map((r) => ({
      id: r.id as string,
      campaignId: String(r.campaignId),
      guestId: String(r.eventGuestId),
      guestName: r.guestName,
      mobile: r.mobile,
      status: r.status,
      sentAt: r.sentAt?.toISOString(),
      deliveredAt: r.deliveredAt?.toISOString(),
      readAt: r.readAt?.toISOString(),
      errorMessage: r.errorMessage ?? r.suppressionReason ?? undefined,
    })),
    total,
  };
}

/** Sends the campaign template to an arbitrary number for preview. Not counted in metrics. */
export async function sendTestMessage(actor: ActorContext, campaignId: string, rawMobile: string) {
  const campaign = await findCampaignOrThrow(actor.organizationId, campaignId);
  const template = await findTemplateOrThrow(actor.organizationId, String(campaign.templateId));
  assertTemplateSendable(template);
  const org = await Organization.findById(actor.organizationId);
  const mobile = normalizeMobile(rawMobile, org?.settings?.defaultCountryCode ?? "91");
  if (!mobile.valid) throw Errors.validation("Invalid mobile number", { mobile: [mobile.error] });
  const event = await findEventOrThrow(actor.organizationId, String(campaign.eventId));
  try {
    await sendTemplateToGuest({
      organizationId: actor.organizationId,
      mobile: mobile.e164,
      guestName: "Test recipient",
      eventId: event._id,
      template,
      context: buildVariableContext({ event, invitation: { name: "Test Guest", allowedCompanions: 1 }, organizationName: org?.name }),
      purpose: "test",
      campaignId: campaign._id,
    });
  } catch (err) {
    if (err instanceof WhatsAppSendError) throw Errors.whatsapp(`Test message failed: ${err.message}`, { code: err.code });
    throw err;
  }
  await recordAudit(actor, { action: "campaign.test_sent", resourceType: "campaign", resourceId: campaign.id, details: `Sent test message to ${mobile.e164}` });
  return { success: true, message: "Test WhatsApp message sent" };
}

// ---------------------------------------------------------------------------
// Background side (campaign.dispatch job)
// ---------------------------------------------------------------------------

function segmentQuery(campaign: CampaignDoc): Record<string, unknown> {
  const s: Partial<NonNullable<CampaignDoc["targetSegment"]>> = campaign.targetSegment ?? {};
  const query: Record<string, unknown> = {
    organizationId: campaign.organizationId,
    eventId: campaign.eventId,
    rsvpStatus: s.rsvpStatus ?? { $ne: "cancelled" },
  };
  if (s.category) query.category = s.category;
  if (s.onlyVip) query.isVip = true;
  if (s.sessionIds?.length) query.invitedSessionIds = { $in: s.sessionIds };
  if (s.groupIds?.length) query.groupId = { $in: s.groupIds };
  if (s.onlyUninvited) query.invitedAt = { $exists: false };
  return query;
}

async function currentCampaign(organizationId: string, campaignId: string, generation: number) {
  const campaign = await Campaign.findOne({ _id: campaignId, organizationId });
  if (!campaign || campaign.dispatchGeneration !== generation) return null;
  return campaign;
}

export type DispatchResult =
  | { skipped: string }
  | { sent: number; remaining: boolean; transientFailures: number };

/**
 * campaign.dispatch job: materializes recipients once (idempotent via the unique
 * campaignId+eventGuestId index), then sends one batch of pending recipients.
 * `remaining` tells the scheduler to run the job again for the next batch.
 */
export async function dispatchCampaign(
  data: { organizationId: string; campaignId: string; generation: number },
  batchSize = CAMPAIGN_SEND_BATCH
): Promise<DispatchResult> {
  let campaign = await currentCampaign(data.organizationId, data.campaignId, data.generation);
  if (!campaign) return { skipped: "stale_or_missing" };

  if (campaign.status === "scheduled") {
    campaign = await Campaign.findOneAndUpdate(
      { _id: campaign._id, organizationId: data.organizationId, status: "scheduled", dispatchGeneration: data.generation },
      { $set: { status: "running", startedAt: new Date() } },
      { new: true }
    );
    if (!campaign) return { skipped: "state_changed" };
  }
  if (campaign.status !== "running") return { skipped: campaign.status };

  const event = await Event.findOne({ _id: campaign.eventId, organizationId: data.organizationId });
  if (!event || event.status === "cancelled") {
    await Campaign.updateOne({ _id: campaign._id, organizationId: data.organizationId }, { $set: { status: "cancelled", cancelledAt: new Date(), failureReason: "Event cancelled" } });
    return { skipped: "event_cancelled" };
  }
  const template = await Template.findOne({ _id: campaign.templateId, organizationId: data.organizationId });
  if (!template || template.approvalStatus !== "APPROVED") {
    await Campaign.updateOne({ _id: campaign._id, organizationId: data.organizationId }, { $set: { status: "failed", failureReason: "Template is no longer approved" } });
    return { skipped: "template_not_approved" };
  }

  if (!campaign.recipientsBuiltAt) {
    let lastId: unknown = null;
    let total = 0;
    for (;;) {
      const batch = await EventGuest.find({ ...segmentQuery(campaign), ...(lastId ? { _id: { $gt: lastId } } : {}) })
        .sort({ _id: 1 })
        .limit(RECIPIENT_BATCH);
      if (batch.length === 0) break;
      lastId = batch[batch.length - 1]._id;
      const contacts = await Guest.find({ organizationId: data.organizationId, _id: { $in: batch.map((b) => b.guestId) } }).select(
        "optedOut communicationSuppressed mobileValid"
      );
      const byId = new Map(contacts.map((c) => [c.id as string, c]));
      const docs = batch.map((eg) => {
        const c = byId.get(String(eg.guestId));
        const reason = !c ? "contact_missing" : c.optedOut ? "opted_out" : c.communicationSuppressed ? "suppressed" : c.mobileValid === false ? "invalid_mobile" : null;
        return {
          organizationId: data.organizationId,
          campaignId: campaign!._id,
          eventId: campaign!.eventId,
          eventGuestId: eg._id,
          guestId: eg.guestId,
          guestName: eg.name,
          mobile: eg.mobile,
          status: reason ? "suppressed" : "pending",
          suppressionReason: reason ?? undefined,
        };
      });
      try {
        await CampaignRecipient.insertMany(docs, { ordered: false });
      } catch (err) {
        // A retried dispatch hits the unique index for already-created recipients: expected.
        if (!isDuplicateKeyError(err) && !(err as { writeErrors?: unknown[] }).writeErrors) throw err;
      }
      total += batch.length;
    }
    await Campaign.updateOne({ _id: campaign._id, organizationId: data.organizationId }, { $set: { recipientsBuiltAt: new Date(), totalTargeted: total } });
  }

  // A process that crashed mid-send leaves a stale claim. Delivery is unknown, so the
  // recipient is marked failed rather than risking a duplicate message.
  await CampaignRecipient.updateMany(
    { organizationId: data.organizationId, campaignId: campaign._id, status: "pending", claimedAt: { $lt: new Date(Date.now() - STALE_CLAIM_MS) } },
    { $set: { status: "failed", failedAt: new Date(), errorMessage: "Send interrupted; delivery unknown" } }
  );

  const batch = await CampaignRecipient.find({ organizationId: data.organizationId, campaignId: campaign._id, status: "pending", claimedAt: { $exists: false } })
    .sort({ _id: 1 })
    .limit(batchSize)
    .select("_id");

  let sent = 0;
  let transientFailures = 0;
  const todo = batch.map((r) => r.id as string);
  const sendNext = async (): Promise<void> => {
    for (let recipientId = todo.shift(); recipientId; recipientId = todo.shift()) {
      try {
        const res = await sendCampaignRecipient({ organizationId: data.organizationId, campaignId: campaign.id, recipientId, generation: data.generation });
        if ("sent" in res) sent++;
      } catch {
        // Already logged and released (or failed) by sendCampaignRecipient.
        transientFailures++;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SEND_CONCURRENCY, batch.length) }, sendNext));

  const done = await completeCampaignIfDone(data.organizationId, campaign.id);
  const remaining = !done && (await CampaignRecipient.exists({ organizationId: data.organizationId, campaignId: campaign._id, status: "pending" })) !== null;
  return { sent, remaining, transientFailures };
}

export async function completeCampaignIfDone(organizationId: string, campaignId: string) {
  const pending = await CampaignRecipient.countDocuments({ organizationId, campaignId, status: "pending" });
  if (pending > 0) return false;
  const done = await Campaign.findOneAndUpdate(
    { _id: campaignId, organizationId, status: "running", recipientsBuiltAt: { $exists: true } },
    { $set: { status: "completed", completedAt: new Date() } },
    { new: true }
  );
  if (done) {
    await recordAudit(systemActor(organizationId, "campaign-scheduler"), {
      action: "campaign.completed",
      resourceType: "campaign",
      resourceId: campaignId,
      details: `Campaign "${done.name}" finished sending`,
    });
  }
  return Boolean(done);
}

/**
 * whatsapp.send-campaign-message job. Claims the recipient atomically so a message is
 * sent at most once even if the job is retried or duplicated.
 */
export async function sendCampaignRecipient(data: { organizationId: string; campaignId: string; recipientId: string; generation: number }) {
  const campaign = await currentCampaign(data.organizationId, data.campaignId, data.generation);
  if (!campaign || campaign.status !== "running") return { skipped: "campaign_not_running" };

  const recipient = await CampaignRecipient.findOneAndUpdate(
    { _id: data.recipientId, organizationId: data.organizationId, campaignId: campaign._id, status: "pending", claimedAt: { $exists: false } },
    { $set: { claimedAt: new Date() } },
    { new: true }
  );
  if (!recipient) return { skipped: "already_processed" };

  const [contact, invitation, event, template, org] = await Promise.all([
    Guest.findOne({ _id: recipient.guestId, organizationId: data.organizationId }),
    EventGuest.findOne({ _id: recipient.eventGuestId, organizationId: data.organizationId }),
    Event.findOne({ _id: campaign.eventId, organizationId: data.organizationId }),
    Template.findOne({ _id: campaign.templateId, organizationId: data.organizationId }),
    Organization.findById(data.organizationId).select("name"),
  ]);

  const blockReason = !contact
    ? "contact_missing"
    : contact.optedOut
      ? "opted_out"
      : contact.communicationSuppressed
        ? "suppressed"
        : contact.mobileValid === false
          ? "invalid_mobile"
          : !invitation || invitation.rsvpStatus === "cancelled"
            ? "invitation_cancelled"
            : !event || event.status === "cancelled"
              ? "event_cancelled"
              : !template || template.approvalStatus !== "APPROVED"
                ? "template_not_approved"
                : null;
  if (blockReason) {
    await CampaignRecipient.updateOne({ _id: recipient._id, organizationId: data.organizationId }, { $set: { status: "suppressed", suppressionReason: blockReason } });
    await completeCampaignIfDone(data.organizationId, campaign.id);
    return { skipped: blockReason };
  }

  const sessions = invitation!.invitedSessionIds?.length
    ? await EventSession.find({ organizationId: data.organizationId, _id: { $in: invitation!.invitedSessionIds } }).select("name")
    : [];

  try {
    const message = await sendTemplateToGuest({
      organizationId: data.organizationId,
      mobile: contact!.mobile,
      guestName: contact!.name,
      guestId: contact!._id,
      eventGuestId: invitation!._id,
      eventId: event!._id,
      template: template!,
      context: buildVariableContext({ event: event!, invitation, organizationName: org?.name, sessionNames: sessions.map((s) => s.name) }),
      purpose: "campaign",
      campaignId: campaign._id,
      campaignRecipientId: recipient._id,
    });
    await CampaignRecipient.updateOne(
      { _id: recipient._id, organizationId: data.organizationId, status: "pending" },
      { $set: { status: "sent", sentAt: message.sentAt, messageId: message._id, waMessageId: message.waMessageId } }
    );
    await EventGuest.updateOne({ _id: invitation!._id, organizationId: data.organizationId, invitedAt: { $exists: false } }, { $set: { invitedAt: new Date() } });
  } catch (err) {
    if (err instanceof WhatsAppSendError && err.permanent) {
      await CampaignRecipient.updateOne(
        { _id: recipient._id, organizationId: data.organizationId },
        { $set: { status: "failed", failedAt: new Date(), errorCode: err.code, errorMessage: err.message.slice(0, 500) } }
      );
      if (err.code !== undefined && INVALID_RECIPIENT_CODES.has(err.code)) {
        await markMobileInvalid(systemActor(data.organizationId, "campaign-scheduler"), contact!, `WhatsApp error ${err.code}`);
      }
    } else if ((recipient.sendAttempts ?? 0) + 1 >= MAX_RECIPIENT_SEND_ATTEMPTS) {
      await CampaignRecipient.updateOne(
        { _id: recipient._id, organizationId: data.organizationId },
        { $set: { status: "failed", failedAt: new Date(), errorMessage: (err as Error).message.slice(0, 500) }, $inc: { sendAttempts: 1 } }
      );
      logger.warn({ err: (err as Error).message, recipientId: recipient.id }, "Campaign send failed on final attempt");
    } else {
      // Transient failure: release the claim so a later batch retries it.
      await CampaignRecipient.updateOne({ _id: recipient._id, organizationId: data.organizationId }, { $unset: { claimedAt: 1 }, $inc: { sendAttempts: 1 } });
      logger.warn({ err: (err as Error).message, recipientId: recipient.id }, "Campaign send failed; will retry");
      throw err;
    }
  }
  await completeCampaignIfDone(data.organizationId, campaign.id);
  return { sent: true };
}

/** Validates a job payload before trusting its ids. */
export async function assertCampaignJob(data: Record<string, unknown>) {
  const ok = typeof data.organizationId === "string" && typeof data.campaignId === "string" && typeof data.generation === "number";
  if (!ok) throw new Error("Invalid campaign job payload");
  const exists = await Campaign.exists({ _id: data.campaignId, organizationId: data.organizationId }).setOptions(CROSS_TENANT);
  if (!exists) throw new Error("Campaign not found for organization");
}
