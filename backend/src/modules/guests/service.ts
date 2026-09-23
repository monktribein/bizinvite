import { Errors } from "../../common/errors/app-error";
import type { ActorContext } from "../../common/utils/context";
import { isDuplicateKeyError } from "../../common/utils/model";
import { normalizeMobile } from "../../common/utils/mobile";
import { searchRegex } from "../../common/utils/text";
import type { Pagination } from "../../common/validators/common";
import { recordAudit } from "../audit";
import { findEventOrThrow } from "../events/service";
import { GuestGroup } from "../guest-groups/model";
import { Organization } from "../organizations/model";
import { cancelPendingRemindersForGuests } from "../reminder-rules/service";
import { EventSession } from "../sessions/model";
import { recordConsent } from "./consent.service";
import { EventGuest, EventGuestDoc, Guest, GuestDoc } from "./model";
import { guestRepository } from "./repository";
import type { CreateGuestInput, ListGuestsFilters, UpdateGuestInput } from "./schema";

/** Frontend `Guest` shape: one invitation joined with its contact. */
export function toGuestDto(invitation: EventGuestDoc, contact: GuestDoc | undefined, groupName?: string) {
  return {
    id: invitation.id as string,
    contactId: String(invitation.guestId),
    organizationId: String(invitation.organizationId),
    eventId: String(invitation.eventId),
    name: invitation.name,
    mobile: invitation.mobile,
    email: contact?.email ?? undefined,
    groupId: invitation.groupId ? String(invitation.groupId) : undefined,
    familyGroupName: groupName,
    category: invitation.category,
    isVip: invitation.isVip,
    city: contact?.city ?? undefined,
    preferredLanguage: contact?.preferredLanguage ?? "English",
    invitedSessionIds: (invitation.invitedSessionIds ?? []).map(String),
    allowedCompanions: invitation.allowedCompanions,
    confirmedCompanions: invitation.confirmedCompanions,
    relationshipWithHost: contact?.relationshipWithHost ?? undefined,
    assignedRelationshipManager: contact?.assignedRelationshipManager ?? undefined,
    consentSource: contact?.consentSource ?? "manual_entry",
    consentTimestamp: contact?.consentTimestamp?.toISOString(),
    optedOut: contact?.optedOut ?? false,
    communicationSuppressed: contact?.communicationSuppressed ?? false,
    mobileValid: contact?.mobileValid ?? true,
    rsvpStatus: invitation.rsvpStatus,
    rsvpResponseTime: invitation.rsvpResponseTime?.toISOString(),
    reminderStatus: invitation.reminderStatus,
    checkInStatus: invitation.checkInStatus,
    checkedInAt: invitation.checkedInAt?.toISOString(),
    checkedInCount: invitation.checkedInCount,
    notes: invitation.notes ?? undefined,
    createdAt: (invitation.get("createdAt") as Date).toISOString(),
    updatedAt: (invitation.get("updatedAt") as Date).toISOString(),
  };
}

export type GuestDto = ReturnType<typeof toGuestDto>;

/** Why messages must not be sent to this contact, or null when sending is allowed. */
export function communicationBlockReason(contact: Pick<GuestDoc, "optedOut" | "communicationSuppressed" | "mobileValid"> | null | undefined) {
  if (!contact) return "contact_missing";
  if (contact.optedOut) return "opted_out";
  if (contact.communicationSuppressed) return "suppressed";
  if (contact.mobileValid === false) return "invalid_mobile";
  return null;
}

export async function defaultCountryCode(organizationId: string): Promise<string> {
  const org = await Organization.findById(organizationId).select("settings");
  return org?.settings?.defaultCountryCode ?? "91";
}

async function assertSessions(organizationId: string, eventId: string, sessionIds: string[] | undefined) {
  if (!sessionIds?.length) return;
  const count = await EventSession.countDocuments({ organizationId, eventId, _id: { $in: sessionIds } });
  if (count !== new Set(sessionIds).size) {
    throw Errors.validation("One or more sessions do not belong to this event", { invitedSessionIds: ["Unknown session"] });
  }
}

