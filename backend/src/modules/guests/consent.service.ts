import { Errors } from "../../common/errors/app-error";
import type { ActorContext } from "../../common/utils/context";
import type { Pagination } from "../../common/validators/common";
import { recordAudit } from "../audit";
import { suppressPendingRecipientsForGuest } from "../campaigns/service";
import { cancelPendingRemindersForGuests } from "../reminder-rules/service";
import { Consent, EventGuest, GuestDoc } from "./model";
import { guestRepository } from "./repository";

export async function recordConsent(
  actor: ActorContext,
  contact: GuestDoc,
  entry: { status: "opted_in" | "opted_out"; source: string; optOutReason?: string }
) {
  await Consent.create({
    organizationId: actor.organizationId,
    guestId: contact._id,
    guestName: contact.name,
    mobile: contact.mobile,
    channel: "whatsapp",
    recordedBy: actor.userId,
    ...entry,
  });
}

/** Frontend `ConsentRecord` list. */
export async function listConsents(organizationId: string, filters: { status?: string }, page: Pagination) {
  const query: Record<string, unknown> = { organizationId };
  if (filters.status) query.status = filters.status;
  const [items, total] = await Promise.all([
    Consent.find(query)
      .sort({ timestamp: -1 })
      .skip((page.page - 1) * page.limit)
      .limit(page.limit),
    Consent.countDocuments(query),
  ]);
  return {
    items: items.map((c) => ({
      id: c.id as string,
      guestId: String(c.guestId),
      guestName: c.guestName ?? "",
      mobile: c.mobile,
      channel: c.channel,
      status: c.status,
      source: c.source,
      optOutReason: c.optOutReason ?? undefined,
      timestamp: c.timestamp.toISOString(),
    })),
    total,
  };
}

/** Stops every pending communication for all invitations of one contact. */
async function haltCommunication(organizationId: string, contact: GuestDoc, reminderStatus: "opted_out" | "suppressed", reason: string) {
  const invitations = await EventGuest.find({ organizationId, guestId: contact._id }).select("_id");
  const ids = invitations.map((i) => i.id as string);
  await EventGuest.updateMany({ organizationId, guestId: contact._id }, { $set: { reminderStatus } });
  await cancelPendingRemindersForGuests(organizationId, ids, reason);
  await suppressPendingRecipientsForGuest(organizationId, contact.id, reason);
}

export async function optOutContact(actor: ActorContext, contact: GuestDoc, source: string, reason?: string) {
  if (!contact.optedOut) {
    contact.optedOut = true;
    contact.optedOutAt = new Date();
    await contact.save();
    await recordConsent(actor, contact, { status: "opted_out", source, optOutReason: reason });
  }
  await haltCommunication(actor.organizationId, contact, "opted_out", "opt_out");
  await recordAudit(actor, {
    action: "consent.opted_out",
    resourceType: "guest",
    resourceId: contact.id,
    details: `${contact.name} opted out (${source})`,
    metadata: { reason },
  });
}

export async function optInContact(actor: ActorContext, contact: GuestDoc, source: string) {
  if (!contact.optedOut) return;
  contact.optedOut = false;
  contact.optedOutAt = undefined;
  contact.consentSource = source === "whatsapp" ? "whatsapp_opt_in" : contact.consentSource;
  contact.consentTimestamp = new Date();
  await contact.save();
  await EventGuest.updateMany(
    { organizationId: actor.organizationId, guestId: contact._id, reminderStatus: "opted_out" },
    { $set: { reminderStatus: "none" } }
  );
  await recordConsent(actor, contact, { status: "opted_in", source });
  await recordAudit(actor, {
    action: "consent.opted_in",
    resourceType: "guest",
    resourceId: contact.id,
    details: `${contact.name} opted back in (${source})`,
  });
}

/** Resolves an invitation id (frontend guest id) or a contact id to the contact. */
export async function resolveContact(organizationId: string, id: string): Promise<GuestDoc> {
  const invitation = await guestRepository.findInvitation(organizationId, id);
  const contact = await guestRepository.findContact(organizationId, invitation ? String(invitation.guestId) : id);
  if (!contact) throw Errors.notFound("Guest");
  return contact;
}

export async function setSuppression(actor: ActorContext, contact: GuestDoc, suppressed: boolean, reason?: string) {
  contact.communicationSuppressed = suppressed;
  contact.suppressionReason = suppressed ? (reason ?? "organizer_request") : undefined;
  await contact.save();
  if (suppressed) {
    await haltCommunication(actor.organizationId, contact, "suppressed", "organizer_suppressed");
  } else {
    await EventGuest.updateMany(
      { organizationId: actor.organizationId, guestId: contact._id, reminderStatus: "suppressed", rsvpStatus: { $nin: ["attending", "declined", "cancelled"] } },
      { $set: { reminderStatus: "none" } }
    );
  }
  await recordAudit(actor, {
    action: suppressed ? "consent.suppressed" : "consent.unsuppressed",
    resourceType: "guest",
    resourceId: contact.id,
    details: `${suppressed ? "Suppressed" : "Resumed"} communication for ${contact.name}`,
    metadata: { reason },
  });
}

/** Called when WhatsApp reports the number cannot receive messages. */
export async function markMobileInvalid(actor: ActorContext, contact: GuestDoc, reason: string) {
  if (!contact.mobileValid) return;
  contact.mobileValid = false;
  contact.mobileInvalidReason = reason;
  await contact.save();
  const invitations = await EventGuest.find({ organizationId: actor.organizationId, guestId: contact._id }).select("_id");
  await EventGuest.updateMany({ organizationId: actor.organizationId, guestId: contact._id }, { $set: { reminderStatus: "failed" } });
  await cancelPendingRemindersForGuests(actor.organizationId, invitations.map((i) => i.id as string), "invalid_mobile");
  await recordAudit(actor, {
    action: "guest.mobile_invalid",
    resourceType: "guest",
    resourceId: contact.id,
    details: `WhatsApp could not deliver to ${contact.mobile}`,
    metadata: { reason },
  });
}
