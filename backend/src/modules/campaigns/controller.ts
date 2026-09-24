import type { Request, Response } from "express";
import { Errors } from "../../common/errors/app-error";
import { roleHasPermission } from "../../common/constants/roles";
import { actorFromRequest } from "../../common/utils/context";
import { sendPaginated, sendSuccess } from "../../common/utils/response";
import { paginationSchema, parseId } from "../../common/validators/common";
import {
  createCampaignSchema,
  draftTestSendSchema,
  listCampaignsQuerySchema,
  recipientsQuerySchema,
  testSendSchema,
  updateCampaignSchema,
} from "./schema";
import * as campaignMedia from "./media";
import * as campaignService from "./service";

export async function list(req: Request, res: Response) {
  const page = paginationSchema.parse(req.query);
  const filters = listCampaignsQuerySchema.parse(req.query);
  const { items, total } = await campaignService.listCampaigns(req.tenant!.organizationId, filters, page);
  sendPaginated(req, res, items, { ...page, total });
}

export async function get(req: Request, res: Response) {
  const id = parseId(req.params.id, "Campaign");
  sendSuccess(req, res, await campaignService.getCampaign(req.tenant!.organizationId, id));
}

export async function create(req: Request, res: Response) {
  const body = createCampaignSchema.parse(req.body);
  // Creating without draft=true launches or schedules the campaign, which is a send.
  if (!body.draft && !roleHasPermission(req.auth!.role, "campaigns:send")) throw Errors.forbidden();
  sendSuccess(req, res, await campaignService.createCampaign(actorFromRequest(req), body), { status: 201 });
}

export async function update(req: Request, res: Response) {
  const id = parseId(req.params.id, "Campaign");
  sendSuccess(req, res, await campaignService.updateCampaign(actorFromRequest(req), id, updateCampaignSchema.parse(req.body)));
}

export async function send(req: Request, res: Response) {
  const id = parseId(req.params.id, "Campaign");
  sendSuccess(req, res, await campaignService.sendCampaign(actorFromRequest(req), id), { message: "Campaign started" });
}

export async function pause(req: Request, res: Response) {
  const id = parseId(req.params.id, "Campaign");
  sendSuccess(req, res, await campaignService.pauseCampaign(actorFromRequest(req), id));
}

export async function resume(req: Request, res: Response) {
  const id = parseId(req.params.id, "Campaign");
  sendSuccess(req, res, await campaignService.resumeCampaign(actorFromRequest(req), id));
}

export async function cancel(req: Request, res: Response) {
  const id = parseId(req.params.id, "Campaign");
  sendSuccess(req, res, await campaignService.cancelCampaign(actorFromRequest(req), id));
}

export async function test(req: Request, res: Response) {
  const id = parseId(req.params.id, "Campaign");
  const { mobile } = testSendSchema.parse(req.body);
  sendSuccess(req, res, await campaignService.sendTestMessage(actorFromRequest(req), id, mobile));
}

export async function testDraft(req: Request, res: Response) {
  sendSuccess(req, res, await campaignService.sendDraftTestMessage(actorFromRequest(req), draftTestSendSchema.parse(req.body)));
}

export async function recipients(req: Request, res: Response) {
  const id = parseId(req.params.id, "Campaign");
  const page = paginationSchema.parse(req.query);
  const filters = recipientsQuerySchema.parse(req.query);
  const { items, total } = await campaignService.listRecipients(req.tenant!.organizationId, id, filters, page);
  sendPaginated(req, res, items, { ...page, total });
}

export async function uploadMedia(req: Request, res: Response) {
  if (!req.file) throw Errors.validation("Attach an image or video file", { file: ["File is required"] });
  sendSuccess(req, res, await campaignMedia.saveCampaignMedia(actorFromRequest(req), req.file), { status: 201, message: "Media uploaded" });
}

export async function getMediaFile(req: Request, res: Response) {
  const id = parseId(req.params.mediaId, "Media");
  const { media, stream } = await campaignMedia.openCampaignMediaStream(req.tenant!.organizationId, id);
  res.setHeader("Content-Type", media.mimeType);
  res.setHeader("Content-Length", String(media.size));
  res.setHeader("Cache-Control", "private, max-age=3600");
  stream.on("error", () => res.destroy());
  stream.pipe(res);
}
