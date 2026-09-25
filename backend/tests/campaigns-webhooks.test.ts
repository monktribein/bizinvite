import crypto from "crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { dispatchCampaign } from "../src/modules/campaigns/service";
import { Campaign, CampaignRecipient } from "../src/modules/campaigns/model";
import { Message } from "../src/modules/conversations/model";
import { Consent, EventGuest, Guest } from "../src/modules/guests/model";
import { Rsvp } from "../src/modules/rsvps/model";
import { WebhookEvent } from "../src/modules/webhooks/model";
import { ingestWebhook, processWebhookEvent } from "../src/modules/webhooks/service";
import { runDueJobs } from "../src/scheduler/job-runner";
import { app, createApprovedTemplate, createEvent, createGuest, jobsOfType, setupTenant, Tenant, useTestDatabase } from "./helpers";

useTestDatabase();

async function launchCampaign(t: Tenant, eventId: string, templateId: string, targetSegment: Record<string, unknown> = {}) {
  const res = await t.api.post("/api/v1/campaigns", { eventId, name: "VIP Wave 1", templateId, targetSegment });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; status: string };
}

function webhookBody(value: Record<string, unknown>) {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "waba", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: "PNID" }, ...value } }] }],
  };
}

describe("campaigns", () => {
  it("refuses templates that are not approved by Meta", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const pending = await createApprovedTemplate(t.org.id, { approvalStatus: "PENDING" });
    const res = await t.api.post("/api/v1/campaigns", { eventId: event.id, name: "x", templateId: pending.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TEMPLATE_NOT_APPROVED");
  });

  it("refuses templates with unmapped variables", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const tpl = await createApprovedTemplate(t.org.id, { variables: ["guest_name", "var_2", "event_date"] });
    const res = await t.api.post("/api/v1/campaigns", { eventId: event.id, name: "x", templateId: tpl.id });
    expect(res.status).toBe(422);
  });

  it("stores a dispatch job (never sends inside the request), suppresses opted-out guests and tracks recipients", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const tpl = await createApprovedTemplate(t.org.id);
    await createGuest(t, event.id, { name: "VIP One", category: "VIP", isVip: true });
    const optedOut = await createGuest(t, event.id, { name: "VIP Two", category: "VIP", isVip: true });
    await createGuest(t, event.id, { name: "Friend", category: "Friend" });
    await t.api.post(`/api/v1/guests/${optedOut.id}/opt-out`, {});

    const campaign = await launchCampaign(t, event.id, tpl.id, { category: "VIP" });
    expect(campaign.status).toBe("running");
    // The HTTP request only stored the dispatch job in scheduledJobs.
    expect(await Message.countDocuments({ organizationId: t.org.id })).toBe(0);
    const [job] = await jobsOfType("campaign.dispatch");
    expect(job).toMatchObject({ status: "pending", payload: { campaignId: campaign.id } });

    await runDueJobs();
    expect((await jobsOfType("campaign.dispatch"))[0].status).toBe("completed");

    const recipients = await t.api.get(`/api/v1/campaigns/${campaign.id}/recipients`);
    const byName = Object.fromEntries(recipients.body.data.map((r: { guestName: string; status: string }) => [r.guestName, r.status]));
    expect(byName).toEqual({ "VIP One": "sent", "VIP Two": "suppressed" });

    const got = await t.api.get(`/api/v1/campaigns/${campaign.id}`);
    expect(got.body.data.status).toBe("completed");
    expect(got.body.data.metrics).toMatchObject({ totalTargeted: 2, sent: 1, suppressed: 1, failed: 0 });

    // Running the jobs again, or replaying the dispatch, does not send twice.
    expect(await runDueJobs()).toBe(0);
    await dispatchCampaign({ organizationId: t.org.id, campaignId: campaign.id, generation: job.payload.generation });
    expect(await Message.countDocuments({ organizationId: t.org.id, purpose: "campaign" })).toBe(1);
  });

  it("sends in batches, one batch per job run", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const tpl = await createApprovedTemplate(t.org.id);
    for (let i = 0; i < 3; i++) await createGuest(t, event.id);
    const campaign = await launchCampaign(t, event.id, tpl.id);
    const data = { organizationId: t.org.id, campaignId: campaign.id, generation: (await jobsOfType("campaign.dispatch"))[0].payload.generation };

    expect(await dispatchCampaign(data, 2)).toEqual({ sent: 2, remaining: true, transientFailures: 0 });
    expect(await dispatchCampaign(data, 2)).toEqual({ sent: 1, remaining: false, transientFailures: 0 });
    expect(await Message.countDocuments({ organizationId: t.org.id, purpose: "campaign" })).toBe(3);
    expect((await Campaign.findOne({ _id: campaign.id, organizationId: t.org.id }))!.status).toBe("completed");
  });

  it("pausing stops pending sends; resuming sends the rest", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const tpl = await createApprovedTemplate(t.org.id);
    await createGuest(t, event.id);
    await createGuest(t, event.id);
    const campaign = await launchCampaign(t, event.id, tpl.id);

    expect((await t.api.post(`/api/v1/campaigns/${campaign.id}/pause`)).body.data.status).toBe("paused");
    await runDueJobs();
    expect(await Message.countDocuments({ organizationId: t.org.id, purpose: "campaign" })).toBe(0);
    expect((await jobsOfType("campaign.dispatch"))[0]).toMatchObject({ status: "cancelled", cancelReason: "stale_or_missing" });

    expect((await t.api.post(`/api/v1/campaigns/${campaign.id}/resume`)).body.data.status).toBe("running");
    await runDueJobs();
    expect(await Message.countDocuments({ organizationId: t.org.id, purpose: "campaign" })).toBe(2);
    expect((await Campaign.findOne({ _id: campaign.id, organizationId: t.org.id }))!.status).toBe("completed");
  });

  it("schedules future campaigns as a job due at scheduledFor", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const tpl = await createApprovedTemplate(t.org.id);
    await createGuest(t, event.id);
    const res = await t.api.post("/api/v1/campaigns", {
      eventId: event.id,
      name: "Later",
      templateId: tpl.id,
      scheduledFor: new Date(Date.now() + 3600000).toISOString(),
    });
    expect(res.body.data.status).toBe("scheduled");
    const [job] = await jobsOfType("campaign.dispatch");
    expect(job.runAt.getTime()).toBeGreaterThan(Date.now() + 3500000);
    // Not due yet: nothing runs now.
    expect(await runDueJobs()).toBe(0);
    expect(await runDueJobs(new Date(Date.now() + 3700000))).toBe(1);
    expect((await Campaign.findOne({ _id: res.body.data.id, organizationId: t.org.id }))!.status).toBe("completed");
  });
});

