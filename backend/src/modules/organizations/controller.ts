import type { Request, Response } from "express";
import { z } from "zod";
import { actorFromRequest } from "../../common/utils/context";
import { sendPaginated, sendSuccess } from "../../common/utils/response";
import { paginationSchema } from "../../common/validators/common";
import { listAuditLogs } from "../audit";
import { listConsents } from "../guests/consent.service";
import { listTeam } from "../users/service";
import { auditQuerySchema, createOrganizationSchema, updateOrganizationSchema } from "./schema";
import * as orgService from "./service";

export async function list(req: Request, res: Response) {
  sendSuccess(req, res, await orgService.listOrganizations());
}

export async function create(req: Request, res: Response) {
  const body = createOrganizationSchema.parse(req.body);
  const auth = req.auth!;
  const result = await orgService.createOrganization(
    { userId: auth.userId, name: auth.name, requestId: req.requestId, ip: req.ip },
    body
  );
  sendSuccess(req, res, result, { status: 201, message: "Organization created" });
}

export async function get(req: Request, res: Response) {
  sendSuccess(req, res, await orgService.getOrganization(req.tenant!.organizationId));
}

export async function update(req: Request, res: Response) {
  const body = updateOrganizationSchema.parse(req.body);
  sendSuccess(req, res, await orgService.updateOrganization(actorFromRequest(req), body));
}

export async function team(req: Request, res: Response) {
  sendSuccess(req, res, await listTeam(req.tenant!.organizationId));
}

export async function auditLogs(req: Request, res: Response) {
  const page = paginationSchema.parse(req.query);
  const filters = auditQuerySchema.parse(req.query);
  const { items, total } = await listAuditLogs(req.tenant!.organizationId, filters, page);
  sendPaginated(req, res, items, { ...page, total });
}

const consentQuerySchema = z.object({ status: z.enum(["opted_in", "opted_out"]).optional() });

export async function consents(req: Request, res: Response) {
  const page = paginationSchema.parse(req.query);
  const { status } = consentQuerySchema.parse(req.query);
  const { items, total } = await listConsents(req.tenant!.organizationId, { status }, page);
  sendPaginated(req, res, items, { ...page, total });
}
