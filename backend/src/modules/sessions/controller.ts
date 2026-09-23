import type { Request, Response } from "express";
import { actorFromRequest } from "../../common/utils/context";
import { sendSuccess } from "../../common/utils/response";
import { parseId } from "../../common/validators/common";
import { createSessionSchema, listSessionsQuerySchema, updateSessionSchema } from "./schema";
import * as sessionService from "./service";

export async function list(req: Request, res: Response) {
  const { eventId } = listSessionsQuerySchema.parse(req.query);
  sendSuccess(req, res, await sessionService.listSessions(req.tenant!.organizationId, eventId));
}

export async function create(req: Request, res: Response) {
  const body = createSessionSchema.parse(req.body);
  sendSuccess(req, res, await sessionService.createSession(actorFromRequest(req), body), { status: 201 });
}

export async function update(req: Request, res: Response) {
  const id = parseId(req.params.id, "Session");
  const body = updateSessionSchema.parse(req.body);
  sendSuccess(req, res, await sessionService.updateSession(actorFromRequest(req), id, body));
}

export async function remove(req: Request, res: Response) {
  const id = parseId(req.params.id, "Session");
  await sessionService.deleteSession(actorFromRequest(req), id);
  sendSuccess(req, res, { id }, { message: "Session deleted" });
}
