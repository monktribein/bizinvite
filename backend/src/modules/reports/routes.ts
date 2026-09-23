import { Router } from "express";
import { requirePermission } from "../../middleware/rbac";
import * as controller from "./controller";

/** Mounted behind authenticate + resolveTenant. */
export const reportsRouter = Router();

const canView = requirePermission("reports:view");
const canExport = requirePermission("reports:export");

reportsRouter.get("/invitation-funnel", canView, controller.invitationFunnel);
reportsRouter.get("/rsvp", canView, controller.rsvp);
reportsRouter.get("/attendance", canView, controller.attendance);
reportsRouter.get("/reminders", canView, controller.reminders);
reportsRouter.get("/failures", canView, controller.failures);
reportsRouter.get("/event-summary", canView, controller.eventSummary);
reportsRouter.get("/exports/:jobId", canExport, controller.backgroundExportStatus);
reportsRouter.get("/:type/export", canExport, controller.exportReport);
reportsRouter.post("/:type/exports", canExport, controller.queueBackgroundExport);