async function assertGroup(organizationId: string, eventId: string, groupId: string | null | undefined) {
  if (!groupId) return;
  if (!(await GuestGroup.exists({ _id: groupId, organizationId, eventId }))) {
    throw Errors.validation("Guest group not found for this event", { groupId: ["Guest group not found"] });
  }
}

export async function listGuests(organizationId: string, filters: ListGuestsFilters, page: Pagination) {
  const query: Record<string, unknown> = { organizationId };
  if (filters.eventId) query.eventId = filters.eventId;
  if (filters.category) query.category = filters.category;
  if (filters.isVip !== undefined) query.isVip = filters.isVip;
  if (filters.rsvpStatus) query.rsvpStatus = filters.rsvpStatus;
  if (filters.checkInStatus) query.checkInStatus = filters.checkInStatus;
  if (filters.groupId) query.groupId = filters.groupId;
  if (filters.search) {
    const digits = filters.search.replace(/\D/g, "");
    query.$or = [{ name: searchRegex(filters.search) }, ...(digits.length >= 3 ? [{ mobile: searchRegex(digits) }] : [])];
  }

  const [invitations, total] = await Promise.all([
    EventGuest.find(query)
      .sort({ name: 1 })
      .skip((page.page - 1) * page.limit)
      .limit(page.limit),
    EventGuest.countDocuments(query),
  ]);
  const { contacts, groupNames } = await guestRepository.hydrate(organizationId, invitations);
  const items = invitations.map((i) =>
    toGuestDto(i, contacts.get(String(i.guestId)), i.groupId ? groupNames.get(String(i.groupId)) : undefined)
  );
  return { items, total };
}

export async function getGuest(organizationId: string, eventGuestId: string) {
  const invitation = await guestRepository.findInvitation(organizationId, eventGuestId);
  if (!invitation) throw Errors.notFound("Guest");
  const { contacts, groupNames } = await guestRepository.hydrate(organizationId, [invitation]);
  return toGuestDto(invitation, contacts.get(String(invitation.guestId)), invitation.groupId ? groupNames.get(String(invitation.groupId)) : undefined);
}

