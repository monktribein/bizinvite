import { afterEach, describe, expect, it, vi } from "vitest";
import { whatsappEnvIssues } from "../src/config/env";
import { whatsappConfig } from "../src/config/whatsapp";
import { CampaignRecipient } from "../src/modules/campaigns/model";
import { Message } from "../src/modules/conversations/model";
import * as whatsappClient from "../src/modules/conversations/whatsapp.client";
import { WhatsAppSendError } from "../src/modules/conversations/whatsapp.client";
import { Consent, EventGuest, Guest } from "../src/modules/guests/model";
import { Organization } from "../src/modules/organizations/model";
import { ingestWebhook, processWebhookEvent } from "../src/modules/webhooks/service";
import { runDueJobs } from "../src/scheduler/job-runner";
import { app, createApprovedTemplate, createEvent, createGuest, createUser, login, setupTenant, Tenant, useTestDatabase } from "./helpers";
import request from "supertest";

useTestDatabase();

const originalConfig = { ...whatsappConfig };

/** Pretends Cloud API credentials are configured (live mode) for one test. */
function goLive() {
  whatsappConfig.accessToken = "test-access-token";
  whatsappConfig.phoneNumberId = "100000000000001";
  whatsappConfig.businessAccountId = "200000000000001";
}

afterEach(() => {
  Object.assign(whatsappConfig, originalConfig);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function launch(t: Tenant, eventId: string, templateId: string, targetSegment: Record<string, unknown>) {
  return t.api.post("/api/v1/campaigns", { eventId, name: "Selected wave", templateId, targetSegment });
}

async function recipientStatuses(t: Tenant, campaignId: string) {
  const res = await t.api.get(`/api/v1/campaigns/${campaignId}/recipients`);
  return Object.fromEntries(
    res.body.data.map((r: { guestName: string; status: string; suppressionReason?: string }) => [r.guestName, r.suppressionReason ?? r.status])
  );
}

function webhookBody(value: Record<string, unknown>) {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "waba", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: "PNID" }, ...value } }] }],
  };
}

