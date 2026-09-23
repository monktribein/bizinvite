import { Errors } from "../../common/errors/app-error";
import type { ActorContext } from "../../common/utils/context";
import { toObjectId } from "../../common/utils/model";
import { searchRegex } from "../../common/utils/text";
import type { Pagination } from "../../common/validators/common";
import { recordAudit } from "../audit";
import { cancelActiveCampaignsForEvent } from "../campaigns/service";
import { EventGuest } from "../guests/model";
import { cancelPendingRemindersForEvent } from "../reminder-rules/service";
import { EventSession, toSessionDto } from "../sessions/model";
import { Template } from "../templates/model";
import { Event, EventDoc, Venue } from "./model";
import type { CreateEventInput, UpdateEventInput } from "./schema";

type GuestCounts = Map<string, { total: number; confirmed: number }>;

async function guestCounts(organizationId: string, eventIds: string[]): Promise<GuestCounts> {
  if (eventIds.length === 0) return new Map();
  const rows = await EventGuest.aggregate<{ _id: unknown; total: number; confirmed: number }>([
    {
      $match: {
        organizationId: toObjectId(organizationId),
        eventId: { $in: eventIds.map(toObjectId) },
        rsvpStatus: { $ne: "cancelled" },
      },
    },
    {
      $group: {
        _id: "$eventId",
        total: { $sum: 1 },
        confirmed: { $sum: { $cond: [{ $eq: ["$rsvpStatus", "attending"] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), { total: r.total, confirmed: r.confirmed }]));
}

/** Response shape matching frontend `Event`. */
export function toEventDto(event: EventDoc, sessions: ReturnType<typeof toSessionDto>[] = [], counts?: { total: number; confirmed: number }) {
  const json = event.toJSON() as Record<string, unknown>;
  return {
    ...json,
    organizationId: String(event.organizationId),
    venueId: event.venueId ? String(event.venueId) : undefined,
    createdBy: undefined,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
    rsvpDeadline: event.rsvpDeadline.toISOString(),
    communication: { passTemplateId: event.communication?.passTemplateId ? String(event.communication.passTemplateId) : undefined },
    sessions,
    totalGuestsCount: counts?.total ?? 0,
    confirmedGuestsCount: counts?.confirmed ?? 0,
  };
}

async function upsertVenue(organizationId: string, venue: CreateEventInput["venue"]) {
  return Venue.findOneAndUpdate(
    { organizationId, name: venue.name, city: venue.city ?? "" },
    { $set: { ...venue, organizationId } },
    { upsert: true, new: true }
  );
}

async function assertPassTemplate(organizationId: string, templateId: string | null | undefined) {
  if (!templateId) return;
  const exists = await Template.exists({ _id: templateId, organizationId });
  if (!exists) throw Errors.validation("Pass template not found", { "communication.passTemplateId": ["Template not found"] });
}

export async function findEventOrThrow(organizationId: string, eventId: string): Promise<EventDoc> {
  const event = await Event.findOne({ _id: eventId, organizationId });
  if (!event) throw Errors.notFound("Event");
  return event;
}

export async function listEvents(
  organizationId: string,
  filters: { search?: string; status?: string; category?: string },
  page: Pagination
) {
  const query: Record<string, unknown> = { organizationId };
  if (filters.status) query.status = filters.status;
  if (filters.category) query.category = filters.category;
  if (filters.search) query.name = searchRegex(filters.search);

  const [events, total] = await Promise.all([
    Event.find(query)
      .sort({ startDate: -1 })
      .skip((page.page - 1) * page.limit)
      .limit(page.limit),
    Event.countDocuments(query),
  ]);
  const ids = events.map((e) => e.id as string);
  const [counts, sessions] = await Promise.all([
    guestCounts(organizationId, ids),
    EventSession.find({ organizationId, eventId: { $in: ids } }).sort({ startTime: 1 }),
  ]);
  const items = events.map((e) =>
    toEventDto(
      e,
      sessions.filter((s) => String(s.eventId) === e.id).map(toSessionDto),
      counts.get(e.id)
    )
  );
  return { items, total };
}

export async function getEvent(organizationId: string, eventId: string) {
  const event = await findEventOrThrow(organizationId, eventId);
  const [sessions, counts] = await Promise.all([
    EventSession.find({ organizationId, eventId }).sort({ startTime: 1 }),
    guestCounts(organizationId, [eventId]),
  ]);
  return toEventDto(event, sessions.map(toSessionDto), counts.get(eventId));
}

export async function createEvent(actor: ActorContext, input: CreateEventInput) {
  await assertPassTemplate(actor.organizationId, input.communication?.passTemplateId);
  const venue = await upsertVenue(actor.organizationId, input.venue);
  const { sessions, ...fields } = input;
  const event = await Event.create({
    ...fields,
    organizationId: actor.organizationId,
    venueId: venue?._id,
    createdBy: actor.userId,
  });
  const createdSessions = sessions.length
    ? await EventSession.insertMany(sessions.map((s) => ({ ...s, organizationId: actor.organizationId, eventId: event._id })))
    : [];

  await recordAudit(actor, {
    action: "event.created",
    resourceType: "event",
    resourceId: event.id,
    details: `Created event "${event.name}"`,
  });
  return toEventDto(event, createdSessions.map((s) => toSessionDto(s as never)));
}

export async function updateEvent(actor: ActorContext, eventId: string, changes: UpdateEventInput) {
  const event = await findEventOrThrow(actor.organizationId, eventId);
  const previousStatus = event.status;

  if (changes.communication) await assertPassTemplate(actor.organizationId, changes.communication.passTemplateId);
  if (changes.venue) {
    const venue = await upsertVenue(actor.organizationId, changes.venue);
    event.venueId = venue?._id;
  }

  const { checkInConfig, rsvpConfig, reminderConfig, communication, ...rest } = changes;
  event.set(rest);
  // Nested configs are merged so partial updates do not reset other settings.
  if (checkInConfig) for (const [k, v] of Object.entries(checkInConfig)) event.set(`checkInConfig.${k}`, v);
  if (rsvpConfig) for (const [k, v] of Object.entries(rsvpConfig)) event.set(`rsvpConfig.${k}`, v);
  if (reminderConfig) for (const [k, v] of Object.entries(reminderConfig)) event.set(`reminderConfig.${k}`, v);
  if (communication && "passTemplateId" in communication) event.set("communication.passTemplateId", communication.passTemplateId ?? undefined);

  if (event.endDate < event.startDate) {
    throw Errors.validation("endDate must be on or after startDate", { endDate: ["endDate must be on or after startDate"] });
  }
  await event.save();

  if (event.status === "cancelled" && previousStatus !== "cancelled") {
    await cancelPendingRemindersForEvent(actor.organizationId, eventId, "event_cancelled");
    await cancelActiveCampaignsForEvent(actor, eventId);
  }

  await recordAudit(actor, {
    action: event.status !== previousStatus ? `event.status.${event.status}` : "event.updated",
    resourceType: "event",
    resourceId: event.id,
    details: `Updated event "${event.name}"`,
    metadata: { fields: Object.keys(changes), previousStatus, status: event.status },
  });
  return getEvent(actor.organizationId, eventId);
}
