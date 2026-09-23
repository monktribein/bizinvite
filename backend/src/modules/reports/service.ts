import { toObjectId } from "../../common/utils/model";
import { Campaign, CampaignRecipient } from "../campaigns/model";
import { CheckIn } from "../check-ins/model";
import { Message } from "../conversations/model";
import { Event } from "../events/model";
import { EventGuest, Guest } from "../guests/model";
import { Organization } from "../organizations/model";
import { ScheduledJob } from "../../scheduler/model";
import { getRsvpSummary } from "../rsvps/service";

/** Human descriptions for common WhatsApp Cloud API error codes. */
export const WHATSAPP_ERROR_DESCRIPTIONS: Record<number, string> = {
  131026: "Recipient cannot receive WhatsApp messages (not on WhatsApp or unsupported client)",
  131021: "Recipient is the sender number",
  131047: "More than 24 hours since the guest's last reply (template required)",
  131049: "Meta limited delivery to protect user experience",
  131050: "Guest stopped marketing messages from this business",
  131048: "Spam rate limit reached",
  131056: "Too many messages to the same guest",
  130429: "Throughput rate limit reached",
  132000: "Template parameter count mismatch",
  132001: "Template does not exist or is not approved",
  132015: "Template paused due to low quality",
  132016: "Template disabled",
  131000: "Unknown WhatsApp error",
};

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

function scope(organizationId: string, eventId?: string) {
  return { organizationId: toObjectId(organizationId), ...(eventId ? { eventId: toObjectId(eventId) } : {}) };
}

async function eventMeta(organizationId: string, eventId?: string) {
  if (!eventId) {
    const org = await Organization.findById(organizationId).select("settings");
    return { eventId: "", eventName: "All events", timezone: org?.settings?.timezone ?? "Asia/Kolkata", event: null };
  }
  const event = await Event.findOne({ _id: eventId, organizationId });
  return { eventId, eventName: event?.name ?? "", timezone: event?.timezone ?? "Asia/Kolkata", event };
}

async function totalGuests(organizationId: string, eventId?: string) {
  return EventGuest.countDocuments({ organizationId, ...(eventId ? { eventId } : {}), rsvpStatus: { $ne: "cancelled" } });
}

/**
 * Invitation funnel per guest: the furthest delivery state reached by any campaign
 * message. Only states reported by the WhatsApp Cloud API are used (no "clicked").
 */
export async function invitationFunnel(organizationId: string, eventId?: string) {
  const meta = await eventMeta(organizationId, eventId);
  const rank = { $switch: { branches: [
    { case: { $eq: ["$status", "read"] }, then: 3 },
    { case: { $eq: ["$status", "delivered"] }, then: 2 },
    { case: { $eq: ["$status", "sent"] }, then: 1 },
  ], default: 0 } };
  const rows = await CampaignRecipient.aggregate<{ _id: number; n: number }>([
    { $match: scope(organizationId, eventId) },
    { $group: { _id: "$eventGuestId", best: { $max: rank } } },
    { $group: { _id: "$best", n: { $sum: 1 } } },
  ]);
  const at = (r: number) => rows.filter((row) => row._id >= r).reduce((a, b) => a + b.n, 0);
  const total = await totalGuests(organizationId, eventId);
  const sent = at(1);
  const delivered = at(2);
  const read = at(3);
  return {
    eventId: meta.eventId,
    eventName: meta.eventName,
    totalGuests: total,
    stages: [
      { stage: "Sent", count: sent, percentage: pct(sent, total) },
      { stage: "Delivered", count: delivered, percentage: pct(delivered, total) },
      { stage: "Read", count: read, percentage: pct(read, total) },
    ],
  };
}

export async function rsvpReport(organizationId: string, eventId?: string) {
  const s = await getRsvpSummary(organizationId, eventId);
  return {
    eventId: eventId ?? "",
    totalInvited: s.totalInvited,
    attending: s.attending,
    declined: s.declined,
    maybe: s.maybe,
    noResponse: s.noResponse,
    incomplete: s.incomplete,
    expectedFootfall: s.expectedFootfall,
    responseRatePercentage: pct(s.attending + s.declined + s.maybe, s.totalInvited),
  };
}

export async function attendanceReport(organizationId: string, eventId?: string) {
  const meta = await eventMeta(organizationId, eventId);
  const s = await getRsvpSummary(organizationId, eventId);
  const hourly = await CheckIn.aggregate<{ _id: string; count: number }>([
    { $match: { ...scope(organizationId, eventId), status: "admitted" } },
    { $group: { _id: { $dateToString: { format: "%H:00", date: "$scannedAt", timezone: meta.timezone } }, count: { $sum: "$paxAdmitted" } } },
    { $sort: { _id: 1 } },
  ]);
  const actual = hourly.reduce((a, b) => a + b.count, 0);
  const peak = hourly.reduce<{ _id: string; count: number } | null>((best, h) => (!best || h.count > best.count ? h : best), null);
  return {
    eventId: meta.eventId,
    totalExpected: s.expectedFootfall,
    actualCheckedIn: actual,
    turnoutPercentage: pct(actual, s.expectedFootfall),
    peakEntryHour: peak?._id ?? "",
    hourlyCheckIns: hourly.map((h) => ({ hour: h._id, count: h.count })),
  };
}

