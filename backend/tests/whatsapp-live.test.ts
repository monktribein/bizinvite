import crypto from "crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { whatsappConfig } from "../src/config/whatsapp";
import { isRateLimitExempt } from "../src/middleware/rate-limit";
import { Campaign, CampaignRecipient } from "../src/modules/campaigns/model";
import { Message } from "../src/modules/conversations/model";
import * as whatsappClient from "../src/modules/conversations/whatsapp.client";
import { EventGuest, Guest } from "../src/modules/guests/model";
import { Template } from "../src/modules/templates/model";
import { WebhookEvent } from "../src/modules/webhooks/model";
import { processWebhookEvent } from "../src/modules/webhooks/service";
import { runDueJobs } from "../src/scheduler/job-runner";
import { app, createApprovedTemplate, createEvent, createGuest, setupTenant, Tenant, useTestDatabase } from "./helpers";

useTestDatabase();

const PHONE_NUMBER_ID = "109876543210001";
const WABA_ID = "209876543210001";
const originalConfig = { ...whatsappConfig };

/** Live Cloud API credentials (the Graph API itself is played by a stubbed fetch). */
beforeEach(() => {
  whatsappConfig.accessToken = "EAAtest-live-token";
  whatsappConfig.phoneNumberId = PHONE_NUMBER_ID;
  whatsappConfig.businessAccountId = WABA_ID;
});

afterEach(() => {
  Object.assign(whatsappConfig, originalConfig);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

interface GraphCall {
  url: string;
  method: string;
  auth: string | null;
  body: Record<string, unknown>;
}

/**
 * Plays Meta's Graph API: each POST /{phone-number-id}/messages returns a new wamid, unless
 * `reply` returns an error body for that recipient.
 */
function stubGraph(reply?: (body: Record<string, unknown>) => { status: number; error: { code: number; message: string } } | undefined) {
  const calls: GraphCall[] = [];
  let seq = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      calls.push({ url, method: init.method ?? "GET", auth: new Headers(init.headers).get("authorization"), body });
      const failure = reply?.(body);
      if (failure) return new Response(JSON.stringify({ error: failure.error }), { status: failure.status });
      return new Response(JSON.stringify({ messaging_product: "whatsapp", messages: [{ id: `wamid.LIVE${++seq}` }] }), { status: 200 });
    })
  );
  return calls;
}

/** A webhook POST exactly as Meta sends it: JSON body signed with the app secret. */
async function postWebhook(value: Record<string, unknown>) {
  const body = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ id: WABA_ID, changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: PHONE_NUMBER_ID }, ...value } }] }],
  });
  const signature = "sha256=" + crypto.createHmac("sha256", "test-app-secret").update(body).digest("hex");
  const res = await request(app).post("/api/v1/webhooks/whatsapp").set("Content-Type", "application/json").set("X-Hub-Signature-256", signature).send(body);
  expect(res.status).toBe(200);
  return res;
}

/** A synced Meta template like one approved in WhatsApp Manager: positional placeholders everywhere. */
async function syncedMetaTemplate(t: Tenant) {
  vi.spyOn(whatsappClient, "fetchMessageTemplates").mockResolvedValue([
    {
      id: "meta-tpl-1",
      name: "wedding_invitation",
      language: "en_US",
      status: "APPROVED",
      category: "UTILITY",
      components: [
        { type: "HEADER", format: "TEXT", text: "Invitation for {{1}}" },
        { type: "BODY", text: "Dear {{1}}, you are invited to {{2}} on {{3}}." },
        {
          type: "BUTTONS",
          buttons: [
            { type: "QUICK_REPLY", text: "Yes, I will attend" },
            { type: "QUICK_REPLY", text: "Sorry, can't make it" },
            { type: "URL", text: "Event details", url: "https://example.com/events/{{1}}" },
          ],
        },
      ],
    },
  ]);
  const synced = await t.api.post("/api/v1/templates/sync");
  expect(synced.status).toBe(200);
  return synced.body.data[0] as { id: string; mappingProblems: string[] };
}

