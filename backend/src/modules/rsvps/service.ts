import { Errors } from "../../common/errors/app-error";
import { RESPONDED_RSVP_STATUSES, RSVPStatus } from "../../common/constants/enums";
import type { ActorContext } from "../../common/utils/context";
import { toObjectId } from "../../common/utils/model";
import { searchRegex } from "../../common/utils/text";
import type { Pagination } from "../../common/validators/common";
import { recordAudit } from "../audit";
import { Event, EventDoc } from "../events/model";
import { EventGuest, EventGuestDoc } from "../guests/model";
import { cancelPendingRemindersForGuests } from "../reminder-rules/service";
import { EventSession } from "../sessions/model";
import { GuestRequirement, GuestRequirementDoc, Rsvp, RsvpDoc, RsvpSource } from "./model";
import type { RequirementsInput } from "./schema";

/** Which requirement fields each rsvpConfig flag enables. */
const REQUIREMENT_FIELDS: Record<keyof RequirementsInput, keyof NonNullable<EventDoc["rsvpConfig"]>> = {
  dietaryPreference: "collectDietary",
  dietaryNotes: "collectDietary",
  needsAccommodation: "collectAccommodation",
  accommodationNotes: "collectAccommodation",
  needsTransport: "collectTransport",
  arrivalDetails: "collectArrivalDetails",
  specialRequests: "collectSpecialRequests",
};

/** Keeps only the requirement fields the event collects; reports the rest as ignored. */
export function filterRequirements(event: Pick<EventDoc, "rsvpConfig">, requirements: RequirementsInput = {}) {
  const accepted: RequirementsInput = {};
  const ignored: string[] = [];
  for (const [field, value] of Object.entries(requirements) as Array<[keyof RequirementsInput, unknown]>) {
    if (value === undefined) continue;
    if (event.rsvpConfig?.[REQUIREMENT_FIELDS[field]]) (accepted as Record<string, unknown>)[field] = value;
    else ignored.push(field);
  }
  return { accepted, ignored };
}

function requirementDto(r?: GuestRequirementDoc | null) {
  if (!r) return {};
  return {
    dietaryPreference: r.dietaryPreference ?? undefined,
    dietaryNotes: r.dietaryNotes ?? undefined,
    needsAccommodation: r.needsAccommodation ?? undefined,
    accommodationNotes: r.accommodationNotes ?? undefined,
    needsTransport: r.needsTransport ?? undefined,
    arrivalDetails: r.arrivalDetails ?? undefined,
    specialRequests: r.specialRequests ?? undefined,
  };
}

/** Frontend `RSVPRecord`: built from the invitation so guests without a response are included. */
function toRsvpDto(invitation: EventGuestDoc, rsvp?: RsvpDoc | null, requirement?: GuestRequirementDoc | null) {
  return {
    id: rsvp?.id ?? (invitation.id as string),
    guestId: invitation.id as string,
    guestName: invitation.name,
    guestMobile: invitation.mobile,
    eventId: String(invitation.eventId),
    status: invitation.rsvpStatus,
    attendingCount: invitation.rsvpStatus === "attending" ? 1 + invitation.confirmedCompanions : 0,
    companionsCount: invitation.rsvpStatus === "attending" ? invitation.confirmedCompanions : 0,
    allowedCompanions: invitation.allowedCompanions,
    attendingSessionIds: (rsvp?.attendingSessionIds ?? []).map(String),
    requirements: requirementDto(requirement),
    source: rsvp?.source,
    respondedAt: (rsvp?.respondedAt ?? invitation.rsvpResponseTime)?.toISOString(),
    updatedBy: rsvp?.updatedBy ?? undefined,
    history: (rsvp?.history ?? []).map((h) => ({
      previousStatus: h.previousStatus,
      newStatus: h.newStatus,
      changedAt: h.changedAt?.toISOString(),
      changedBy: h.changedBy,
      source: h.source,
      reason: h.reason ?? undefined,
    })),
  };
}

export async function listRsvps(organizationId: string, filters: { eventId?: string; status?: string; search?: string }, page: Pagination) {
  const query: Record<string, unknown> = { organizationId };
  if (filters.eventId) query.eventId = filters.eventId;
  if (filters.status) query.rsvpStatus = filters.status;
  if (filters.search) query.$or = [{ name: searchRegex(filters.search) }, { mobile: searchRegex(filters.search.replace(/\s/g, "")) }];

  const [invitations, total] = await Promise.all([
    EventGuest.find(query)
      .sort({ rsvpResponseTime: -1, name: 1 })
      .skip((page.page - 1) * page.limit)
      .limit(page.limit),
    EventGuest.countDocuments(query),
  ]);
  const ids = invitations.map((i) => i._id);
  const [rsvps, requirements] = await Promise.all([
    Rsvp.find({ organizationId, eventGuestId: { $in: ids } }),
    GuestRequirement.find({ organizationId, eventGuestId: { $in: ids } }),
  ]);
  const rsvpBy = new Map(rsvps.map((r) => [String(r.eventGuestId), r]));
  const reqBy = new Map(requirements.map((r) => [String(r.eventGuestId), r]));
  return { items: invitations.map((i) => toRsvpDto(i, rsvpBy.get(i.id), reqBy.get(i.id))), total };
}

