import { Errors } from "../../common/errors/app-error";
import type { ActorContext } from "../../common/utils/context";
import { toObjectId } from "../../common/utils/model";
import { gateIdFromName, searchRegex } from "../../common/utils/text";
import { recordAudit } from "../audit";
import { Event, EventDoc } from "../events/model";
import { EventGuest, EventGuestDoc } from "../guests/model";
import { GuestGroup } from "../guest-groups/model";
import { Pass, PassDoc } from "../passes/model";
import { validatePass } from "../passes/service";
import { CheckIn, toCheckInDto } from "./model";

type Method = "qr" | "pass_code" | "manual" | "group";

export interface CheckInResponse {
  success: boolean;
  isDuplicate: boolean;
  message: string;
  reason?: string;
  guest?: {
    id: string;
    name: string;
    mobile: string;
    isVip: boolean;
    category: string;
    allowedPax: number;
    alreadyCheckedInPax: number;
    previousCheckInAt?: string;
    previousGate?: string;
  };
  record?: ReturnType<typeof toCheckInDto>;
}

function gateName(event: EventDoc, gateId: string): string {
  return event.checkInConfig?.activeGates?.find((g) => gateIdFromName(g) === gateId || g === gateId) ?? gateId;
}

function guestSummary(invitation: EventGuestDoc) {
  return {
    id: invitation.id as string,
    name: invitation.name,
    mobile: invitation.mobile,
    isVip: invitation.isVip,
    category: invitation.category,
    allowedPax: 1 + invitation.allowedCompanions,
    alreadyCheckedInPax: invitation.checkedInCount,
    previousCheckInAt: invitation.checkedInAt?.toISOString(),
    previousGate: invitation.lastCheckInGate ?? undefined,
  };
}

function formatTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-IN", { timeStyle: "short", timeZone }).format(date);
}

const MAX_CAS_RETRIES = 5;

/**
 * Admits up to `paxRequested` people for one invitation.
 *
 * Atomicity: the update is conditional on the admitted count read beforehand
 * (compare-and-set). If a concurrent scan changed it first, the update matches
 * nothing, state is re-read and re-evaluated, so two simultaneous scans can never
 * both admit the same seats.
 */
