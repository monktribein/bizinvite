import type { Request, Response } from "express";
import { actorFromRequest } from "../../common/utils/context";
import { sendPaginated, sendSuccess } from "../../common/utils/response";
import { paginationSchema, parseId } from "../../common/validators/common";
import { createEventSchema, listEventsQuerySchema, updateEventSchema } from "./schema";
import * as eventService from "./service";

export async function list(req: Request, res: Response) {
  const page = paginationSchema.parse(req.query);
  const filters = listEventsQuerySchema.parse(req.query);
  const { items, total } = await eventService.listEvents(req.tenant!.organizationId, filters, page);
  sendPaginated(req, res, items, { ...page, total });
}

export async function get(req: Request, res: Response) {
  const id = parseId(req.params.id, "Event");
  sendSuccess(req, res, await eventService.getEvent(req.tenant!.organizationId, id));
}

export async function create(req: Request, res: Response) {
  const body = createEventSchema.parse(req.body);
  sendSuccess(req, res, await eventService.createEvent(actorFromRequest(req), body), { status: 201, message: "Event created" });
}

export async function update(req: Request, res: Response) {
  const id = parseId(req.params.id, "Event");
  const body = updateEventSchema.parse(req.body);
  sendSuccess(req, res, await eventService.updateEvent(actorFromRequest(req), id, body));
}