describe("campaigns to selected guests", () => {
  it("sends only to the selected guests, even when unselected guests come later in the event", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const tpl = await createApprovedTemplate(t.org.id);
    const picked = await createGuest(t, event.id, { name: "Picked" });
    // Created after the selection, so their ids sort after it: a paging bug would pick them up.
    await createGuest(t, event.id, { name: "Not picked 1" });
    await createGuest(t, event.id, { name: "Not picked 2" });

    const res = await launch(t, event.id, tpl.id, { eventGuestIds: [picked.id] });
    expect(res.status).toBe(201);
    expect(res.body.data.targetSegment.selectedGuestCount).toBe(1);
    await runDueJobs();

    expect(await recipientStatuses(t, res.body.data.id)).toEqual({ Picked: "sent" });
    expect(await Message.countDocuments({ organizationId: t.org.id, purpose: "campaign" })).toBe(1);
    const campaign = await t.api.get(`/api/v1/campaigns/${res.body.data.id}`);
    expect(campaign.body.data).toMatchObject({ status: "completed", targetSegment: { eventGuestIds: [picked.id], selectedGuestCount: 1 } });
    expect(campaign.body.data.metrics).toMatchObject({ totalTargeted: 1, sent: 1 });
  });

  it("keeps the segment filters and every consent rule on top of the selection", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const tpl = await createApprovedTemplate(t.org.id);
    const vip = await createGuest(t, event.id, { name: "VIP ok", category: "VIP" });
    const family = await createGuest(t, event.id, { name: "Family", category: "Family" });
    const optedOut = await createGuest(t, event.id, { name: "VIP opted out", category: "VIP" });
    const invalid = await createGuest(t, event.id, { name: "VIP invalid", category: "VIP" });
    const suppressed = await createGuest(t, event.id, { name: "VIP suppressed", category: "VIP" });
    const cancelled = await createGuest(t, event.id, { name: "VIP cancelled", category: "VIP" });
    await t.api.post(`/api/v1/guests/${optedOut.id}/opt-out`, {});
    await t.api.post(`/api/v1/guests/${suppressed.id}/suppress`, {});
    await Guest.updateOne({ _id: invalid.contactId, organizationId: t.org.id }, { $set: { mobileValid: false } });
    await t.api.delete(`/api/v1/guests/${cancelled.id}`);

    const selection = [vip.id, family.id, optedOut.id, invalid.id, suppressed.id, cancelled.id];
    const preview = await t.api.post("/api/v1/campaigns/audience-preview", { eventId: event.id, targetSegment: { category: "VIP", eventGuestIds: selection } });
    expect(preview.status).toBe(200);
    expect(preview.body.data).toEqual({
      matched: 4,
      eligible: 1,
      suppressed: { opted_out: 1, invalid_mobile: 1, suppressed: 1 },
      // Family (category filter) and the cancelled invitation.
      selectedNotMatched: 2,
    });

    const res = await launch(t, event.id, tpl.id, { category: "VIP", eventGuestIds: selection });
    await runDueJobs();
    expect(await recipientStatuses(t, res.body.data.id)).toEqual({
      "VIP ok": "sent",
      "VIP opted out": "opted_out",
      "VIP invalid": "invalid_mobile",
      "VIP suppressed": "suppressed",
    });
    expect(await Message.countDocuments({ organizationId: t.org.id, purpose: "campaign" })).toBe(1);
  });

  it("rejects selections outside the campaign's event or organization", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const otherEvent = await createEvent(t, { name: "Other event" });
    const tpl = await createApprovedTemplate(t.org.id);
    const own = await createGuest(t, event.id);
    const elsewhere = await createGuest(t, otherEvent.id);
    const other = await setupTenant();
    const otherTenantGuest = await createGuest(other, (await createEvent(other)).id);

    const wrongEvent = await launch(t, event.id, tpl.id, { eventGuestIds: [own.id, elsewhere.id] });
    expect(wrongEvent.status).toBe(422);
    expect(wrongEvent.body.error.fields["targetSegment.eventGuestIds"]).toBeDefined();
    expect((await launch(t, event.id, tpl.id, { eventGuestIds: [otherTenantGuest.id] })).status).toBe(422);
    expect((await launch(t, event.id, tpl.id, { eventGuestIds: [] })).status).toBe(422);
    expect((await launch(t, event.id, tpl.id, { eventGuestIds: ["not-an-id"] })).status).toBe(422);
    expect(await CampaignRecipient.countDocuments({ organizationId: t.org.id })).toBe(0);
  });

  it("drafts keep the selection and send to it when started", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const tpl = await createApprovedTemplate(t.org.id);
    const a = await createGuest(t, event.id, { name: "A" });
    await createGuest(t, event.id, { name: "B" });

    const draft = await t.api.post("/api/v1/campaigns", { eventId: event.id, name: "Draft", templateId: tpl.id, draft: true, targetSegment: { eventGuestIds: [a.id] } });
    expect(draft.body.data.status).toBe("draft");
    expect(await runDueJobs()).toBe(0);

    const sent = await t.api.post(`/api/v1/campaigns/${draft.body.data.id}/send`);
    expect(sent.body.data.status).toBe("running");
    await runDueJobs();
    expect(await recipientStatuses(t, draft.body.data.id)).toEqual({ A: "sent" });
  });
});