export async function getRsvpSummary(organizationId: string, eventId?: string) {
  const match: Record<string, unknown> = { organizationId: toObjectId(organizationId), rsvpStatus: { $ne: "cancelled" } };
  if (eventId) match.eventId = toObjectId(eventId);

  const [row] = await EventGuest.aggregate<{
    totalInvited: number;
    attending: number;
    declined: number;
    maybe: number;
    noResponse: number;
    incomplete: number;
    checkedIn: number;
    totalCompanions: number;
    attendingNotCheckedIn: number;
  }>([
    { $match: match },
    {
      $group: {
        _id: null,
        totalInvited: { $sum: 1 },
        attending: { $sum: { $cond: [{ $eq: ["$rsvpStatus", "attending"] }, 1, 0] } },
        declined: { $sum: { $cond: [{ $eq: ["$rsvpStatus", "declined"] }, 1, 0] } },
        maybe: { $sum: { $cond: [{ $eq: ["$rsvpStatus", "maybe"] }, 1, 0] } },
        noResponse: { $sum: { $cond: [{ $eq: ["$rsvpStatus", "no_response"] }, 1, 0] } },
        incomplete: { $sum: { $cond: [{ $eq: ["$rsvpStatus", "incomplete"] }, 1, 0] } },
        checkedIn: { $sum: { $cond: [{ $ne: ["$checkInStatus", "not_checked_in"] }, 1, 0] } },
        totalCompanions: { $sum: { $cond: [{ $eq: ["$rsvpStatus", "attending"] }, "$confirmedCompanions", 0] } },
        attendingNotCheckedIn: {
          $sum: { $cond: [{ $and: [{ $eq: ["$rsvpStatus", "attending"] }, { $eq: ["$checkInStatus", "not_checked_in"] }] }, 1, 0] },
        },
      },
    },
  ]);

  // No-shows only exist once the event is over.
  let noShow = 0;
  if (eventId && row) {
    const event = await Event.findOne({ _id: eventId, organizationId }).select("endDate");
    if (event && event.endDate < new Date()) noShow = row.attendingNotCheckedIn;
  }

  const reqMatch: Record<string, unknown> = { organizationId: toObjectId(organizationId) };
  if (eventId) reqMatch.eventId = toObjectId(eventId);
  const attendingIds = await EventGuest.find({ organizationId, ...(eventId ? { eventId } : {}), rsvpStatus: "attending" }).distinct("_id");
  const [req] = await GuestRequirement.aggregate<Record<string, number>>([
    { $match: { ...reqMatch, eventGuestId: { $in: attendingIds } } },
    {
      $group: {
        _id: null,
        vegetarian: { $sum: { $cond: [{ $eq: ["$dietaryPreference", "vegetarian"] }, 1, 0] } },
        non_vegetarian: { $sum: { $cond: [{ $eq: ["$dietaryPreference", "non_vegetarian"] }, 1, 0] } },
        jain: { $sum: { $cond: [{ $eq: ["$dietaryPreference", "jain"] }, 1, 0] } },
        vegan: { $sum: { $cond: [{ $eq: ["$dietaryPreference", "vegan"] }, 1, 0] } },
        other: { $sum: { $cond: [{ $eq: ["$dietaryPreference", "other"] }, 1, 0] } },
        accommodation: { $sum: { $cond: [{ $eq: ["$needsAccommodation", true] }, 1, 0] } },
        transport: { $sum: { $cond: [{ $eq: ["$needsTransport", true] }, 1, 0] } },
      },
    },
  ]);

  const r = row ?? { totalInvited: 0, attending: 0, declined: 0, maybe: 0, noResponse: 0, incomplete: 0, checkedIn: 0, totalCompanions: 0 };
  return {
    totalInvited: r.totalInvited,
    attending: r.attending,
    declined: r.declined,
    maybe: r.maybe,
    noResponse: r.noResponse,
    incomplete: r.incomplete,
    checkedIn: r.checkedIn,
    noShow,
    expectedFootfall: r.attending + r.totalCompanions,
    totalCompanions: r.totalCompanions,
    dietaryCounts: {
      vegetarian: req?.vegetarian ?? 0,
      non_vegetarian: req?.non_vegetarian ?? 0,
      jain: req?.jain ?? 0,
      vegan: req?.vegan ?? 0,
      other: req?.other ?? 0,
    },
    accommodationRequestedCount: req?.accommodation ?? 0,
    transportRequestedCount: req?.transport ?? 0,
  };
}