describe("live WhatsApp Cloud API flow", () => {
  it("a synced Meta template must be fully mapped (body, header, dynamic URL button) before it can be sent", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    await createGuest(t, event.id);
    const tpl = await syncedMetaTemplate(t);
    expect(tpl.mappingProblems).toEqual([
      "Map body placeholders: var_1, var_2, var_3",
      "Map the header placeholder",
      'Map the link placeholder of button "Event details"',
    ]);

    const refused = await t.api.post("/api/v1/campaigns", { eventId: event.id, name: "Wave", templateId: tpl.id });
    expect(refused.status).toBe(422);

    const mapped = await t.api.patch(`/api/v1/templates/${tpl.id}`, {
      variables: ["guest_name", "event_name", "event_date"],
      headerVariable: "event_name",
      buttonUrlVariables: [null, null, "pass_code"],
    });
    expect(mapped.status).toBe(200);
    expect(mapped.body.data.mappingProblems).toEqual([]);
    // Re-syncing keeps the organizer's mapping.
    const again = await t.api.post("/api/v1/templates/sync");
    expect(again.body.data[0].mappingProblems).toEqual([]);
  });

  it("sends through Meta and follows the message to delivered, read and an RSVP quick reply", async () => {
    const t = await setupTenant();
    const event = await createEvent(t, { name: "Sharma Wedding" });
    const guest = await createGuest(t, event.id, { name: "Rhea Kapoor", mobile: "+91 98200 11111" });
    const tpl = await syncedMetaTemplate(t);
    await t.api.patch(`/api/v1/templates/${tpl.id}`, {
      variables: ["guest_name", "event_name", "event_date"],
      headerVariable: "event_name",
      buttonUrlVariables: [null, null, "organization_name"],
    });
    const graph = stubGraph();

    const created = await t.api.post("/api/v1/campaigns", { eventId: event.id, name: "Wave 1", templateId: tpl.id, targetSegment: { eventGuestIds: [guest.id] } });
    expect(created.status).toBe(201);
    await runDueJobs();

    // 1. The exact Cloud API request.
    const sends = graph.filter((c) => c.url.endsWith(`/${PHONE_NUMBER_ID}/messages`));
    expect(sends).toHaveLength(1);
    expect(sends[0]).toMatchObject({ method: "POST", auth: "Bearer EAAtest-live-token" });
    expect(sends[0].url).toBe(`https://graph.facebook.com/${whatsappConfig.apiVersion}/${PHONE_NUMBER_ID}/messages`);
    const payload = sends[0].body as { to: string; template: { name: string; language: { code: string }; components: Array<Record<string, unknown>> } };
    expect(payload).toMatchObject({ messaging_product: "whatsapp", recipient_type: "individual", to: "919820011111", type: "template" });
    expect(payload.template.name).toBe("wedding_invitation");
    expect(payload.template.language).toEqual({ code: "en_US" });
    expect(payload.template.components).toEqual([
      { type: "header", parameters: [{ type: "text", text: "Sharma Wedding" }] },
      {
        type: "body",
        parameters: [
          { type: "text", text: "Rhea Kapoor" },
          { type: "text", text: "Sharma Wedding" },
          { type: "text", text: expect.any(String) },
        ],
      },
      { type: "button", sub_type: "quick_reply", index: "0", parameters: [{ type: "payload", payload: `ACTION_RSVP_YES:${guest.id}` }] },
      { type: "button", sub_type: "quick_reply", index: "1", parameters: [{ type: "payload", payload: `ACTION_RSVP_NO:${guest.id}` }] },
      { type: "button", sub_type: "url", index: "2", parameters: [{ type: "text", text: expect.any(String) }] },
    ]);

    // 2. Meta's response is stored as the message id.
    const recipient = await CampaignRecipient.findOne({ organizationId: t.org.id, eventGuestId: guest.id });
    expect(recipient).toMatchObject({ status: "sent", waMessageId: "wamid.LIVE1" });
    const message = await Message.findOne({ organizationId: t.org.id, waMessageId: "wamid.LIVE1" });
    expect(message).toMatchObject({ status: "sent", dryRun: false, phoneNumberId: PHONE_NUMBER_ID, purpose: "campaign" });

    // 3. Signed status webhooks move it forward; a redelivery changes nothing.
    await postWebhook({ statuses: [{ id: "wamid.LIVE1", status: "delivered", timestamp: "1790000000", recipient_id: "919820011111" }] });
    await postWebhook({ statuses: [{ id: "wamid.LIVE1", status: "read", timestamp: "1790000060", recipient_id: "919820011111" }] });
    await postWebhook({ statuses: [{ id: "wamid.LIVE1", status: "delivered", timestamp: "1790000000", recipient_id: "919820011111" }] });
    await runDueJobs();
    expect(await CampaignRecipient.findOne({ _id: recipient!._id, organizationId: t.org.id })).toMatchObject({ status: "read" });
    const metrics = (await t.api.get(`/api/v1/campaigns/${created.body.data.id}`)).body.data.metrics;
    expect(metrics).toMatchObject({ totalTargeted: 1, sent: 1, delivered: 1, read: 1, failed: 0 });

    // 4. The guest taps "Yes, I will attend": the existing RSVP flow records it.
    await postWebhook({
      contacts: [{ wa_id: "919820011111", profile: { name: "Rhea" } }],
      messages: [
        {
          id: "wamid.REPLY1",
          from: "919820011111",
          timestamp: "1790000100",
          type: "button",
          context: { from: "919820000000", id: "wamid.LIVE1" },
          button: { payload: `ACTION_RSVP_YES:${guest.id}`, text: "Yes, I will attend" },
        },
      ],
    });
    await runDueJobs();
    expect((await EventGuest.findOne({ _id: guest.id, organizationId: t.org.id }))!.rsvpStatus).toBe("attending");
    const rsvps = await t.api.get(`/api/v1/rsvps?eventId=${event.id}`);
    expect(rsvps.body.data[0]).toMatchObject({ status: "attending" });
  });

  it("records Meta send errors and failed-status webhooks per recipient", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const ok = await createGuest(t, event.id, { name: "Ok", mobile: "+91 98200 22222" });
    const notOnWhatsApp = await createGuest(t, event.id, { name: "Not on WhatsApp", mobile: "+91 98200 33333" });
    const tpl = await createApprovedTemplate(t.org.id, { source: "meta" });
    stubGraph((body) => (body.to === "919820033333" ? { status: 400, error: { code: 131026, message: "Message undeliverable" } } : undefined));

    await t.api.post("/api/v1/campaigns", { eventId: event.id, name: "Wave", templateId: tpl.id });
    await runDueJobs();

    const failed = await CampaignRecipient.findOne({ organizationId: t.org.id, eventGuestId: notOnWhatsApp.id });
    expect(failed).toMatchObject({ status: "failed", errorCode: 131026, sendAttempts: 0 });
    expect((await Guest.findOne({ _id: notOnWhatsApp.contactId, organizationId: t.org.id }))!.mobileValid).toBe(false);

    // Accepted by the API, then reported failed by webhook.
    const sent = await CampaignRecipient.findOne({ organizationId: t.org.id, eventGuestId: ok.id });
    await postWebhook({ statuses: [{ id: sent!.waMessageId, status: "failed", errors: [{ code: 131049, title: "Not delivered to maintain healthy ecosystem engagement" }] }] });
    await runDueJobs();
    expect(await CampaignRecipient.findOne({ _id: sent!._id, organizationId: t.org.id })).toMatchObject({ status: "failed", errorCode: 131049 });
  });

  it("retries a status that arrives before the message id was stored", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const guest = await createGuest(t, event.id);
    const tpl = await createApprovedTemplate(t.org.id, { source: "meta" });
    stubGraph();

    // The "sent" status races ahead of the send call.
    await postWebhook({ statuses: [{ id: "wamid.LIVE1", status: "delivered", timestamp: "1790000000" }] });
    const [early] = await WebhookEvent.find({ waMessageId: "wamid.LIVE1" });
    await expect(processWebhookEvent(early.id)).rejects.toThrow(/not stored yet/);

    await t.api.post("/api/v1/campaigns", { eventId: event.id, name: "Wave", templateId: tpl.id });
    await runDueJobs();
    expect(await CampaignRecipient.findOne({ organizationId: t.org.id, eventGuestId: guest.id })).toMatchObject({ waMessageId: "wamid.LIVE1", status: "sent" });
    // The scheduler's backoff retry of the early status now finds the message.
    await runDueJobs(new Date(Date.now() + 5 * 60_000));
    expect(await CampaignRecipient.findOne({ organizationId: t.org.id, eventGuestId: guest.id })).toMatchObject({ waMessageId: "wamid.LIVE1", status: "delivered" });
    expect((await WebhookEvent.findById(early.id))!.status).toBe("processed");
  });

  it("pauses the campaign on account errors (bad token) and keeps unsent guests pending for resume", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    await createGuest(t, event.id);
    await createGuest(t, event.id);
    const tpl = await createApprovedTemplate(t.org.id, { source: "meta" });
    stubGraph(() => ({ status: 401, error: { code: 190, message: "Error validating access token: Session has expired" } }));

    const created = await t.api.post("/api/v1/campaigns", { eventId: event.id, name: "Wave", templateId: tpl.id });
    await runDueJobs();

    const campaign = (await t.api.get(`/api/v1/campaigns/${created.body.data.id}`)).body.data;
    expect(campaign.status).toBe("paused");
    expect(campaign.failureReason).toMatch(/access token.*WhatsApp error 190/);
    const recipients = await CampaignRecipient.find({ organizationId: t.org.id, campaignId: created.body.data.id });
    expect(recipients.map((r) => [r.status, r.sendAttempts, r.claimedAt])).toEqual([
      ["pending", 0, undefined],
      ["pending", 0, undefined],
    ]);

    // Token fixed: resume sends everyone and clears the reason.
    stubGraph();
    const resumed = await t.api.post(`/api/v1/campaigns/${created.body.data.id}/resume`);
    expect(resumed.body.data.failureReason).toBeUndefined();
    await runDueJobs();
    expect((await Campaign.findOne({ _id: created.body.data.id, organizationId: t.org.id }))!.status).toBe("completed");
    expect(await CampaignRecipient.countDocuments({ organizationId: t.org.id, status: "sent" })).toBe(2);
  });

  it("never sends local test templates or media-header templates without media through Meta", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    await createGuest(t, event.id);
    const graph = stubGraph();

    const local = await createApprovedTemplate(t.org.id, { source: "local" });
    const refused = await t.api.post("/api/v1/campaigns", { eventId: event.id, name: "Wave", templateId: local.id });
    expect(refused.status).toBe(422);
    expect(refused.body.error.message).toMatch(/local test template/);

    // A campaign created in dry-run with a local template fails at send time once live.
    await Template.updateOne({ _id: local._id, organizationId: t.org.id }, { $set: { source: "meta" } });
    const created = await t.api.post("/api/v1/campaigns", { eventId: event.id, name: "Wave", templateId: local.id });
    await Template.updateOne({ _id: local._id, organizationId: t.org.id }, { $set: { source: "local" } });
    await runDueJobs();
    expect((await t.api.get(`/api/v1/campaigns/${created.body.data.id}`)).body.data).toMatchObject({ status: "failed", failureReason: expect.stringMatching(/local test template/) });

    const imageHeader = await createApprovedTemplate(t.org.id, { source: "meta", headerType: "IMAGE" });
    const noImage = await t.api.post("/api/v1/campaigns", { eventId: event.id, name: "Wave", templateId: imageHeader.id });
    expect(noImage.status).toBe(422);
    expect(graph.filter((c) => c.url.endsWith("/messages"))).toHaveLength(0);
  });

  it("exempts Meta webhooks from the API rate limit", () => {
    expect(isRateLimitExempt("/webhooks/whatsapp")).toBe(true);
    expect(isRateLimitExempt("/campaigns")).toBe(false);
  });

  it("checks the sender number and webhook subscription with Meta, and can subscribe the app", async () => {
    const t = await setupTenant();
    await createApprovedTemplate(t.org.id, { source: "meta" });
    vi.spyOn(whatsappClient, "fetchPhoneNumber").mockResolvedValue({
      id: PHONE_NUMBER_ID,
      display_phone_number: "+91 98200 00000",
      verified_name: "Sharma Events",
      quality_rating: "GREEN",
      platform_type: "CLOUD_API",
    });
    const subscribed = vi.spyOn(whatsappClient, "fetchSubscribedApps").mockResolvedValue([]);
    const subscribe = vi.spyOn(whatsappClient, "subscribeAppToWaba").mockResolvedValue(true);

    const before = (await t.api.get(`/api/v1/organizations/${t.org.id}/whatsapp-status`)).body.data;
    expect(before).toMatchObject({
      mode: "live",
      ready: false,
      sender: { phoneNumber: "+91 98200 00000", businessDisplayName: "Sharma Events", qualityRating: "GREEN", verification: { ok: true } },
      webhook: { wabaSubscribed: false },
    });
    expect(before.warnings.join(" ")).toMatch(/not subscribed/);

    subscribed.mockResolvedValue([{ id: "app", name: "BizInvite" }]);
    const after = await t.api.post(`/api/v1/organizations/${t.org.id}/whatsapp/subscribe-webhooks`);
    expect(after.status).toBe(200);
    expect(subscribe).toHaveBeenCalledWith(WABA_ID);
    expect(after.body.data).toMatchObject({ ready: true, webhook: { wabaSubscribed: true } });

    // A token Meta rejects is reported, not hidden.
    vi.spyOn(whatsappClient, "fetchPhoneNumber").mockRejectedValue(new whatsappClient.WhatsAppSendError("Invalid OAuth access token (WhatsApp error 190)", 190, false, true));
    const broken = (await t.api.get(`/api/v1/organizations/${t.org.id}/whatsapp-status`)).body.data;
    expect(broken.ready).toBe(false);
    expect(broken.warnings.join(" ")).toMatch(/Invalid OAuth access token/);
  });
});
