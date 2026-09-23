import { CROSS_TENANT } from "../../common/utils/model";
import { EventGuest, EventGuestDoc, Guest, GuestDoc } from "./model";
import { GuestGroup } from "../guest-groups/model";

export const guestRepository = {
  findContactByMobile(organizationId: string, mobile: string) {
    return Guest.findOne({ organizationId, mobile });
  },

  findContact(organizationId: string, guestId: string) {
    return Guest.findOne({ _id: guestId, organizationId });
  },

  findInvitation(organizationId: string, eventGuestId: string) {
    return EventGuest.findOne({ _id: eventGuestId, organizationId });
  },

  findInvitationForEvent(organizationId: string, eventId: string, guestId: string) {
    return EventGuest.findOne({ organizationId, eventId, guestId });
  },

  /** Used by scheduled jobs holding only a payload; the organization is re-checked by callers. */
  findInvitationAnyTenant(eventGuestId: string) {
    return EventGuest.findById(eventGuestId).setOptions(CROSS_TENANT);
  },

  /** Loads contacts and group names for a page of invitations. */
  async hydrate(organizationId: string, invitations: EventGuestDoc[]) {
    const contactIds = [...new Set(invitations.map((i) => String(i.guestId)))];
    const groupIds = [...new Set(invitations.filter((i) => i.groupId).map((i) => String(i.groupId)))];
    const [contacts, groups] = await Promise.all([
      Guest.find({ organizationId, _id: { $in: contactIds } }),
      groupIds.length ? GuestGroup.find({ organizationId, _id: { $in: groupIds } }).select("name") : Promise.resolve([]),
    ]);
    return {
      contacts: new Map<string, GuestDoc>(contacts.map((c) => [c.id as string, c])),
      groupNames: new Map<string, string>(groups.map((g) => [g.id as string, g.name])),
    };
  },
};
