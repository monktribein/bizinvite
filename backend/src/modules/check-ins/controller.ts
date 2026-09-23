import type { Request, Response } from "express";
import { z } from "zod";
import { actorFromRequest } from "../../common/utils/context";
import { sendSuccess } from "../../common/utils/response";
import { objectIdSchema } from "../../common/validators/common";
import * as checkInService from "./service";

const gateIdSchema = z.string().trim().min(1).max(100);

const scanSchema = z.object({
  qrData: z.string().trim().min(1).max(1024),
  gateId: gateIdSchema,
  paxCount: z.number().int().min(1).max(51).default(1),
  eventId: objectIdSchema.optional(),
});
const manualSchema = z.object({
  guestId: objectIdSchema,
  gateId: gateIdSchema,
  paxCount: z.number().int().min(1).max(51).default(1),
  notes: z.string().max(500).optional(),
});
const groupSchema = z.object({ groupId: objectIdSchema, gateId: gateIdSchema });
const lookupSchema = z.object({ eventId: objectIdSchema, q: z.string().trim().min(2).max(100) });
const summarySchema = z.object({ eventId: objectIdSchema.optional() });

/**
 * Gate outcomes (admitted, duplicate, invalid pass) are returned as HTTP 200 with
 * `data.success` / `data.isDuplicate`, so scanners always receive guest details.
 */
export async function scan(req: Request, res: Response) {
  const body = scanSchema.parse(req.body);
  sendSuccess(req, res, await checkInService.scan(actorFromRequest(req), body));
}

export async function manual(req: Request, res: Response) {
  const body = manualSchema.parse(req.body);
  sendSuccess(req, res, await checkInService.manualCheckIn(actorFromRequest(req), body));
}

export async function group(req: Request, res: Response) {
  const body = groupSchema.parse(req.body);
  sendSuccess(req, res, await checkInService.groupCheckIn(actorFromRequest(req), body));
}

export async function lookup(req: Request, res: Response) {
  const query = lookupSchema.parse(req.query);
  sendSuccess(req, res, await checkInService.lookup(req.tenant!.organizationId, query));
}

export async function summary(req: Request, res: Response) {
  const { eventId } = summarySchema.parse(req.query);
  sendSuccess(req, res, await checkInService.liveSummary(req.tenant!.organizationId, eventId));
}
