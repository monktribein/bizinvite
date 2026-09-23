import type { z } from "zod";
import { Errors } from "../../common/errors/app-error";
import type { ActorContext } from "../../common/utils/context";
import { isDuplicateKeyError, toObjectId } from "../../common/utils/model";
import { recordAudit } from "../audit";
import { findEventOrThrow } from "../events/service";
import { EventGuest } from "../guests/model";
import { GuestGroup, toGuestGroupDto } from "./model";
import type { createGroupSchema, updateGroupSchema } from "./schema";

async function assertMemberOfEvent(organizationId: string, eventId: string, eventGuestId: string | null | undefined) {
  if (!eventGuestId) return;
  if (!(await EventGuest.exists({ _id: eventGuestId, organizationId, eventId }))) {
    throw Errors.validation("Primary contact must be a guest of this event", { primaryContactGuestId: ["Guest not found"] });
  }
}

export async function listGroups(organizationId: string, eventId: string) {
  await findEventOrThrow(organizationId, eventId);
  const groups = await GuestGroup.find({ organizationId, eventId }).sort({ name: 1 });
  const counts = await EventGuest.aggregate<{ _id: unknown; count: number }>([
    { $match: { organizationId: toObjectId(organizationId), eventId: toObjectId(eventId), groupId: { $exists: true, $ne: null } } },
    { $group: { _id: "$groupId", count: { $sum: 1 } } },
  ]);
  const byGroup = new Map(counts.map((c) => [String(c._id), c.count]));
  return groups.map((g) => toGuestGroupDto(g, byGroup.get(g.id) ?? 0));
}

export async function createGroup(actor: ActorContext, input: z.infer<typeof createGroupSchema>) {
  await findEventOrThrow(actor.organizationId, input.eventId);
  await assertMemberOfEvent(actor.organizationId, input.eventId, input.primaryContactGuestId);
  try {
    const group = await GuestGroup.create({ ...input, organizationId: actor.organizationId });
    if (input.primaryContactGuestId) {
      await EventGuest.updateOne({ _id: input.primaryContactGuestId, organizationId: actor.organizationId }, { $set: { groupId: group._id } });
    }
    await recordAudit(actor, { action: "guest_group.created", resourceType: "guest", resourceId: group.id, details: `Created group "${group.name}"` });
    return toGuestGroupDto(group);
  } catch (err) {
    if (isDuplicateKeyError(err)) throw Errors.conflict("A group with this name already exists for the event");
    throw err;
  }
}

export async function updateGroup(actor: ActorContext, groupId: string, changes: z.infer<typeof updateGroupSchema>) {
  const group = await GuestGroup.findOne({ _id: groupId, organizationId: actor.organizationId });
  if (!group) throw Errors.notFound("Guest group");
  await assertMemberOfEvent(actor.organizationId, String(group.eventId), changes.primaryContactGuestId);
  group.set({ ...changes, primaryContactGuestId: changes.primaryContactGuestId === null ? undefined : changes.primaryContactGuestId ?? group.primaryContactGuestId });
  await group.save();
  return toGuestGroupDto(group);
}

export async function addMembers(actor: ActorContext, groupId: string, guestIds: string[]) {
  const group = await GuestGroup.findOne({ _id: groupId, organizationId: actor.organizationId });
  if (!group) throw Errors.notFound("Guest group");
  const result = await EventGuest.updateMany(
    { organizationId: actor.organizationId, eventId: group.eventId, _id: { $in: guestIds } },
    { $set: { groupId: group._id } }
  );
  await recordAudit(actor, {
    action: "guest_group.members_added",
    resourceType: "guest",
    resourceId: group.id,
    details: `Added ${result.modifiedCount} guest(s) to "${group.name}"`,
  });
  return { groupId: group.id as string, updated: result.modifiedCount };
}

export async function removeMembers(actor: ActorContext, groupId: string, guestIds: string[]) {
  const group = await GuestGroup.findOne({ _id: groupId, organizationId: actor.organizationId });
  if (!group) throw Errors.notFound("Guest group");
  const result = await EventGuest.updateMany(
    { organizationId: actor.organizationId, groupId: group._id, _id: { $in: guestIds } },
    { $unset: { groupId: 1 } }
  );
  return { groupId: group.id as string, updated: result.modifiedCount };
}
