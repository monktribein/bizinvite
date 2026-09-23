import type { Request, Response } from "express";
import { actorFromRequest } from "../../common/utils/context";
import { sendSuccess } from "../../common/utils/response";
import { parseId } from "../../common/validators/common";
import { createGroupSchema, listGroupsQuerySchema, membersSchema, updateGroupSchema } from "./schema";
import * as groupService from "./service";

export async function list(req: Request, res: Response) {
  const { eventId } = listGroupsQuerySchema.parse(req.query);
  sendSuccess(req, res, await groupService.listGroups(req.tenant!.organizationId, eventId));
}

export async function create(req: Request, res: Response) {
  const body = createGroupSchema.parse(req.body);
  sendSuccess(req, res, await groupService.createGroup(actorFromRequest(req), body), { status: 201 });
}

export async function update(req: Request, res: Response) {
  const id = parseId(req.params.id, "Guest group");
  sendSuccess(req, res, await groupService.updateGroup(actorFromRequest(req), id, updateGroupSchema.parse(req.body)));
}

export async function addMembers(req: Request, res: Response) {
  const id = parseId(req.params.id, "Guest group");
  const { guestIds } = membersSchema.parse(req.body);
  sendSuccess(req, res, await groupService.addMembers(actorFromRequest(req), id, guestIds));
}

export async function removeMembers(req: Request, res: Response) {
  const id = parseId(req.params.id, "Guest group");
  const { guestIds } = membersSchema.parse(req.body);
  sendSuccess(req, res, await groupService.removeMembers(actorFromRequest(req), id, guestIds));
}
