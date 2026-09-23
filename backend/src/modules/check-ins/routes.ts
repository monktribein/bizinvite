import { Router } from "express";
import { scanRateLimit } from "../../middleware/rate-limit";
import { requireAnyPermission, requirePermission } from "../../middleware/rbac";
import * as controller from "./controller";

/** Mounted behind authenticate + resolveTenant. */
export const checkInsRouter = Router();

checkInsRouter.post("/scan", scanRateLimit, requirePermission("checkin:perform"), controller.scan);
checkInsRouter.post("/manual", requirePermission("checkin:perform"), controller.manual);
checkInsRouter.post("/group", requirePermission("checkin:perform"), controller.group);
checkInsRouter.get("/lookup", requirePermission("checkin:perform"), controller.lookup);
checkInsRouter.get("/summary", requireAnyPermission("checkin:perform", "reports:view"), controller.summary);
