import type { Request, Response } from "express";
import { sendSuccess } from "../../common/utils/response";
import * as billingService from "./service";

export async function usage(req: Request, res: Response) {
  sendSuccess(req, res, await billingService.getUsage(req.tenant!.organizationId));
}

export async function subscription(req: Request, res: Response) {
  sendSuccess(req, res, await billingService.getSubscription(req.tenant!.organizationId));
}

export async function invoices(req: Request, res: Response) {
  sendSuccess(req, res, await billingService.listInvoices(req.tenant!.organizationId));
}