describe("Meta errors 131049 and 131050", () => {
  it("classifies both as permanent Cloud API errors", async () => {
    goLive();
    for (const code of [131049, 131050]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify({ error: { code, message: `error ${code}` } }), { status: 400 }))
      );
      const err = await whatsappClient
        .sendTemplateMessage({ to: "919820012345", templateName: "t", languageCode: "en", components: [] })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(WhatsAppSendError);
      expect(err).toMatchObject({ code, permanent: true });
    }
  });

  it("131050 on send fails the recipient and opts the guest out; 131049 fails it without touching consent", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const tpl = await createApprovedTemplate(t.org.id);
    const stopped = await createGuest(t, event.id, { name: "Stopped marketing" });
    const limited = await createGuest(t, event.id, { name: "Rate limited" });
    await createGuest(t, event.id, { name: "Delivered" });

    const codes = new Map([
      [stopped.mobile.slice(1), 131050],
      [limited.mobile.slice(1), 131049],
    ]);
    const send = vi.spyOn(whatsappClient, "sendTemplateMessage").mockImplementation(async (input) => {
      const code = codes.get(input.to);
      if (code) throw new WhatsAppSendError(`Meta error ${code}`, code, true);
      return { waMessageId: `wamid.${input.to}`, dryRun: false };
    });

    const res = await launch(t, event.id, tpl.id, {});
    await runDueJobs();

    // Permanent: one attempt each, never retried.
    expect(send.mock.calls.filter(([i]) => codes.has(i.to))).toHaveLength(2);
    const recipients = await CampaignRecipient.find({ organizationId: t.org.id, campaignId: res.body.data.id });
    const byGuest = Object.fromEntries(recipients.map((r) => [r.guestName, r]));
    expect(byGuest["Stopped marketing"]).toMatchObject({ status: "failed", errorCode: 131050 });
    expect(byGuest["Rate limited"]).toMatchObject({ status: "failed", errorCode: 131049, sendAttempts: 0 });
    expect(byGuest["Delivered"].status).toBe("sent");

    const stoppedContact = await Guest.findOne({ _id: stopped.contactId, organizationId: t.org.id });
    expect(stoppedContact!.optedOut).toBe(true);
    expect(await Consent.countDocuments({ organizationId: t.org.id, guestId: stopped.contactId, status: "opted_out", source: "whatsapp" })).toBe(1);
    expect((await EventGuest.findOne({ _id: stopped.id, organizationId: t.org.id }))!.reminderStatus).toBe("opted_out");

    const limitedContact = await Guest.findOne({ _id: limited.contactId, organizationId: t.org.id });
    expect(limitedContact).toMatchObject({ optedOut: false, mobileValid: true });
  });

  it("a failed-status webhook with 131050 opts the guest out", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const tpl = await createApprovedTemplate(t.org.id);
    const guest = await createGuest(t, event.id);
    const res = await launch(t, event.id, tpl.id, {});
    await runDueJobs();
    const message = await Message.findOne({ organizationId: t.org.id, purpose: "campaign" });

    const ids = await ingestWebhook(webhookBody({ statuses: [{ id: message!.waMessageId, status: "failed", errors: [{ code: 131050, title: "User stopped marketing messages" }] }] }));
    for (const id of ids) await processWebhookEvent(id);

    expect((await Guest.findOne({ _id: guest.contactId, organizationId: t.org.id }))!.optedOut).toBe(true);
    const recipient = await CampaignRecipient.findOne({ organizationId: t.org.id, campaignId: res.body.data.id });
    expect(recipient).toMatchObject({ status: "failed", errorCode: 131050 });
  });
});

