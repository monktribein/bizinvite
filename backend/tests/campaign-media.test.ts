import { describe, expect, it, vi } from "vitest";
import { dispatchCampaign } from "../src/modules/campaigns/service";
import { Campaign } from "../src/modules/campaigns/model";
import { Message } from "../src/modules/conversations/model";
import * as whatsappClient from "../src/modules/conversations/whatsapp.client";
import { createApprovedTemplate, createEvent, createGuest, jobsOfType, setupTenant, Tenant, useTestDatabase } from "./helpers";

useTestDatabase();

const MB = 1024 * 1024;

async function uploadFile(t: Tenant, bytes: number, contentType: string, filename: string) {
  return t.api.upload("/api/v1/campaigns/media").attach("file", Buffer.alloc(bytes, 1), { filename, contentType });
}

describe("campaign media", () => {
  it("accepts images up to 2 MB and videos up to 10 MB", async () => {
    const t = await setupTenant();

    const image = await uploadFile(t, 2 * MB, "image/jpeg", "card.jpg");
    expect(image.status).toBe(201);
    expect(image.body.data).toMatchObject({ type: "image", mimeType: "image/jpeg", size: 2 * MB, filename: "card.jpg" });

    const video = await uploadFile(t, 10 * MB, "video/mp4", "teaser.mp4");
    expect(video.status).toBe(201);
    expect(video.body.data).toMatchObject({ type: "video", size: 10 * MB });

    const preview = await t.api.get(`/api/v1/campaigns/media/${image.body.data.id}`);
    expect(preview.status).toBe(200);
    expect(preview.headers["content-type"]).toBe("image/jpeg");
    expect(Number(preview.headers["content-length"])).toBe(2 * MB);
  });

  it("rejects oversized files and unsupported types", async () => {
    const t = await setupTenant();

    const bigImage = await uploadFile(t, 2 * MB + 1, "image/png", "big.png");
    expect(bigImage.status).toBe(422);
    expect(bigImage.body.error.message).toBe("Image must be 2 MB or smaller");

    const bigVideo = await uploadFile(t, 10 * MB + 1, "video/mp4", "big.mp4");
    expect(bigVideo.status).toBe(413);

    const pdf = await uploadFile(t, 1000, "application/pdf", "card.pdf");
    expect(pdf.status).toBe(422);
  });

  it("keeps media private to its organization", async () => {
    const a = await setupTenant();
    const b = await setupTenant();
    const image = await uploadFile(a, 1000, "image/png", "card.png");
    expect((await b.api.get(`/api/v1/campaigns/media/${image.body.data.id}`)).status).toBe(404);

    const event = await createEvent(b);
    const tpl = await createApprovedTemplate(b.org.id);
    const res = await b.api.post("/api/v1/campaigns", { eventId: event.id, name: "x", templateId: tpl.id, mediaId: image.body.data.id });
    expect(res.status).toBe(404);
  });

  it("requires a Meta template with a matching media header", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const image = await uploadFile(t, 1000, "image/jpeg", "card.jpg");
    const textOnly = await createApprovedTemplate(t.org.id, { source: "meta", headerType: "NONE" });
    const videoHeader = await createApprovedTemplate(t.org.id, { source: "meta", headerType: "VIDEO" });
    const imageHeader = await createApprovedTemplate(t.org.id, { source: "meta", headerType: "IMAGE" });

    for (const tpl of [textOnly, videoHeader]) {
      const res = await t.api.post("/api/v1/campaigns", { eventId: event.id, name: "x", templateId: tpl.id, mediaId: image.body.data.id, draft: true });
      expect(res.status).toBe(422);
      expect(res.body.error.fields.mediaId).toBeDefined();
    }
    const ok = await t.api.post("/api/v1/campaigns", { eventId: event.id, name: "x", templateId: imageHeader.id, mediaId: image.body.data.id, draft: true });
    expect(ok.status).toBe(201);
    expect(ok.body.data.media).toMatchObject({ type: "image", filename: "card.jpg" });
  });

  it("sends a test from the campaign form before the campaign exists", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const tpl = await createApprovedTemplate(t.org.id, { source: "meta", headerType: "IMAGE" });
    const image = await uploadFile(t, 1000, "image/png", "card.png");

    const sendSpy = vi.spyOn(whatsappClient, "sendTemplateMessage");
    try {
      const res = await t.api.post("/api/v1/campaigns/test", { eventId: event.id, templateId: tpl.id, mediaId: image.body.data.id, mobile: "+91 98200 12345" });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ success: true, message: "Test WhatsApp message sent to +919820012345" });
      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy.mock.calls[0][0]).toMatchObject({ to: "919820012345", templateName: tpl.name });
      expect(sendSpy.mock.calls[0][0].components[0]).toMatchObject({ type: "header", parameters: [{ type: "image" }] });
    } finally {
      sendSpy.mockRestore();
    }
    // Test sends never create campaigns or count as campaign messages.
    expect(await Campaign.countDocuments({ organizationId: t.org.id })).toBe(0);
    expect(await Message.countDocuments({ organizationId: t.org.id, purpose: "test" })).toBe(1);

    // Meta rejects an IMAGE-header template sent without an image, so it is refused before sending.
    const noMedia = await t.api.post("/api/v1/campaigns/test", { eventId: event.id, templateId: tpl.id, mobile: "+91 98200 12345" });
    expect(noMedia.status).toBe(422);
    expect(noMedia.body.error.fields.mediaId).toBeDefined();

    const badMobile = await t.api.post("/api/v1/campaigns/test", { eventId: event.id, templateId: tpl.id, mobile: "12345678" });
    expect(badMobile.status).toBe(422);

    const video = await uploadFile(t, 1000, "video/mp4", "teaser.mp4");
    const mismatch = await t.api.post("/api/v1/campaigns/test", { eventId: event.id, templateId: tpl.id, mediaId: video.body.data.id, mobile: "+91 98200 12345" });
    expect(mismatch.status).toBe(422);
    expect(mismatch.body.error.fields.mediaId).toBeDefined();
  });

  it("uploads to WhatsApp once and sends the media id as the template header", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    await createGuest(t, event.id);
    await createGuest(t, event.id);
    const tpl = await createApprovedTemplate(t.org.id, { headerType: "VIDEO" });
    const video = await uploadFile(t, 5 * MB, "video/mp4", "teaser.mp4");

    const uploadSpy = vi.spyOn(whatsappClient, "uploadMedia");
    const sendSpy = vi.spyOn(whatsappClient, "sendTemplateMessage");
    try {
      const res = await t.api.post("/api/v1/campaigns", { eventId: event.id, name: "Video wave", templateId: tpl.id, mediaId: video.body.data.id });
      expect(res.status).toBe(201);
      const [job] = await jobsOfType("campaign.dispatch");
      await dispatchCampaign({ organizationId: t.org.id, campaignId: res.body.data.id, generation: job.payload.generation });

      expect(uploadSpy).toHaveBeenCalledTimes(1);
      expect(uploadSpy.mock.calls[0][0]).toMatchObject({ mimeType: "video/mp4" });
      expect(uploadSpy.mock.calls[0][0].buffer.length).toBe(5 * MB);

      const campaign = await Campaign.findOne({ _id: res.body.data.id, organizationId: t.org.id });
      const waMediaId = campaign!.media!.waMediaId!;
      expect(waMediaId).toMatch(/^dryrun-media\./);

      expect(sendSpy).toHaveBeenCalledTimes(2);
      for (const [call] of sendSpy.mock.calls) {
        expect(call.components[0]).toEqual({ type: "header", parameters: [{ type: "video", video: { id: waMediaId } }] });
      }
    } finally {
      uploadSpy.mockRestore();
      sendSpy.mockRestore();
    }
  });
});
