import QRCode from "qrcode";
import { Errors } from "../../common/errors/app-error";
import type { ActorContext } from "../../common/utils/context";
import { systemActor } from "../../common/utils/context";
import { randomCode, randomToken } from "../../common/utils/crypto";
import { isDuplicateKeyError } from "../../common/utils/model";
import { searchRegex } from "../../common/utils/text";
import type { Pagination } from "../../common/validators/common";
import { env } from "../../config/env";
import { enqueueJob } from "../../scheduler/jobs";
import { recordAudit } from "../audit";
import { sendTemplateToGuest } from "../conversations/messaging.service";
import { WhatsAppSendError } from "../conversations/whatsapp.client";
import { Event, EventDoc } from "../events/model";
import { findEventOrThrow } from "../events/service";
import { applyPermanentSendFailure } from "../guests/consent.service";
import { communicationBlockReason } from "../guests/service";
import { EventGuest, EventGuestDoc, Guest } from "../guests/model";
import { Organization } from "../organizations/model";
import { buildVariableContext } from "../templates/context";
import { Template } from "../templates/model";
import { assertTemplateSendable, templateSendProblem } from "../templates/service";
import { Pass, PassDoc } from "./model";
import { hashPassToken, PASS_CODE_PATTERN, signPassToken, verifyPassToken } from "./token";

/** Passes stay valid until 12 hours after the event ends. */
const EXPIRY_GRACE_MS = 12 * 3600 * 1000;

export function passToken(pass: PassDoc): string {
  return signPassToken({
    p: pass.id as string,
    e: String(pass.eventId),
    g: String(pass.eventGuestId),
    x: pass.issuedAllowedPax,
    exp: Math.floor(pass.expiresAt.getTime() / 1000),
    n: pass.nonce,
  });
}

export function publicQrUrl(token: string): string {
  return `${env.PUBLIC_BASE_URL ?? ""}${env.API_PREFIX}/passes/qr/${token}.png`;
}

function effectiveStatus(pass: PassDoc, now = new Date()) {
  if (pass.status === "active" && pass.expiresAt < now) return "expired";
  return pass.status;
}

/** Frontend `DigitalPass` shape. */
export function toPassDto(pass: PassDoc, invitation: EventGuestDoc | undefined, eventName: string) {
  const token = passToken(pass);
  return {
    id: pass.id as string,
    passCode: pass.passCode,
    organizationId: String(pass.organizationId),
    eventId: String(pass.eventId),
    eventName,
    guestId: String(pass.eventGuestId),
    guestName: invitation?.name ?? "",
    guestMobile: invitation?.mobile ?? "",
    category: invitation?.category ?? "Family",
    isVip: invitation?.isVip ?? false,
    allowedPax: invitation ? 1 + invitation.allowedCompanions : pass.issuedAllowedPax,
    admittedPax: invitation?.checkedInCount ?? 0,
    status: effectiveStatus(pass),
    validSessions: (pass.validSessionIds ?? []).map(String),
    signedToken: token,
    qrPayloadUrl: publicQrUrl(token),
    deliveryStatus: pass.deliveryStatus,
    lastSentAt: pass.lastSentAt?.toISOString(),
    expiresAt: pass.expiresAt.toISOString(),
    createdAt: (pass.get("createdAt") as Date).toISOString(),
  };
}

async function passDtos(organizationId: string, passes: PassDoc[]) {
  const [invitations, events] = await Promise.all([
    EventGuest.find({ organizationId, _id: { $in: passes.map((p) => p.eventGuestId) } }),
    Event.find({ organizationId, _id: { $in: [...new Set(passes.map((p) => String(p.eventId)))] } }).select("name"),
  ]);
  const inv = new Map(invitations.map((i) => [i.id as string, i]));
  const names = new Map(events.map((e) => [e.id as string, e.name]));
  return passes.map((p) => toPassDto(p, inv.get(String(p.eventGuestId)), names.get(String(p.eventId)) ?? ""));
}

async function findPassOrThrow(organizationId: string, passId: string) {
  const pass = await Pass.findOne({ _id: passId, organizationId });
  if (!pass) throw Errors.notFound("Pass");
  return pass;
}