describe("WhatsApp webhooks", () => {
  it("answers Meta's verification handshake only with the right token", async () => {
    const ok = await request(app).get("/api/v1/webhooks/whatsapp").query({ "hub.mode": "subscribe", "hub.verify_token": "test-verify-token", "hub.challenge": "12345" });
    expect(ok.status).toBe(200);
    expect(ok.text).toBe("12345");
    const bad = await request(app).get("/api/v1/webhooks/whatsapp").query({ "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "12345" });
    expect(bad.status).toBe(403);
  });

  it("rejects payloads without a valid X-Hub-Signature-256", async () => {
    const body = JSON.stringify(webhookBody({ statuses: [] }));
    const unsigned = await request(app).post("/api/v1/webhooks/whatsapp").set("Content-Type", "application/json").send(body);
    expect(unsigned.status).toBe(401);
    const signature = "sha256=" + crypto.createHmac("sha256", "test-app-secret").update(body).digest("hex");
    const signed = await request(app).post("/api/v1/webhooks/whatsapp").set("Content-Type", "application/json").set("X-Hub-Signature-256", signature).send(body);
    expect(signed.status).toBe(200);
  });

  it("is idempotent: a redelivered quick-reply updates the RSVP once", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const tpl = await createApprovedTemplate(t.org.id);
    const guest = await createGuest(t, event.id, { name: "Rhea" });
    await launchCampaign(t, event.id, tpl.id);
    await runDueJobs();
    const outbound = await Message.findOne({ organizationId: t.org.id, purpose: "campaign" });

    const reply = webhookBody({
      contacts: [{ wa_id: guest.mobile.slice(1) }],
      messages: [
        {
          id: "wamid.REPLY1",
          from: guest.mobile.slice(1),
          timestamp: String(Math.floor(Date.now() / 1000)),
          type: "button",
          button: { payload: `ACTION_RSVP_YES:${guest.id}`, text: "Yes, attending" },
          context: { id: outbound!.waMessageId },
        },
      ],
    });

    const first = await ingestWebhook(reply);
    const second = await ingestWebhook(reply);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
    await processWebhookEvent(first[0]);
    await processWebhookEvent(first[0]);

    const invitation = await EventGuest.findOne({ _id: guest.id, organizationId: t.org.id });
    expect(invitation!.rsvpStatus).toBe("attending");
    expect(invitation!.reminderStatus).toBe("suppressed");
    const rsvp = await Rsvp.findOne({ organizationId: t.org.id, eventGuestId: guest.id });
    expect(rsvp!.history).toHaveLength(1);
    expect(rsvp!.source).toBe("whatsapp_quick_reply");
    expect(await WebhookEvent.countDocuments({ dedupeKey: "msg:wamid.REPLY1" })).toBe(1);
  });

  it("ignores a quick-reply whose payload names another guest's invitation", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const tpl = await createApprovedTemplate(t.org.id);
    const alice = await createGuest(t, event.id, { name: "Alice" });
    const bob = await createGuest(t, event.id, { name: "Bob" });
    await launchCampaign(t, event.id, tpl.id);
    await runDueJobs();

    const [id] = await ingestWebhook(
      webhookBody({ messages: [{ id: "wamid.FORGED", from: alice.mobile.slice(1), type: "button", button: { payload: `ACTION_RSVP_NO:${bob.id}` } }] })
    );
    const result = await processWebhookEvent(id);
    expect(result).toMatchObject({ outcome: "rsvp_invitation_mismatch" });
    expect((await EventGuest.findOne({ _id: bob.id, organizationId: t.org.id }))!.rsvpStatus).toBe("no_response");
  });

  it("STOP opts the guest out, records consent and cancels pending sends", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const tpl = await createApprovedTemplate(t.org.id);
    const guest = await createGuest(t, event.id);
    await launchCampaign(t, event.id, tpl.id);
    await runDueJobs();

    const [id] = await ingestWebhook(webhookBody({ messages: [{ id: "wamid.STOP1", from: guest.mobile.slice(1), type: "text", text: { body: "STOP" } }] }));
    await processWebhookEvent(id);

    const contact = await Guest.findOne({ _id: guest.contactId, organizationId: t.org.id });
    expect(contact!.optedOut).toBe(true);
    expect(await Consent.countDocuments({ organizationId: t.org.id, guestId: guest.contactId, status: "opted_out" })).toBe(1);
    expect((await EventGuest.findOne({ _id: guest.id, organizationId: t.org.id }))!.reminderStatus).toBe("opted_out");
  });

  it("applies delivery statuses forward-only and marks undeliverable numbers invalid", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const tpl = await createApprovedTemplate(t.org.id);
    const g1 = await createGuest(t, event.id);
    const g2 = await createGuest(t, event.id);
    await launchCampaign(t, event.id, tpl.id);
    await runDueJobs();
    const m1 = await Message.findOne({ organizationId: t.org.id, eventGuestId: g1.id });
    const m2 = await Message.findOne({ organizationId: t.org.id, eventGuestId: g2.id });

    const ids = await ingestWebhook(
      webhookBody({
        statuses: [
          { id: m1!.waMessageId, status: "read", timestamp: "1700000100" },
          { id: m1!.waMessageId, status: "delivered", timestamp: "1700000050" }, // late, must not regress
          { id: m2!.waMessageId, status: "failed", errors: [{ code: 131026, title: "Message undeliverable" }] },
        ],
      })
    );
    for (const id of ids) await processWebhookEvent(id);

    const r1 = await CampaignRecipient.findOne({ organizationId: t.org.id, eventGuestId: g1.id });
    const r2 = await CampaignRecipient.findOne({ organizationId: t.org.id, eventGuestId: g2.id });
    expect(r1!.status).toBe("read");
    expect(r2!.status).toBe("failed");
    const contact2 = await Guest.findOne({ _id: g2.contactId, organizationId: t.org.id });
    expect(contact2!.mobileValid).toBe(false);
  });
});