async function admit(
  actor: ActorContext,
  event: EventDoc,
  invitationId: string,
  input: { gateId: string; paxRequested: number; method: Method; pass?: PassDoc | null }
): Promise<CheckInResponse> {
  const gate = gateName(event, input.gateId);
  const tz = event.timezone ?? "Asia/Kolkata";

  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
    const invitation = await EventGuest.findOne({ _id: invitationId, organizationId: actor.organizationId, eventId: event._id });
    if (!invitation) throw Errors.notFound("Guest");

    const record = (status: "admitted" | "duplicate_warning" | "rejected", pax: number, reason?: string) =>
      CheckIn.create({
        organizationId: actor.organizationId,
        eventId: event._id,
        eventGuestId: invitation._id,
        guestId: invitation.guestId,
        passId: input.pass?._id,
        guestName: invitation.name,
        guestMobile: invitation.mobile,
        isVip: invitation.isVip,
        category: invitation.category,
        gateId: input.gateId,
        gateName: gate,
        method: input.method,
        paxAdmitted: pax,
        totalAllowedPax: 1 + invitation.allowedCompanions,
        status,
        reason,
        executiveUserId: actor.userId,
        executiveName: actor.userName,
      });

    if (invitation.rsvpStatus === "cancelled") {
      const rec = await record("rejected", 0, "invitation_cancelled");
      return { success: false, isDuplicate: false, reason: "INVITATION_CANCELLED", message: "This invitation has been cancelled.", guest: guestSummary(invitation), record: toCheckInDto(rec) };
    }

    const allowed = 1 + invitation.allowedCompanions;
    const already = invitation.checkedInCount;
    const remaining = allowed - already;
    const multipleEntries = event.checkInConfig?.allowMultipleEntries !== false;

    if (remaining <= 0 || (!multipleEntries && already > 0)) {
      const rec = await record("duplicate_warning", 0, "already_admitted");
      const when = invitation.checkedInAt ? formatTime(invitation.checkedInAt, tz) : "earlier";
      return {
        success: false,
        isDuplicate: true,
        reason: "DUPLICATE_CHECKIN",
        message: `Duplicate check-in: Guest was already admitted at ${when}${invitation.lastCheckInGate ? ` at ${invitation.lastCheckInGate}` : ""}.`,
        guest: guestSummary(invitation),
        record: toCheckInDto(rec),
      };
    }

    const pax = Math.max(1, Math.min(input.paxRequested, remaining));
    const newCount = already + pax;
    const now = new Date();
    const updated = await EventGuest.findOneAndUpdate(
      { _id: invitation._id, organizationId: actor.organizationId, checkedInCount: already },
      {
        $set: {
          checkedInCount: newCount,
          checkInStatus: newCount >= allowed ? "checked_in" : "partially_checked_in",
          lastCheckInGate: gate,
          ...(already === 0 ? { checkedInAt: now } : {}),
        },
      },
      { new: true }
    );
    if (!updated) continue; // lost the race: re-read and re-evaluate

    const pass = input.pass ?? (await Pass.findOne({ organizationId: actor.organizationId, eventGuestId: invitation._id, isCurrent: true }));
    if (pass) {
      await Pass.updateOne(
        { _id: pass._id, organizationId: actor.organizationId, status: { $in: ["active", "used"] } },
        { $set: { status: newCount >= allowed ? "used" : "active" } }
      );
    }

    const rec = await record("admitted", pax);
    await recordAudit(actor, {
      action: "checkin.admitted",
      resourceType: "checkin",
      resourceId: updated.id,
      details: `Admitted ${pax} for ${updated.name} at ${gate} (${input.method})`,
      metadata: { pax, total: newCount, allowed, gateId: input.gateId, method: input.method },
    });

    const partial = pax < input.paxRequested;
    return {
      success: true,
      isDuplicate: false,
      message: partial
        ? `Admitted ${pax} of ${input.paxRequested} requested; allowance is ${allowed}.`
        : `Admitted ${pax} guest${pax === 1 ? "" : "s"}.`,
      guest: { ...guestSummary(updated), previousCheckInAt: already > 0 ? invitation.checkedInAt?.toISOString() : undefined },
      record: toCheckInDto(rec),
    };
  }
  throw Errors.conflict("Check-in is being processed at another gate; please scan again");
}

async function activeEvent(organizationId: string, eventId: string) {
  const event = await Event.findOne({ _id: eventId, organizationId });
  if (!event) throw Errors.notFound("Event");
  if (event.status === "cancelled") throw Errors.conflict("This event has been cancelled");
  return event;
}

export async function scan(actor: ActorContext, input: { qrData: string; gateId: string; paxCount: number; eventId?: string }): Promise<CheckInResponse> {
  const result = await validatePass(actor.organizationId, input.qrData, new Date(), input.eventId);
  if (!result.valid) {
    if (result.pass) {
      const event = await Event.findOne({ _id: result.pass.eventId, organizationId: actor.organizationId });
      const invitation = await EventGuest.findOne({ _id: result.pass.eventGuestId, organizationId: actor.organizationId });
      if (event && invitation) {
        await CheckIn.create({
          organizationId: actor.organizationId,
          eventId: event._id,
          eventGuestId: invitation._id,
          guestId: invitation.guestId,
          passId: result.pass._id,
          guestName: invitation.name,
          guestMobile: invitation.mobile,
          gateId: input.gateId,
          gateName: gateName(event, input.gateId),
          method: input.qrData.startsWith("v1.") ? "qr" : "pass_code",
          totalAllowedPax: 1 + invitation.allowedCompanions,
          status: "rejected",
          reason: result.reason,
          executiveUserId: actor.userId,
          executiveName: actor.userName,
        });
        return { success: false, isDuplicate: false, reason: result.reason, message: result.message, guest: guestSummary(invitation) };
      }
    }
    return { success: false, isDuplicate: false, reason: result.reason, message: result.message };
  }
  const event = await activeEvent(actor.organizationId, String(result.pass.eventId));
  return admit(actor, event, String(result.pass.eventGuestId), {
    gateId: input.gateId,
    paxRequested: input.paxCount,
    method: input.qrData.startsWith("v1.") ? "qr" : "pass_code",
    pass: result.pass,
  });
}