export async function listPasses(organizationId: string, filters: { eventId?: string; status?: string; search?: string }, page: Pagination) {
  const query: Record<string, unknown> = { organizationId, isCurrent: true };
  if (filters.eventId) query.eventId = filters.eventId;
  if (filters.status === "expired") {
    query.status = "active";
    query.expiresAt = { $lt: new Date() };
  } else if (filters.status) {
    query.status = filters.status;
    if (filters.status === "active") query.expiresAt = { $gte: new Date() };
  }
  if (filters.search) {
    const matches = await EventGuest.find({
      organizationId,
      ...(filters.eventId ? { eventId: filters.eventId } : {}),
      $or: [{ name: searchRegex(filters.search) }, { mobile: searchRegex(filters.search.replace(/\s/g, "")) }],
    })
      .limit(1000)
      .distinct("_id");
    query.$or = [{ eventGuestId: { $in: matches } }, { passCode: searchRegex(filters.search.toUpperCase()) }];
  }
  const [passes, total] = await Promise.all([
    Pass.find(query)
      .sort({ createdAt: -1 })
      .skip((page.page - 1) * page.limit)
      .limit(page.limit),
    Pass.countDocuments(query),
  ]);
  return { items: await passDtos(organizationId, passes), total };
}

export async function getPass(organizationId: string, passId: string) {
  const [dto] = await passDtos(organizationId, [await findPassOrThrow(organizationId, passId)]);
  return dto;
}

async function issuePass(organizationId: string, event: EventDoc, invitation: EventGuestDoc): Promise<PassDoc> {
  const year = event.startDate.getUTCFullYear();
  for (let attempt = 0; attempt < 5; attempt++) {
    const pass = new Pass({
      organizationId,
      eventId: event._id,
      eventGuestId: invitation._id,
      guestId: invitation.guestId,
      passCode: `BIZ-${year}-${randomCode(6)}`,
      nonce: randomToken(12),
      issuedAllowedPax: 1 + invitation.allowedCompanions,
      expiresAt: new Date(event.endDate.getTime() + EXPIRY_GRACE_MS),
      validSessionIds: invitation.invitedSessionIds,
      tokenHash: "pending",
    });
    pass.tokenHash = hashPassToken(passToken(pass));
    try {
      return await pass.save();
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      // Another request already issued the current pass for this invitation.
      const existing = await Pass.findOne({ organizationId, eventGuestId: invitation._id, isCurrent: true });
      if (existing) return existing;
      // Otherwise it was a pass-code collision: retry with a new code.
    }
  }
  throw Errors.conflict("Could not allocate a unique pass code; please retry");
}

/** Issues passes for an event's guests that do not have a current one. */
export async function generatePasses(actor: ActorContext, input: { eventId: string; guestIds?: string[]; onlyAttending: boolean }) {
  const event = await findEventOrThrow(actor.organizationId, input.eventId);
  if (event.status === "cancelled") throw Errors.conflict("Cannot issue passes for a cancelled event");
  const query: Record<string, unknown> = { organizationId: actor.organizationId, eventId: event._id, rsvpStatus: { $ne: "cancelled" } };
  if (input.guestIds?.length) query._id = { $in: input.guestIds };
  if (input.onlyAttending) query.rsvpStatus = "attending";

  const invitations = await EventGuest.find(query).limit(20000);
  const existing = new Set(
    (await Pass.find({ organizationId: actor.organizationId, eventId: event._id, isCurrent: true }).select("eventGuestId")).map((p) => String(p.eventGuestId))
  );
  let created = 0;
  for (const invitation of invitations) {
    if (existing.has(invitation.id)) continue;
    await issuePass(actor.organizationId, event, invitation);
    created++;
  }
  await recordAudit(actor, { action: "pass.generated", resourceType: "pass", resourceId: event.id, details: `Issued ${created} pass(es) for "${event.name}"` });
  return { created, skipped: invitations.length - created };
}

