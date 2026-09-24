import { Router } from "express";
import { requireAnyPermission, requirePermission, requirePlatformAdmin } from "../../middleware/rbac";
import { resolveTenantFromParam } from "../../middleware/tenant";
import * as controller from "./controller";

/**
 * Mounted behind authenticate only: the tenant comes from the :id path segment,
 * which must be the caller's own organization (platform admins excepted).
 */
export const organizationsRouter = Router();

organizationsRouter.get("/", requirePlatformAdmin, controller.list);
organizationsRouter.post("/", requirePlatformAdmin, controller.create);

organizationsRouter.get("/:id", resolveTenantFromParam, controller.get);
organizationsRouter.patch("/:id", resolveTenantFromParam, requirePermission("settings:manage"), controller.update);
organizationsRouter.get("/:id/team", resolveTenantFromParam, requireAnyPermission("team:manage", "settings:manage"), controller.team);
organizationsRouter.post("/:id/team", resolveTenantFromParam, requirePermission("team:manage"), controller.addTeamMember);
organizationsRouter.patch("/:id/team/:memberId", resolveTenantFromParam, requirePermission("team:manage"), controller.updateTeamMember);
organizationsRouter.delete("/:id/team/:memberId", resolveTenantFromParam, requirePermission("team:manage"), controller.removeTeamMember);
organizationsRouter.get(
  "/:id/audit-logs",
  resolveTenantFromParam,
  requireAnyPermission("settings:manage", "team:manage"),
  controller.auditLogs
);
organizationsRouter.get("/:id/consents", resolveTenantFromParam, requirePermission("guests:view"), controller.consents);