describe("RSVP", () => {
  it("staff updates enforce companion limits, keep history and only store configured requirements", async () => {
    const t = await setupTenant();
    const event = await createEvent(t, { rsvpConfig: { collectDietary: true } });
    const guest = await createGuest(t, event.id, { allowedCompanions: 2 });

    const tooMany = await t.api.patch(`/api/v1/rsvps/${guest.id}`, { status: "attending", count: 4 });
    expect(tooMany.status).toBe(422);

    const ok = await t.api.patch(`/api/v1/rsvps/${guest.id}`, {
      status: "attending",
      count: 3,
      requirements: { dietaryPreference: "jain", needsAccommodation: true, needsTransport: true },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ status: "attending", attendingCount: 3, companionsCount: 2 });
    expect(ok.body.data.requirements).toEqual({ dietaryPreference: "jain" });
    expect(ok.body.message).toMatch(/needsAccommodation, needsTransport/);

    const changed = await t.api.patch(`/api/v1/rsvps/${guest.id}`, { status: "declined", reason: "Called in" });
    expect(changed.body.data).toMatchObject({ status: "declined", attendingCount: 0, companionsCount: 0 });
    expect(changed.body.data.history.map((h: { newStatus: string }) => h.newStatus)).toEqual(["attending", "declined"]);

    const summary = await t.api.get(`/api/v1/rsvps/summary?eventId=${event.id}`);
    expect(summary.body.data).toMatchObject({ totalInvited: 1, declined: 1, attending: 0, expectedFootfall: 0 });
  });

  it("lists every invitation, including guests who have not responded", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const a = await createGuest(t, event.id);
    await createGuest(t, event.id);
    await t.api.patch(`/api/v1/rsvps/${a.id}`, { status: "attending", count: 2 });
    const list = await t.api.get(`/api/v1/rsvps?eventId=${event.id}`);
    expect(list.body.data).toHaveLength(2);
    const summary = await t.api.get(`/api/v1/rsvps/summary?eventId=${event.id}`);
    expect(summary.body.data).toMatchObject({ totalInvited: 2, attending: 1, noResponse: 1, expectedFootfall: 2, totalCompanions: 1 });
  });
});
