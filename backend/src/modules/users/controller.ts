import type { Request, Response } from "express";
import { actorFromRequest } from "../../common/utils/context";
import { sendSuccess } from "../../common/utils/response";
import { parseId } from "../../common/validators/common";
import { inviteUserSchema, updateMemberSchema } from "./schema";
import * as userService from "./service";

export async function list(req: Request, res: Response) {
  sendSuccess(req, res, await userService.listTeam(req.tenant!.organizationId));
}

export async function invite(req: Request, res: Response) {
  const body = inviteUserSchema.parse(req.body);
  const result = await userService.inviteUser(actorFromRequest(req), body);
  sendSuccess(req, res, result, { status: 201, message: "Invitation created" });
}

export async function remove(req: Request, res: Response) {
  const userId = parseId(req.params.id, "Team member");
  await userService.removeMember(actorFromRequest(req), userId);
  sendSuccess(req, res, { message: "Team member removed" });
}

export async function update(req: Request, res: Response) {
  const userId = parseId(req.params.id, "Team member");
  const body = updateMemberSchema.parse(req.body);
  sendSuccess(req, res, await userService.updateMember(actorFromRequest(req), userId, body));
}
