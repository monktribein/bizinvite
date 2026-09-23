import type { Request, Response } from "express";
import { actorFromRequest } from "../../common/utils/context";
import { sendSuccess } from "../../common/utils/response";
import { parseId } from "../../common/validators/common";
import { createRuleSchema, listRulesQuerySchema, updateRuleSchema } from "./schema";
import * as reminderService from "./service";

export async function list(req: Request, res: Response) {
  const { eventId } = listRulesQuerySchema.parse(req.query);
  sendSuccess(req, res, await reminderService.listRules(req.tenant!.organizationId, eventId));
}

export async function create(req: Request, res: Response) {
  const body = createRuleSchema.parse(req.body);
  sendSuccess(req, res, await reminderService.createRule(actorFromRequest(req), body), { status: 201 });
}

export async function update(req: Request, res: Response) {
  const id = parseId(req.params.id, "Reminder rule");
  sendSuccess(req, res, await reminderService.updateRule(actorFromRequest(req), id, updateRuleSchema.parse(req.body)));
}

export async function activate(req: Request, res: Response) {
  const id = parseId(req.params.id, "Reminder rule");
  sendSuccess(req, res, await reminderService.setRuleStatus(actorFromRequest(req), id, "active"));
}

export async function pause(req: Request, res: Response) {
  const id = parseId(req.params.id, "Reminder rule");
  sendSuccess(req, res, await reminderService.setRuleStatus(actorFromRequest(req), id, "paused"));
}