export async function reminderReport(organizationId: string, eventId?: string) {
  // Reminder attempts are reminder.send jobs: completed = sent, cancelled = stopped by a stop condition.
  const base = { ...scope(organizationId, eventId), type: "reminder.send" };
  const [sentCount, suppressedCount, firstReminders] = await Promise.all([
    ScheduledJob.countDocuments({ ...base, status: "completed" }),
    ScheduledJob.countDocuments({ ...base, status: "cancelled" }),
    ScheduledJob.aggregate<{ _id: unknown; first: Date }>([
      { $match: { ...base, status: "completed" } },
      { $group: { _id: "$eventGuestId", first: { $min: "$executedAt" } } },
    ]),
  ]);
  let converted = 0;
  if (firstReminders.length) {
    const firstBy = new Map(firstReminders.map((r) => [String(r._id), r.first]));
    const responded = await EventGuest.find({
      organizationId,
      _id: { $in: firstReminders.map((r) => r._id) },
      rsvpStatus: { $in: ["attending", "declined", "maybe"] },
    }).select("rsvpResponseTime");
    converted = responded.filter((g) => g.rsvpResponseTime && g.rsvpResponseTime > (firstBy.get(g.id as string) ?? new Date())).length;
  }
  return {
    eventId: eventId ?? "",
    remindersSent: sentCount,
    guestsReminded: firstReminders.length,
    rsvpsReceivedAfterReminder: converted,
    conversionRatePercentage: pct(converted, firstReminders.length),
    savingsFromSuppressionCount: suppressedCount,
  };
}

export async function failureReport(organizationId: string, eventId?: string) {
  const match = { ...scope(organizationId, eventId), direction: "outbound", status: "failed" };
  const [reasons, recent] = await Promise.all([
    Message.aggregate<{ _id: number | null; count: number; sample: string }>([
      { $match: match },
      { $group: { _id: "$errorCode", count: { $sum: 1 }, sample: { $first: "$errorMessage" } } },
      { $sort: { count: -1 } },
    ]),
    Message.find({ organizationId, ...(eventId ? { eventId } : {}), direction: "outbound", status: "failed" })
      .sort({ failedAt: -1 })
      .limit(25),
  ]);
  const campaignIds = [...new Set(recent.filter((m) => m.campaignId).map((m) => String(m.campaignId)))];
  const campaigns = campaignIds.length ? await Campaign.find({ organizationId, _id: { $in: campaignIds } }).select("name") : [];
  const campaignName = new Map(campaigns.map((c) => [c.id as string, c.name]));
  const guests = await Guest.find({ organizationId, _id: { $in: recent.filter((m) => m.guestId).map((m) => m.guestId) } }).select("name");
  const guestName = new Map(guests.map((g) => [g.id as string, g.name]));

  return {
    eventId: eventId ?? "",
    totalFailures: reasons.reduce((a, b) => a + b.count, 0),
    failureReasons: reasons.map((r) => ({
      reason: r._id === null || r._id === undefined ? "unknown" : String(r._id),
      count: r.count,
      description: (r._id ? WHATSAPP_ERROR_DESCRIPTIONS[r._id] : undefined) ?? r.sample ?? "Delivery failed",
    })),
    recentFailedRecipients: recent.map((m) => ({
      guestName: (m.guestId && guestName.get(String(m.guestId))) || m.mobile,
      mobile: m.mobile,
      campaignName: m.campaignId ? (campaignName.get(String(m.campaignId)) ?? "") : m.purpose,
      reason: m.errorMessage ?? (m.errorCode ? WHATSAPP_ERROR_DESCRIPTIONS[m.errorCode] : undefined) ?? "Delivery failed",
      failedAt: (m.failedAt ?? (m.get("updatedAt") as Date)).toISOString(),
    })),
  };
}

export async function eventSummary(organizationId: string, eventId?: string) {
  const meta = await eventMeta(organizationId, eventId);
  const [funnel, rsvp, attendance] = await Promise.all([
    invitationFunnel(organizationId, eventId),
    getRsvpSummary(organizationId, eventId),
    attendanceReport(organizationId, eventId),
  ]);
  const delivered = funnel.stages.find((s) => s.stage === "Delivered")?.count ?? 0;
  const sent = funnel.stages.find((s) => s.stage === "Sent")?.count ?? 0;
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: meta.timezone }).format(d);
  return {
    eventId: meta.eventId,
    eventName: meta.eventName,
    eventDates: meta.event ? `${fmt(meta.event.startDate)} – ${fmt(meta.event.endDate)}` : "",
    venueName: meta.event?.venue?.name ?? "",
    totalGuests: funnel.totalGuests,
    invitationsSent: sent,
    invitationsDelivered: delivered,
    deliveryRate: pct(delivered, sent),
    attendingCount: rsvp.attending,
    expectedFootfall: rsvp.expectedFootfall,
    actualCheckedInPax: attendance.actualCheckedIn,
    turnoutRate: attendance.turnoutPercentage,
  };
}
