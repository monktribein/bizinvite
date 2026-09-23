import type { Request, Response } from "express";
import { z } from "zod";
import { Errors } from "../../common/errors/app-error";
import { PASS_STATUSES } from "../../common/constants/enums";
import { actorFromRequest } from "../../common/utils/context";
import { sendPaginated, sendSuccess } from "../../common/utils/response";
import { objectIdSchema, paginationSchema, parseId } from "../../common/validators/common";
import * as passService from "./service";

const listQuerySchema = z.object({
  eventId: objectIdSchema.optional(),
  status: z.enum(PASS_STATUSES).optional(),
  search: z.string().max(100).optional(),
});
const generateSchema = z.object({
  eventId: objectIdSchema,
  guestIds: z.array(objectIdSchema).max(5000).optional(),
  onlyAttending: z.boolean().default(true),
});
const revokeSchema = z.object({ reason: z.string().max(500).optional() });
const validateSchema = z.object({ qrData: z.string().trim().min(1).max(1024), eventId: objectIdSchema.optional() });

export async function list(req: Request, res: Response) {
  const page = paginationSchema.parse(req.query);
  const filters = listQuerySchema.parse(req.query);
  const { items, total } = await passService.listPasses(req.tenant!.organizationId, filters, page);
  sendPaginated(req, res, items, { ...page, total });
}

export async function get(req: Request, res: Response) {
  sendSuccess(req, res, await passService.getPass(req.tenant!.organizationId, parseId(req.params.id, "Pass")));
}

export async function generate(req: Request, res: Response) {
  const body = generateSchema.parse(req.body);
  sendSuccess(req, res, await passService.generatePasses(actorFromRequest(req), body), { status: 201 });
}

export async function resend(req: Request, res: Response) {
  sendSuccess(req, res, await passService.queuePassDelivery(actorFromRequest(req), parseId(req.params.id, "Pass")));
}

export async function revoke(req: Request, res: Response) {
  const { reason } = revokeSchema.parse(req.body ?? {});
  sendSuccess(req, res, await passService.revokePass(actorFromRequest(req), parseId(req.params.id, "Pass"), reason));
}

export async function reissue(req: Request, res: Response) {
  sendSuccess(req, res, await passService.reissuePass(actorFromRequest(req), parseId(req.params.id, "Pass")), { status: 201 });
}

/** Checks a QR/pass code without admitting anyone. */
export async function validate(req: Request, res: Response) {
  const { qrData, eventId } = validateSchema.parse(req.body);
  const result = await passService.validatePass(req.tenant!.organizationId, qrData, new Date(), eventId);
  sendSuccess(req, res, result.valid
    ? { valid: true, pass: await passService.getPass(req.tenant!.organizationId, result.pass.id as string) }
    : { valid: false, reason: result.reason, message: result.message });
}

export async function qr(req: Request, res: Response) {
  const png = await passService.passQrPng(req.tenant!.organizationId, parseId(req.params.id, "Pass"));
  res.status(200).type("image/png").setHeader("Cache-Control", "private, no-store").send(png);
}

/** Public image endpoint used in WhatsApp messages. */
export async function publicQr(req: Request, res: Response) {
  const file = String(req.params.file ?? "");
  if (!file.endsWith(".png")) throw Errors.notFound("Pass");
  const png = await passService.publicPassQrPng(file.slice(0, -4));
  res.status(200).type("image/png").setHeader("Cache-Control", "private, max-age=300").send(png);
}
