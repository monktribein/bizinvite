import type { Request, Response } from "express";
import { z } from "zod";
import { actorFromRequest } from "../../common/utils/context";
import { sendPaginated, sendSuccess } from "../../common/utils/response";
import { objectIdSchema, paginationSchema, parseId } from "../../common/validators/common";
import { listRsvpsQuerySchema, updateRsvpSchema } from "./schema";
import * as rsvpService from "./service";

export async function list(req: Request, res: Response) {
  const page = paginationSchema.parse(req.query);
  const filters = listRsvpsQuerySchema.parse(req.query);
  const { items, total } = await rsvpService.listRsvps(req.tenant!.organizationId, filters, page);
  sendPaginated(req, res, items, { ...page, total });
}

export async function summary(req: Request, res: Response) {
  const { eventId } = z.object({ eventId: objectIdSchema.optional() }).parse(req.query);
  sendSuccess(req, res, await rsvpService.getRsvpSummary(req.tenant!.organizationId, eventId));
}

/** PATCH /rsvps/:guestId — staff/manual correction. :guestId is the invitation id. */
export async function update(req: Request, res: Response) {
  const guestId = parseId(req.params.guestId, "Guest");
  const body = updateRsvpSchema.parse(req.body);
  const { record, ignoredRequirements } = await rsvpService.setRsvp(actorFromRequest(req), guestId, body);
  sendSuccess(req, res, record, {
    message: ignoredRequirements.length
      ? `RSVP updated. Not collected for this event and ignored: ${ignoredRequirements.join(", ")}`
      : "RSVP updated",
  });
}
