import { env } from "../../config/env";
import { isWhatsAppDryRun } from "../../config/whatsapp";
import { sendSessionToGuest } from "../conversations/messaging.service";
import { Message } from "../conversations/model";
import { WhatsAppSendError } from "../conversations/whatsapp.client";
import { Event } from "../events/model";
import { EventGuest, Guest } from "../guests/model";
import { communicationBlockReason } from "../guests/service";
import { Organization } from "../organizations/model";
import { ensureCurrentPass, passToken, publicQrUrl } from "../passes/service";
import { Pass } from "../passes/model";
import { buildVariableContext } from "../templates/context";

export type QuickReplyStatus = "attending" | "declined" | "maybe";

/**
 * whatsapp.rsvp-reply job: answers a guest's RSVP button tap. The tap opens WhatsApp's
 * 24-hour window, so these are free-form messages (no approved template needed).
 * "Yes" also delivers the guest's QR entry pass, issued on first use.
 */
export async function sendRsvpReply(data: { organizationId: string; eventGuestId: string; status: QuickReplyStatus; jobId?: string }) {
  const invitation = await EventGuest.findOne({ _id: data.eventGuestId, organizationId: data.organizationId });
  if (!invitation) return { skipped: "invitation_missing" };
  // A later tap changed the answer: that tap has its own reply.
  if (invitation.rsvpStatus !== data.status) return { skipped: "rsvp_changed" };
  const [event, contact, org] = await Promise.all([
    Event.findOne({ _id: invitation.eventId, organizationId: data.organizationId }),
    Guest.findOne({ _id: invitation.guestId, organizationId: data.organizationId }),
    Organization.findById(data.organizationId).select("name"),
  ]);
  if (!event || event.status === "cancelled") return { skipped: "event_unavailable" };
  const block = communicationBlockReason(contact);
  if (block) return { skipped: block };

  const ctx = buildVariableContext({ event, invitation, organizationName: org?.name });
  const when = [ctx.event_date, ctx.event_time].filter(Boolean).join(" at ");
  const where = ctx.venue ? `, ${ctx.venue}` : "";
  const recipient = {
    organizationId: data.organizationId,
    mobile: contact!.mobile,
    guestName: contact!.name,
    guestId: contact!._id,
    eventGuestId: invitation._id,
    eventId: event._id,
    scheduledJobId: data.jobId,
  };
  // A retried job skips the messages its earlier run already sent.
  const alreadySent = async (purpose: "reply" | "pass") =>
    Boolean(data.jobId) &&
    (await Message.exists({ organizationId: data.organizationId, scheduledJobId: data.jobId, purpose, status: { $ne: "failed" } })) !== null;

  try {
    if (data.status === "declined") {
      await sendSessionToGuest({
        ...recipient,
        purpose: "reply",
        text: `Thank you for letting us know, ${ctx.guest_name}. We're sorry you can't make it to ${event.name}.\n\nIf your plans change, just tap "Yes, I will attend" on the invitation.`,
      });
      return { replied: "declined" };
    }

    if (data.status === "maybe") {
      const deadline = ctx.rsvp_deadline ? ` by ${ctx.rsvp_deadline}` : "";
      await sendSessionToGuest({
        ...recipient,
        purpose: "reply",
        text: `Thanks, ${ctx.guest_name}! We've noted you as "Maybe" for ${event.name} on ${when}${where}.\n\nPlease confirm${deadline} by tapping "Yes, I will attend" or "Sorry, can't make it" on the invitation.`,
      });
      return { replied: "maybe" };
    }

    if (!(await alreadySent("reply"))) await sendSessionToGuest({
      ...recipient,
      purpose: "reply",
      text: `Thank you for confirming, ${ctx.guest_name}! 🎉\n\nWe look forward to welcoming you at ${event.name} on ${when}${where}.`,
    });

    const pass = await ensureCurrentPass(data.organizationId, event, invitation);
    if (!pass) return { replied: "attending", pass: "not_active" };
    if (await alreadySent("pass")) return { replied: "attending", pass: pass.passCode };
    const allowed = 1 + invitation.allowedCompanions;
    const caption =
      `Your entry pass for ${event.name}\n\n` +
      `Pass code: ${pass.passCode}\n` +
      `Valid for ${allowed} ${allowed === 1 ? "person" : "people"}\n\n` +
      "Please show this QR code at the entrance.";
    // WhatsApp downloads the image from our public URL, so it needs PUBLIC_BASE_URL (except in dry-run).
    const canSendImage = Boolean(env.PUBLIC_BASE_URL) || isWhatsAppDryRun();
    await sendSessionToGuest({
      ...recipient,
      purpose: "pass",
      passId: pass._id,
      imageUrl: canSendImage ? publicQrUrl(passToken(pass)) : undefined,
      text: canSendImage ? caption : `${caption.replace("this QR code", "this pass code")}`,
    });
    await Pass.updateOne({ _id: pass._id, organizationId: data.organizationId }, { $set: { deliveryStatus: "sent", lastSentAt: new Date() } });
    return { replied: "attending", pass: pass.passCode };
  } catch (err) {
    // Outside the 24-hour window or an invalid number: retrying cannot help.
    if (err instanceof WhatsAppSendError && err.permanent) return { failed: err.message };
    throw err;
  }
}
