import { describe, expect, it, vi } from "vitest";
import * as whatsappClient from "../src/modules/conversations/whatsapp.client";
import { Message } from "../src/modules/conversations/model";
import { EventGuest, Guest } from "../src/modules/guests/model";
import { Pass } from "../src/modules/passes/model";
import { sendRsvpReply } from "../src/modules/rsvps/replies";
import { ingestWebhook, processWebhookEvent } from "../src/modules/webhooks/service";
import { runDueJobs } from "../src/scheduler/job-runner";
import { createApprovedTemplate, createEvent, createGuest, jobsOfType, setupTenant, Tenant, useTestDatabase } from "./helpers";

useTestDatabase();

let seq = 0;

/** Sends the invitation, then simulates the guest tapping a quick-reply button. */
async function inviteAndTap(t: Tenant, action: "ACTION_RSVP_YES" | "ACTION_RSVP_NO" | "ACTION_RSVP_MAYBE", guestOverrides: Record<string, unknown> = {}) {
  const event = await createEvent(t);
  const tpl = await createApprovedTemplate(t.org.id);
  const guest = await createGuest(t, event.id, { name: "Rhea", allowedCompanions: 2, ...guestOverrides });
  expect((await t.api.post("/api/v1/campaigns", { eventId: event.id, name: "Wave", templateId: tpl.id })).status).toBe(201);
  await runDueJobs();
  const outbound = await Message.findOne({ organizationId: t.org.id, purpose: "campaign" });
  const reply = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "PNID" },
              messages: [
                {
                  id: `wamid.TAP${++seq}`,
                  from: guest.mobile.slice(1),
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "button",
                  button: { payload: `${action}:${guest.id}`, text: "tap" },
                  context: { id: outbound!.waMessageId },
                },
              ],
            },
          },
        ],
      },
    ],
  };
  const ids = await ingestWebhook(reply);
  await processWebhookEvent(ids[0]);
  // Redelivery of the same webhook must not produce a second reply.
  await processWebhookEvent(ids[0]);
  await runDueJobs();
  return { event, guest };
}

type SessionInput = Parameters<typeof whatsappClient.sendSessionMessage>[0];

/** Text of each free-form message sent (the caption for images). */
const sessionTexts = (spy: { mock: { calls: Array<[SessionInput]> } }) => spy.mock.calls.map(([input]) => input.text ?? input.image?.caption ?? "");

describe("RSVP quick-reply responses", () => {
  it("thanks the guest on Yes and sends the QR pass with its code", async () => {
    const t = await setupTenant();
    const spy = vi.spyOn(whatsappClient, "sendSessionMessage");
    try {
      const { guest } = await inviteAndTap(t, "ACTION_RSVP_YES");
      expect(spy).toHaveBeenCalledTimes(2);
      const [thanks, passMsg] = spy.mock.calls.map(([input]) => input);
      expect(thanks.text).toMatch(/^Thank you for confirming, Rhea!/);
      expect(passMsg.image?.link).toMatch(/\/api\/v1\/passes\/qr\/v1\.[^/]+\.png$/);

      const pass = await Pass.findOne({ organizationId: t.org.id, eventGuestId: guest.id });
      expect(pass).not.toBeNull();
      expect(passMsg.image?.caption).toContain(`Pass code: ${pass!.passCode}`);
      expect(passMsg.image?.caption).toContain("Valid for 3 people");
      expect(pass!.deliveryStatus).toBe("sent");
      expect(await Message.countDocuments({ organizationId: t.org.id, purpose: "pass", passId: pass!._id })).toBe(1);
    } finally {
      spy.mockRestore();
    }
    expect(await jobsOfType("whatsapp.rsvp-reply")).toHaveLength(1);
  });

  it("answers No and Maybe without a pass", async () => {
    const t = await setupTenant();
    const spy = vi.spyOn(whatsappClient, "sendSessionMessage");
    try {
      await inviteAndTap(t, "ACTION_RSVP_NO");
      await inviteAndTap(t, "ACTION_RSVP_MAYBE");
      const texts = sessionTexts(spy);
      expect(texts).toHaveLength(2);
      expect(texts[0]).toMatch(/We're sorry you can't make it/);
      expect(texts[1]).toMatch(/noted you as "Maybe"/);
    } finally {
      spy.mockRestore();
    }
    expect(await Pass.countDocuments({ organizationId: t.org.id })).toBe(0);
  });

  it("does not re-send the thank-you when only the pass message failed", async () => {
    const t = await setupTenant();
    const real = whatsappClient.sendSessionMessage;
    let failPass = true;
    const spy = vi.spyOn(whatsappClient, "sendSessionMessage").mockImplementation(async (input) => {
      if (input.image && failPass) {
        failPass = false;
        throw new whatsappClient.WhatsAppSendError("temporary outage", undefined, false);
      }
      return real(input);
    });
    try {
      await inviteAndTap(t, "ACTION_RSVP_YES");
      // First run: thank-you sent, pass failed transiently. The retry sends only the pass.
      await runDueJobs(new Date(Date.now() + 10 * 60 * 1000));
      const texts = sessionTexts(spy);
      expect(texts.filter((x) => x.startsWith("Thank you for confirming"))).toHaveLength(1);
      expect(await Message.countDocuments({ organizationId: t.org.id, purpose: "pass", status: "sent" })).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("does not reply to guests who opted out", async () => {
    const t = await setupTenant();
    const spy = vi.spyOn(whatsappClient, "sendSessionMessage");
    try {
      const { guest } = await inviteAndTap(t, "ACTION_RSVP_MAYBE");
      spy.mockClear();
      const invitation = await EventGuest.findOne({ _id: guest.id, organizationId: t.org.id });
      await Guest.updateOne({ _id: invitation!.guestId, organizationId: t.org.id }, { $set: { optedOut: true } });
      expect(await sendRsvpReply({ organizationId: t.org.id, eventGuestId: guest.id, status: "maybe" })).toEqual({ skipped: "opted_out" });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
