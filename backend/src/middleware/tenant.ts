import type { NextFunction, Request, Response } from "express";
import { Errors } from "../common/errors/app-error";
import { logger } from "../common/utils/logger";
import { objectIdSchema } from "../common/validators/common";
import { Organization } from "../modules/organizations/model";

/**
 * Establishes the tenant for the request from the authenticated session.
 *
 * - Regular users are always scoped to the organization in their session. Any
 *   organizationId they send (header or body) must match it.
 * - Platform super admins may act inside another organization by sending
 *   `X-Organization-Id`; the access is logged.
 */
export async function resolveTenant(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const auth = req.auth;
  if (!auth) throw Errors.unauthorized();

  const headerOrg = req.header("x-organization-id")?.trim();
  let organizationId = auth.organizationId;

  if (headerOrg) {
    if (!objectIdSchema.safeParse(headerOrg).success) throw Errors.tenantDenied();
    if (auth.isPlatformAdmin) {
      const exists = await Organization.exists({ _id: headerOrg });
      if (!exists) throw Errors.notFound("Organization");
      organizationId = headerOrg;
    } else if (headerOrg !== auth.organizationId) {
      throw Errors.tenantDenied();
    }
  }

  if (!organizationId) throw Errors.tenantRequired();

  const bodyOrg = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>).organizationId : undefined;
  if (bodyOrg !== undefined && bodyOrg !== null && String(bodyOrg) !== organizationId) {
    throw Errors.tenantDenied();
  }

  const crossTenant = organizationId !== auth.organizationId;
  if (crossTenant) {
    logger.info({ requestId: req.requestId, userId: auth.userId, organizationId, path: req.path }, "Platform admin cross-tenant access");
  }
  req.tenant = { organizationId, crossTenant };
  next();
}

/**
 * For routes addressed as /organizations/:id/...: the path id must be the caller's
 * own organization unless the caller is a platform admin.
 */
export async function resolveTenantFromParam(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const auth = req.auth;
  if (!auth) throw Errors.unauthorized();
  const id = String(req.params.id ?? "");
  if (!objectIdSchema.safeParse(id).success) throw Errors.notFound("Organization");

  if (!auth.isPlatformAdmin && id !== auth.organizationId) throw Errors.tenantDenied();
  if (auth.isPlatformAdmin && !(await Organization.exists({ _id: id }))) throw Errors.notFound("Organization");

  req.tenant = { organizationId: id, crossTenant: id !== auth.organizationId };
  next();
}