export interface SetRsvpInput {
  status: RSVPStatus;
  count?: number;
  attendingSessionIds?: string[];
  requirements?: RequirementsInput;
  source: RsvpSource;
  reason?: string;
}

/**
 * Single entry point for every RSVP change (staff correction or WhatsApp reply).
 * Applies companion limits and requirement configuration, keeps history, and stops
 * pending reminders once the guest has responded.
 */
export async function setRsvp(actor: ActorContext, eventGuestId: string, input: SetRsvpInput) {
  const invitation = await EventGuest.findOne({ _id: eventGuestId, organizationId: actor.organizationId });
  if (!invitation) throw Errors.notFound("Guest");
  const event = await Event.findOne({ _id: invitation.eventId, organizationId: actor.organizationId });
  if (!event) throw Errors.notFound("Event");
  if (event.status === "cancelled") throw Errors.conflict("This event has been cancelled");

  let companions = invitation.confirmedCompanions;
  if (input.status === "attending") {
    if (input.count !== undefined) {
      if (input.count < 1) throw Errors.validation("Attending count must include the guest", { count: ["Must be at least 1"] });
      companions = input.count - 1;
    }
    if (companions > invitation.allowedCompanions) {
      throw Errors.validation(`This guest may bring at most ${invitation.allowedCompanions} companion(s)`, {
        count: [`Maximum is ${invitation.allowedCompanions + 1} including the guest`],
      });
    }
  } else {
    companions = 0;
  }

  if (input.attendingSessionIds?.length) {
    const n = await EventSession.countDocuments({ organizationId: actor.organizationId, eventId: event._id, _id: { $in: input.attendingSessionIds } });
    if (n !== new Set(input.attendingSessionIds).size) throw Errors.validation("Unknown session", { attendingSessionIds: ["Unknown session"] });
  }

  const previousStatus = invitation.rsvpStatus;
  const previousCount = previousStatus === "attending" ? 1 + invitation.confirmedCompanions : 0;
  const now = new Date();
  invitation.rsvpStatus = input.status;
  invitation.confirmedCompanions = companions;
  invitation.rsvpResponseTime = now;

  const responded = RESPONDED_RSVP_STATUSES.includes(input.status);
  if (responded && !["opted_out", "failed"].includes(invitation.reminderStatus)) invitation.reminderStatus = "suppressed";
  await invitation.save();

  const changedBy = actor.userName ?? "system";
  const rsvp = await Rsvp.findOneAndUpdate(
    { organizationId: actor.organizationId, eventGuestId: invitation._id },
    {
      $set: {
        eventId: event._id,
        guestId: invitation.guestId,
        status: input.status,
        attendingCount: input.status === "attending" ? companions + 1 : 0,
        companionsCount: companions,
        source: input.source,
        respondedAt: now,
        updatedBy: changedBy,
        ...(input.attendingSessionIds ? { attendingSessionIds: input.attendingSessionIds } : {}),
      },
      $push: {
        history: {
          $each: [
            {
              previousStatus,
              newStatus: input.status,
              previousCount,
              newCount: input.status === "attending" ? companions + 1 : 0,
              changedAt: now,
              changedBy,
              source: input.source,
              reason: input.reason,
            },
          ],
          $slice: -50,
        },
      },
      $setOnInsert: { organizationId: actor.organizationId, eventGuestId: invitation._id },
    },
    { upsert: true, new: true }
  );

  const { accepted, ignored } = filterRequirements(event, input.requirements);
  let requirement: GuestRequirementDoc | null = null;
  if (Object.keys(accepted).length) {
    requirement = await GuestRequirement.findOneAndUpdate(
      { organizationId: actor.organizationId, eventGuestId: invitation._id },
      { $set: { ...accepted, eventId: event._id }, $setOnInsert: { organizationId: actor.organizationId, eventGuestId: invitation._id } },
      { upsert: true, new: true }
    );
  } else {
    requirement = await GuestRequirement.findOne({ organizationId: actor.organizationId, eventGuestId: invitation._id });
  }

  if (responded) await cancelPendingRemindersForGuests(actor.organizationId, [invitation.id], "rsvp_received");

  await recordAudit(actor, {
    action: input.source === "manual_staff_entry" || input.source === "phone_call" ? "rsvp.manual_update" : "rsvp.guest_response",
    resourceType: "rsvp",
    resourceId: invitation.id,
    details: `${invitation.name}: ${previousStatus} → ${input.status}${input.status === "attending" ? ` (${companions + 1} pax)` : ""}`,
    metadata: { source: input.source, previousStatus, status: input.status, companions, reason: input.reason, ignoredRequirements: ignored },
  });

  return { record: toRsvpDto(invitation, rsvp, requirement), ignoredRequirements: ignored };
}
