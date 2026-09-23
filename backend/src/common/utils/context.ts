import type { Request } from "express";
import { Errors } from "../errors/app-error";

/** Who is performing an operation, inside which tenant. Passed from controllers to services. */
export interface ActorContext {
  organizationId: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  ipAddress?: string;
  requestId?: string;
}

export function actorFromRequest(req: Request): ActorContext {
  if (!req.tenant) throw Errors.tenantRequired();
  return {
    organizationId: req.tenant.organizationId,
    userId: req.auth?.userId,
    userName: req.auth?.name,
    userRole: req.auth?.role,
    ipAddress: req.ip,
    requestId: req.requestId,
  };
}

/** Actor used by scheduled jobs and webhooks. */
export function systemActor(organizationId: string, source = "system"): ActorContext {
  return { organizationId, userName: source, userRole: "SYSTEM" };
}