export async function revokePass(actor: ActorContext, passId: string, reason?: string) {
  const pass = await Pass.findOneAndUpdate(
    { _id: passId, organizationId: actor.organizationId, status: { $in: ["active", "used"] } },
    { $set: { status: "revoked", revokedAt: new Date(), revokedBy: actor.userId, revokeReason: reason } },
    { new: true }
  );
  if (!pass) {
    await findPassOrThrow(actor.organizationId, passId);
    throw Errors.conflict("Pass is already revoked or expired");
  }
  await recordAudit(actor, { action: "pass.revoked", resourceType: "pass", resourceId: pass.id, details: `Revoked pass ${pass.passCode}`, metadata: { reason } });
  return getPass(actor.organizationId, passId);
}

/** Replaces a pass (e.g. after revocation or a lost phone): new code, new token. */
export async function reissuePass(actor: ActorContext, passId: string) {
  const old = await findPassOrThrow(actor.organizationId, passId);
  const [event, invitation] = await Promise.all([
    findEventOrThrow(actor.organizationId, String(old.eventId)),
    EventGuest.findOne({ _id: old.eventGuestId, organizationId: actor.organizationId }),
  ]);
  if (!invitation) throw Errors.notFound("Guest");
  await Pass.updateOne(
    { _id: old._id, organizationId: actor.organizationId },
    { $set: { isCurrent: false, ...(old.status === "active" ? { status: "revoked", revokedAt: new Date(), revokeReason: "reissued" } : {}) } }
  );
  const pass = await issuePass(actor.organizationId, event, invitation);
  await recordAudit(actor, { action: "pass.reissued", resourceType: "pass", resourceId: pass.id, details: `Reissued pass ${old.passCode} as ${pass.passCode}` });
  return getPass(actor.organizationId, pass.id as string);
}

export async function queuePassDelivery(actor: ActorContext, passId: string) {
  const pass = await findPassOrThrow(actor.organizationId, passId);
  if (effectiveStatus(pass) !== "active") throw Errors.conflict(`Cannot send a ${effectiveStatus(pass)} pass`);
  const event = await findEventOrThrow(actor.organizationId, String(pass.eventId));
  const templateId = event.communication?.passTemplateId;
  if (!templateId) throw Errors.validation("Set a pass template on the event before sending passes", { passTemplateId: ["Not configured"] });
  const template = await Template.findOne({ _id: templateId, organizationId: actor.organizationId });
  if (!template) throw Errors.notFound("Template");
  assertTemplateSendable(template);
  // One send per pass per minute, whatever the number of clicks.
  const bucket = Math.floor(Date.now() / 60000);
  await enqueueJob({ type: "whatsapp.send-pass", organizationId: actor.organizationId, payload: { passId }, dedupeKey: `pass-send:${passId}:${bucket}` });
  await recordAudit(actor, { action: "pass.resent", resourceType: "pass", resourceId: pass.id, details: `Queued WhatsApp delivery of pass ${pass.passCode}` });
  return { success: true, message: "Pass queued for WhatsApp delivery" };
}

