import type { z } from "zod";
import { Errors } from "../../common/errors/app-error";
import type { ActorContext } from "../../common/utils/context";
import { recordAudit } from "../audit";
import { Event } from "../events/model";
import { EventSession, toSessionDto } from "./model";
import type { createSessionSchema, updateSessionSchema } from "./schema";

async function assertEvent(organizationId: string, eventId: string) {
  const event = await Event.findOne({ _id: eventId, organizationId });
  if (!event) throw Errors.notFound("Event");
  return event;
}

export async function listSessions(organizationId: string, eventId: string) {
  await assertEvent(organizationId, eventId);
  const sessions = await EventSession.find({ organizationId, eventId }).sort({ startTime: 1 });
  return sessions.map(toSessionDto);
}

export async function createSession(actor: ActorContext, input: z.infer<typeof createSessionSchema>) {
  await assertEvent(actor.organizationId, input.eventId);
  const session = await EventSession.create({ ...input, organizationId: actor.organizationId });
  await recordAudit(actor, {
    action: "session.created",
    resourceType: "event",
    resourceId: input.eventId,
    details: `Added session "${session.name}"`,
  });
  return toSessionDto(session);
}

export async function updateSession(actor: ActorContext, sessionId: string, changes: z.infer<typeof updateSessionSchema>) {
  const session = await EventSession.findOne({ _id: sessionId, organizationId: actor.organizationId });
  if (!session) throw Errors.notFound("Session");
  session.set(changes);
  if (session.endTime < session.startTime) {
    throw Errors.validation("endTime must be after startTime", { endTime: ["endTime must be after startTime"] });
  }
  await session.save();
  await recordAudit(actor, {
    action: "session.updated",
    resourceType: "event",
    resourceId: String(session.eventId),
    details: `Updated session "${session.name}"`,
    metadata: { sessionId, fields: Object.keys(changes) },
  });
  return toSessionDto(session);
}

export async function deleteSession(actor: ActorContext, sessionId: string) {
  const session = await EventSession.findOneAndDelete({ _id: sessionId, organizationId: actor.organizationId });
  if (!session) throw Errors.notFound("Session");
  await recordAudit(actor, {
    action: "session.deleted",
    resourceType: "event",
    resourceId: String(session.eventId),
    details: `Removed session "${session.name}"`,
  });
}