describe("organization WhatsApp sender settings", () => {
  async function platformAdmin(orgId: string) {
    const admin = await createUser(orgId, "PLATFORM_SUPER_ADMIN");
    const token = (await login(admin.email)).tokens.accessToken;
    return (body: object) => request(app).patch(`/api/v1/organizations/${orgId}`).set("Authorization", `Bearer ${token}`).send(body);
  }

  it("organization owners cannot change the WABA or display fields, or pick a number without their own WABA", async () => {
    const t = await setupTenant();
    const url = `/api/v1/organizations/${t.org.id}`;
    expect((await t.api.patch(url, { whatsApp: { wabaId: "300000000000001" } })).status).toBe(403);
    expect((await t.api.patch(url, { whatsApp: { businessDisplayName: "Fake Bank" } })).status).toBe(403);
    // The org has no WABA of its own: the platform WABA holds other tenants' numbers.
    expect((await t.api.patch(url, { whatsApp: { phoneNumberId: "100000000000009" } })).status).toBe(403);
    // Unrelated settings still work.
    expect((await t.api.patch(url, { name: "Renamed" })).status).toBe(200);
    const org = await Organization.findById(t.org.id);
    expect(org!.whatsApp?.phoneNumberId).toBeUndefined();
  });

  it("owners may pick a number only when Meta lists it under their organization's WABA", async () => {
    const t = await setupTenant();
    const asAdmin = await platformAdmin(t.org.id);
    expect((await asAdmin({ whatsApp: { wabaId: "300000000000001" } })).status).toBe(200);

    goLive();
    const lookup = vi.spyOn(whatsappClient, "fetchPhoneNumbers").mockResolvedValue([
      { id: "400000000000001", display_phone_number: "+91 98200 55555", verified_name: "Real Events", quality_rating: "GREEN" },
    ]);
    const url = `/api/v1/organizations/${t.org.id}`;
    const foreign = await t.api.patch(url, { whatsApp: { phoneNumberId: "400000000000099" } });
    expect(foreign.status).toBe(422);
    expect(lookup).toHaveBeenCalledWith("300000000000001");

    const ok = await t.api.patch(url, { whatsApp: { phoneNumberId: "400000000000001" } });
    expect(ok.status).toBe(200);
    expect(ok.body.data.whatsAppStatus).toMatchObject({ connected: true, phoneNumber: "+91 98200 55555", businessDisplayName: "Real Events", qualityRating: "GREEN" });

    // Back to the platform default sender.
    const cleared = await t.api.patch(url, { whatsApp: { phoneNumberId: null } });
    expect(cleared.body.data.whatsAppStatus.connected).toBe(false);
  });

  it("a phone number id can belong to one organization only", async () => {
    const a = await setupTenant();
    const b = await setupTenant();
    expect((await (await platformAdmin(a.org.id))({ whatsApp: { phoneNumberId: "500000000000001" } })).status).toBe(200);
    const taken = await (await platformAdmin(b.org.id))({ whatsApp: { phoneNumberId: "500000000000001" } });
    expect(taken.status).toBe(409);
  });

  it("reports the real connection state, including dry-run", async () => {
    const t = await setupTenant();
    const status = await t.api.get(`/api/v1/organizations/${t.org.id}/whatsapp-status`);
    expect(status.status).toBe(200);
    expect(status.body.data).toMatchObject({
      mode: "dry_run",
      dryRun: true,
      ready: false,
      sender: { source: "none", dedicatedNumber: false },
      webhook: { verifyTokenConfigured: true, signatureVerification: true },
      templates: { approved: 0, total: 0 },
    });
    expect(status.body.data.warnings.join(" ")).toMatch(/dry-run/);

    goLive();
    vi.spyOn(whatsappClient, "fetchPhoneNumber").mockResolvedValue({ id: "100000000000001", display_phone_number: "+91 98200 00000", platform_type: "CLOUD_API" });
    vi.spyOn(whatsappClient, "fetchSubscribedApps").mockResolvedValue([{ id: "app", name: "BizInvite" }]);
    await createApprovedTemplate(t.org.id, { source: "meta" });
    const live = await t.api.get(`/api/v1/organizations/${t.org.id}/whatsapp-status`);
    expect(live.body.data).toMatchObject({ mode: "live", ready: true, sender: { source: "platform" }, templates: { approved: 1, sendable: 1 } });

    const gate = await setupTenant("CHECK_IN_EXECUTIVE");
    expect((await gate.api.get(`/api/v1/organizations/${gate.org.id}/whatsapp-status`)).status).toBe(403);
    const viewer = await setupTenant("READ_ONLY_VIEWER");
    expect((await viewer.api.get(`/api/v1/organizations/${viewer.org.id}/whatsapp-status`)).status).toBe(200);
  });
});

describe("production WhatsApp configuration", () => {
  const full = {
    WHATSAPP_ACCESS_TOKEN: "token",
    WHATSAPP_PHONE_NUMBER_ID: "1",
    WHATSAPP_BUSINESS_ACCOUNT_ID: "2",
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: "verify",
    WHATSAPP_APP_SECRET: "secret",
  };

  it("allows dry-run production and complete live production", () => {
    expect(whatsappEnvIssues({ NODE_ENV: "production" } as never)).toEqual([]);
    expect(whatsappEnvIssues({ NODE_ENV: "production", ...full })).toEqual([]);
  });

  it("refuses live production without the webhook secrets that deliver statuses and RSVP replies", () => {
    const issues = whatsappEnvIssues({ NODE_ENV: "production", ...full, WHATSAPP_APP_SECRET: undefined, WHATSAPP_WEBHOOK_VERIFY_TOKEN: undefined });
    expect(issues.map((i) => i.key)).toEqual(["WHATSAPP_WEBHOOK_VERIFY_TOKEN", "WHATSAPP_APP_SECRET"]);
  });

  it("REQUIRE_WHATSAPP=true forbids dry-run production; development is never blocked", () => {
    expect(whatsappEnvIssues({ NODE_ENV: "production" } as never, true)).toHaveLength(5);
    expect(whatsappEnvIssues({ NODE_ENV: "development", WHATSAPP_ACCESS_TOKEN: "token" } as never, true)).toEqual([]);
  });
});
