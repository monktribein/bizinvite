import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { dispatchCampaign } from "../src/modules/campaigns/service";
import { CampaignRecipient } from "../src/modules/campaigns/model";
import * as whatsappClient from "../src/modules/conversations/whatsapp.client";
import { Message } from "../src/modules/conversations/model";
import { Pass } from "../src/modules/passes/model";
import { app, createApprovedTemplate, createEvent, createGuest, jobsOfType, setupTenant, Tenant, useTestDatabase } from "./helpers";

useTestDatabase();

async function launch(t: Tenant, body: Record<string, unknown>) {
  const res = await t.api.post("/api/v1/campaigns", body);
  expect(res.status).toBe(201);
  const job = (await jobsOfType("campaign.dispatch")).find((j) => String(j.payload.campaignId) === res.body.data.id)!;
  await dispatchCampaign({ organizationId: t.org.id, campaignId: res.body.data.id, generation: job.payload.generation });
  return res.body.data as { id: string; includePass: boolean };
}

describe("QR pass invitations", () => {
  it("issues each guest's pass and sends the QR as the IMAGE header", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    await createGuest(t, event.id);
    await createGuest(t, event.id);
    const tpl = await createApprovedTemplate(t.org.id, { source: "meta", headerType: "IMAGE" });

    const sendSpy = vi.spyOn(whatsappClient, "sendTemplateMessage");
    try {
      const campaign = await launch(t, { eventId: event.id, name: "QR invites", templateId: tpl.id, includePass: true });
      expect(campaign.includePass).toBe(true);
      expect(sendSpy).toHaveBeenCalledTimes(2);
      const passes = await Pass.find({ organizationId: t.org.id, eventId: event.id });
      expect(passes).toHaveLength(2);
      for (const [call] of sendSpy.mock.calls) {
        const header = call.components[0] as { type: string; parameters: Array<{ type: string; image: { link: string } }> };
        expect(header.type).toBe("header");
        expect(header.parameters[0].type).toBe("image");
        expect(header.parameters[0].image.link).toMatch(/\/api\/v1\/passes\/qr\/v1\.[^/]+\.png$/);
      }
    } finally {
      sendSpy.mockRestore();
    }

    const passes = await Pass.find({ organizationId: t.org.id, eventId: event.id });
    expect(passes.every((p) => p.deliveryStatus === "sent" && p.lastSentAt)).toBe(true);
    // Messages are linked to the pass, so delivery webhooks update the pass too.
    expect(await Message.countDocuments({ organizationId: t.org.id, purpose: "campaign", passId: { $exists: true } })).toBe(2);

    // The QR image linked in the message renders for the guest.
    const msg = await Message.findOne({ organizationId: t.org.id, purpose: "campaign" });
    const pass = passes.find((p) => String(p._id) === String(msg!.passId))!;
    const list = await t.api.get(`/api/v1/passes?eventId=${event.id}`);
    const dto = list.body.data.find((p: { id: string }) => p.id === pass.id);
    const img = await request(app).get(`/api/v1/passes/qr/${dto.signedToken}.png`);
    expect(img.status).toBe(200);
    expect(img.headers["content-type"]).toBe("image/png");
  });

  it("reuses the existing pass on a second invitation wave", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    await createGuest(t, event.id);
    const tpl = await createApprovedTemplate(t.org.id, { bodyText: "Hi {{1}}, your pass: {{2}}", variables: ["guest_name", "pass_code"] });

    const sendSpy = vi.spyOn(whatsappClient, "sendTemplateMessage");
    try {
      await launch(t, { eventId: event.id, name: "Wave 1", templateId: tpl.id, includePass: true });
      await launch(t, { eventId: event.id, name: "Wave 2", templateId: tpl.id, includePass: true });
      const [pass] = await Pass.find({ organizationId: t.org.id, eventId: event.id });
      expect(await Pass.countDocuments({ organizationId: t.org.id, eventId: event.id })).toBe(1);
      for (const [call] of sendSpy.mock.calls) {
        const body = call.components.find((c: { type: string }) => c.type === "body") as { parameters: Array<{ text: string }> };
        expect(body.parameters[1].text).toBe(pass.passCode);
      }
    } finally {
      sendSpy.mockRestore();
    }
  });

  it("does not replace a revoked pass: the guest is suppressed", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const guest = await createGuest(t, event.id);
    await t.api.post("/api/v1/passes/generate", { eventId: event.id, onlyAttending: false });
    const [pass] = (await t.api.get(`/api/v1/passes?eventId=${event.id}`)).body.data;
    await t.api.post(`/api/v1/passes/${pass.id}/revoke`, {});

    const tpl = await createApprovedTemplate(t.org.id, { source: "meta", headerType: "IMAGE" });
    await launch(t, { eventId: event.id, name: "QR", templateId: tpl.id, includePass: true });
    const recipient = await CampaignRecipient.findOne({ organizationId: t.org.id, eventGuestId: guest.id });
    expect(recipient).toMatchObject({ status: "suppressed", suppressionReason: "pass_not_active" });
  });

  it("refuses a Meta template that cannot carry the pass", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const textOnly = await createApprovedTemplate(t.org.id, { source: "meta", headerType: "NONE" });
    const res = await t.api.post("/api/v1/campaigns", { eventId: event.id, name: "x", templateId: textOnly.id, includePass: true, draft: true });
    expect(res.status).toBe(422);
    expect(res.body.error.fields.includePass).toBeDefined();

    // Without the option the same template is fine.
    const ok = await t.api.post("/api/v1/campaigns", { eventId: event.id, name: "x", templateId: textOnly.id, draft: true });
    expect(ok.status).toBe(201);
    expect(ok.body.data.includePass).toBe(false);
  });

  it("test sends use a sample QR image", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const tpl = await createApprovedTemplate(t.org.id, { source: "meta", headerType: "IMAGE" });
    const sendSpy = vi.spyOn(whatsappClient, "sendTemplateMessage");
    try {
      const res = await t.api.post("/api/v1/campaigns/test", { eventId: event.id, templateId: tpl.id, includePass: true, mobile: "+91 98200 12345" });
      expect(res.status).toBe(200);
      expect(sendSpy.mock.calls[0][0].components[0]).toMatchObject({ type: "header", parameters: [{ type: "image", image: { link: expect.stringMatching(/\/passes\/qr\/sample\.png$/) } }] });
    } finally {
      sendSpy.mockRestore();
    }
    const img = await request(app).get("/api/v1/passes/qr/sample.png");
    expect(img.status).toBe(200);
    expect(img.headers["content-type"]).toBe("image/png");
  });
});

describe("bulk pass delivery", () => {
  it("queues one send per active pass, only once per minute", async () => {
    const t = await setupTenant();
    const tpl = await createApprovedTemplate(t.org.id, { bodyText: "Your pass {{1}}", variables: ["pass_code"] });
    const event = await createEvent(t, { communication: { passTemplateId: tpl.id } });
    await createGuest(t, event.id);
    await createGuest(t, event.id);
    await t.api.post("/api/v1/passes/generate", { eventId: event.id, onlyAttending: false });

    const res = await t.api.post("/api/v1/passes/send", { eventId: event.id });
    expect(res.status).toBe(200);
    expect(res.body.data.queued).toBe(2);
    await t.api.post("/api/v1/passes/send", { eventId: event.id });
    expect(await jobsOfType("whatsapp.send-pass")).toHaveLength(2);
  });

  it("requires a pass template on the event", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const res = await t.api.post("/api/v1/passes/send", { eventId: event.id });
    expect(res.status).toBe(422);
  });
});