export async function manualCheckIn(actor: ActorContext, input: { guestId: string; gateId: string; paxCount: number }): Promise<CheckInResponse> {
  const invitation = await EventGuest.findOne({ _id: input.guestId, organizationId: actor.organizationId });
  if (!invitation) throw Errors.notFound("Guest");
  const event = await activeEvent(actor.organizationId, String(invitation.eventId));
  return admit(actor, event, invitation.id as string, { gateId: input.gateId, paxRequested: input.paxCount, method: "manual" });
}

/** Admits every remaining seat for each member of a family/group. */
export async function groupCheckIn(actor: ActorContext, input: { groupId: string; gateId: string }) {
  const group = await GuestGroup.findOne({ _id: input.groupId, organizationId: actor.organizationId });
  if (!group) throw Errors.notFound("Guest group");
  const event = await activeEvent(actor.organizationId, String(group.eventId));
  const members = await EventGuest.find({ organizationId: actor.organizationId, groupId: group._id, rsvpStatus: { $ne: "cancelled" } });
  const results: CheckInResponse[] = [];
  for (const m of members) {
    const remaining = 1 + m.allowedCompanions - m.checkedInCount;
    results.push(await admit(actor, event, m.id as string, { gateId: input.gateId, paxRequested: Math.max(1, remaining), method: "group" }));
  }
  const admittedPax = results.reduce((sum, r) => sum + (r.success ? (r.record?.paxAdmitted ?? 0) : 0), 0);
  return {
    success: results.some((r) => r.success),
    groupName: group.name,
    admittedPax,
    message: `Admitted ${admittedPax} guest(s) from ${group.name}.`,
    results,
  };
}

/** Mobile / name lookup at the gate. */
export async function lookup(organizationId: string, input: { eventId: string; q: string }) {
  const digits = input.q.replace(/\D/g, "");
  const invitations = await EventGuest.find({
    organizationId,
    eventId: input.eventId,
    rsvpStatus: { $ne: "cancelled" },
    $or: [{ name: searchRegex(input.q) }, ...(digits.length >= 4 ? [{ mobile: searchRegex(digits) }] : [])],
  })
    .sort({ name: 1 })
    .limit(20);
  return invitations.map((i) => ({ ...guestSummary(i), rsvpStatus: i.rsvpStatus, checkInStatus: i.checkInStatus, groupId: i.groupId ? String(i.groupId) : undefined }));
}

/** Live gate counters (frontend `CheckInLiveSummary`). */
export async function liveSummary(organizationId: string, eventId?: string) {
  const org = toObjectId(organizationId);
  const match: Record<string, unknown> = { organizationId: org };
  if (eventId) match.eventId = toObjectId(eventId);

  const [totals] = await EventGuest.aggregate<{ expected: number; checkedIn: number }>([
    { $match: { ...match, rsvpStatus: { $ne: "cancelled" } } },
    {
      $group: {
        _id: null,
        expected: { $sum: { $cond: [{ $eq: ["$rsvpStatus", "attending"] }, { $add: [1, "$confirmedCompanions"] }, 0] } },
        checkedIn: { $sum: "$checkedInCount" },
      },
    },
  ]);
  const [recent, gates] = await Promise.all([
    CheckIn.find({ organizationId, ...(eventId ? { eventId } : {}) })
      .sort({ scannedAt: -1 })
      .limit(15),
    CheckIn.aggregate<{ _id: { id: string; name: string }; count: number }>([
      { $match: { ...match, status: "admitted" } },
      { $group: { _id: { id: "$gateId", name: "$gateName" }, count: { $sum: "$paxAdmitted" } } },
      { $sort: { count: -1 } },
    ]),
  ]);
  const expected = totals?.expected ?? 0;
  const checkedIn = totals?.checkedIn ?? 0;
  return {
    totalExpectedPax: expected,
    checkedInPax: checkedIn,
    pendingPax: Math.max(0, expected - checkedIn),
    recentScans: recent.map(toCheckInDto),
    gateBreakdown: gates.map((g) => ({ gateId: g._id.id, gateName: g._id.name, count: g.count })),
  };
}