/** whatsapp.send-pass job. Throws on transient WhatsApp errors so the scheduler retries. */
export async function sendPass(data: { organizationId: string; passId: string }) {
  const pass = await Pass.findOne({ _id: data.passId, organizationId: data.organizationId });
  if (!pass || effectiveStatus(pass) !== "active") return { skipped: "pass_not_active" };
  const [event, invitation, contact, org] = await Promise.all([
    Event.findOne({ _id: pass.eventId, organizationId: data.organizationId }),
    EventGuest.findOne({ _id: pass.eventGuestId, organizationId: data.organizationId }),
    Guest.findOne({ _id: pass.guestId, organizationId: data.organizationId }),
    Organization.findById(data.organizationId).select("name"),
  ]);
  if (!event || !invitation) return { skipped: "missing_event_or_guest" };
  const block = communicationBlockReason(contact);
  if (block) return { skipped: block };
  const template = await Template.findOne({ _id: event.communication?.passTemplateId, organizationId: data.organizationId });
  if (!template || templateSendProblem(template)) return { skipped: "template_not_approved" };

  const token = passToken(pass);
  try {
    await sendTemplateToGuest({
      organizationId: data.organizationId,
      mobile: contact!.mobile,
      guestName: contact!.name,
      guestId: contact!._id,
      eventGuestId: invitation._id,
      eventId: event._id,
      template,
      context: buildVariableContext({ event, invitation, organizationName: org?.name, pass: { passCode: pass.passCode, url: publicQrUrl(token) } }),
      headerMediaUrl: env.PUBLIC_BASE_URL ? publicQrUrl(token) : undefined,
      purpose: "pass",
      passId: pass._id,
    });
    await Pass.updateOne({ _id: pass._id, organizationId: data.organizationId }, { $set: { deliveryStatus: "sent", lastSentAt: new Date() } });
    return { sent: true };
  } catch (err) {
    if (err instanceof WhatsAppSendError && err.permanent) {
      await Pass.updateOne({ _id: pass._id, organizationId: data.organizationId }, { $set: { deliveryStatus: "failed" } });
      await applyPermanentSendFailure(systemActor(data.organizationId, "pass-delivery"), contact!, err.code);
      return { failed: err.message };
    }
    throw err;
  }
}

export type PassValidation =
  | { valid: true; pass: PassDoc }
  | { valid: false; reason: "INVALID_PASS" | "REVOKED" | "EXPIRED" | "WRONG_EVENT"; message: string; pass?: PassDoc };

/**
 * Backend-authoritative pass check. Accepts either a signed QR token or a manually
 * typed pass code. The guest-supplied payload is only used to look the pass up; all
 * decisions come from the database record.
 */
export async function validatePass(organizationId: string, qrData: string, now = new Date(), eventId?: string): Promise<PassValidation> {
  const input = qrData.trim();
  let pass: PassDoc | null = null;

  if (input.startsWith("v1.")) {
    const check = verifyPassToken(input, now);
    if (!check.valid) {
      return check.reason === "expired"
        ? { valid: false, reason: "EXPIRED", message: "This pass has expired." }
        : { valid: false, reason: "INVALID_PASS", message: "Invalid or tampered QR code." };
    }
    pass = await Pass.findOne({ organizationId, tokenHash: hashPassToken(input) });
  } else if (PASS_CODE_PATTERN.test(input.toUpperCase())) {
    pass = await Pass.findOne({ organizationId, passCode: input.toUpperCase() });
  }

  if (!pass) return { valid: false, reason: "INVALID_PASS", message: "Pass not recognised for this organization." };
  if (eventId && String(pass.eventId) !== eventId) return { valid: false, reason: "WRONG_EVENT", message: "This pass is for a different event.", pass };
  if (pass.status === "revoked" || !pass.isCurrent) return { valid: false, reason: "REVOKED", message: "This pass has been revoked.", pass };
  if (effectiveStatus(pass, now) === "expired") return { valid: false, reason: "EXPIRED", message: "This pass has expired.", pass };
  return { valid: true, pass };
}

/** PNG for an authenticated organizer view. */
export async function passQrPng(organizationId: string, passId: string): Promise<Buffer> {
  const pass = await findPassOrThrow(organizationId, passId);
  return QRCode.toBuffer(passToken(pass), { type: "png", width: 512, margin: 2, errorCorrectionLevel: "M" });
}

/**
 * PNG for the public link sent to guests (and used as the WhatsApp header image).
 * Only a correctly signed, current, active token renders; the image reveals nothing
 * beyond the token already in the URL.
 */
export async function publicPassQrPng(token: string): Promise<Buffer> {
  const check = verifyPassToken(token);
  if (!check.valid) throw Errors.notFound("Pass");
  const pass = await Pass.findOne({ tokenHash: hashPassToken(token) }).setOptions({ skipTenantGuard: true });
  const renderable = pass && pass.isCurrent && (effectiveStatus(pass) === "active" || pass.status === "used");
  if (!renderable) throw Errors.notFound("Pass");
  return QRCode.toBuffer(token, { type: "png", width: 512, margin: 2, errorCorrectionLevel: "M" });
}