export async function createGuest(actor: ActorContext, input: CreateGuestInput) {
  const event = await findEventOrThrow(actor.organizationId, input.eventId);
  const mobile = normalizeMobile(input.mobile, await defaultCountryCode(actor.organizationId));
  if (!mobile.valid) throw Errors.validation("Invalid mobile number", { mobile: [mobile.error] });
  await assertSessions(actor.organizationId, input.eventId, input.invitedSessionIds);
  await assertGroup(actor.organizationId, input.eventId, input.groupId);

  const contactFields = {
    name: input.name,
    email: input.email,
    category: input.category,
    isVip: input.isVip,
    city: input.city,
    preferredLanguage: input.preferredLanguage,
    relationshipWithHost: input.relationshipWithHost,
    assignedRelationshipManager: input.assignedRelationshipManager,
  };
  const definedContactFields = Object.fromEntries(Object.entries(contactFields).filter(([, v]) => v !== undefined));

  let contact = await guestRepository.findContactByMobile(actor.organizationId, mobile.e164);
  let createdContact = false;
  if (contact) {
    const existingInvitation = await guestRepository.findInvitationForEvent(actor.organizationId, event.id, contact.id);
    if (existingInvitation) {
      throw Errors.conflict(`A guest with mobile ${mobile.e164} is already on this event`, {
        existingGuestId: existingInvitation.id,
        existingGuestName: existingInvitation.name,
      });
    }
    contact.set(definedContactFields);
    await contact.save();
  } else {
    try {
      contact = await Guest.create({
        ...definedContactFields,
        organizationId: actor.organizationId,
        mobile: mobile.e164,
        consentSource: "manual_entry",
        consentTimestamp: new Date(),
      });
      createdContact = true;
    } catch (err) {
      if (isDuplicateKeyError(err)) throw Errors.conflict(`A guest with mobile ${mobile.e164} already exists`);
      throw err;
    }
  }

  let invitation: EventGuestDoc;
  try {
    invitation = await EventGuest.create({
      organizationId: actor.organizationId,
      eventId: event._id,
      guestId: contact._id,
      groupId: input.groupId ?? undefined,
      name: contact.name,
      mobile: contact.mobile,
      category: contact.category,
      isVip: contact.isVip,
      invitedSessionIds: input.invitedSessionIds,
      allowedCompanions: input.allowedCompanions,
      notes: input.notes,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) throw Errors.conflict(`A guest with mobile ${mobile.e164} is already on this event`);
    throw err;
  }

  if (createdContact) {
    await recordConsent(actor, contact, { status: "opted_in", source: "manual_entry" });
  }
  await recordAudit(actor, {
    action: "guest.created",
    resourceType: "guest",
    resourceId: invitation.id,
    details: `Added ${contact.name} to "${event.name}"`,
    metadata: { eventId: event.id, reusedContact: !createdContact },
  });
  return toGuestDto(invitation, contact);
}

export async function updateGuest(actor: ActorContext, eventGuestId: string, changes: UpdateGuestInput) {
  const invitation = await guestRepository.findInvitation(actor.organizationId, eventGuestId);
  if (!invitation) throw Errors.notFound("Guest");
  const contact = await guestRepository.findContact(actor.organizationId, String(invitation.guestId));
  if (!contact) throw Errors.notFound("Guest");

  const { allowedCompanions, invitedSessionIds, groupId, notes, mobile: rawMobile, ...contactChanges } = changes;

  if (rawMobile !== undefined) {
    const mobile = normalizeMobile(rawMobile, await defaultCountryCode(actor.organizationId));
    if (!mobile.valid) throw Errors.validation("Invalid mobile number", { mobile: [mobile.error] });
    if (mobile.e164 !== contact.mobile) {
      const clash = await guestRepository.findContactByMobile(actor.organizationId, mobile.e164);
      if (clash) throw Errors.conflict(`Another guest already uses mobile ${mobile.e164}`, { existingGuestName: clash.name });
      contact.mobile = mobile.e164;
      // A corrected number is presumed valid again.
      contact.mobileValid = true;
      contact.mobileInvalidReason = undefined;
    }
  }
  contact.set(Object.fromEntries(Object.entries(contactChanges).filter(([, v]) => v !== undefined)));
  await contact.save();

  await assertSessions(actor.organizationId, String(invitation.eventId), invitedSessionIds);
  await assertGroup(actor.organizationId, String(invitation.eventId), groupId);
  if (allowedCompanions !== undefined) {
    invitation.allowedCompanions = allowedCompanions;
    if (invitation.confirmedCompanions > allowedCompanions) invitation.confirmedCompanions = allowedCompanions;
  }
  if (invitedSessionIds !== undefined) invitation.set("invitedSessionIds", invitedSessionIds);
  if (groupId !== undefined) invitation.set("groupId", groupId ?? undefined);
  if (notes !== undefined) invitation.notes = notes;
  await invitation.save();

  // Keep denormalized copies on every invitation of this contact in sync.
  await EventGuest.updateMany(
    { organizationId: actor.organizationId, guestId: contact._id },
    { $set: { name: contact.name, mobile: contact.mobile, category: contact.category, isVip: contact.isVip } }
  );

  await recordAudit(actor, {
    action: "guest.updated",
    resourceType: "guest",
    resourceId: invitation.id,
    details: `Updated guest ${contact.name}`,
    metadata: { fields: Object.keys(changes) },
  });
  return getGuest(actor.organizationId, eventGuestId);
}

/** Withdraws an invitation (keeps history; stops all communication for it). */
export async function cancelInvitation(actor: ActorContext, eventGuestId: string) {
  const invitation = await guestRepository.findInvitation(actor.organizationId, eventGuestId);
  if (!invitation) throw Errors.notFound("Guest");
  if (invitation.checkedInCount > 0) throw Errors.conflict("Guest has already checked in and cannot be removed");
  invitation.rsvpStatus = "cancelled";
  invitation.reminderStatus = "suppressed";
  await invitation.save();
  await cancelPendingRemindersForGuests(actor.organizationId, [invitation.id], "invitation_cancelled");
  await recordAudit(actor, {
    action: "guest.invitation_cancelled",
    resourceType: "guest",
    resourceId: invitation.id,
    details: `Cancelled invitation for ${invitation.name}`,
  });
  return getGuest(actor.organizationId, eventGuestId);
}
