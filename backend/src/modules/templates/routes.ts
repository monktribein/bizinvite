import { Router } from "express";
import { requireAnyPermission } from "../../middleware/rbac";
import * as controller from "./controller";

/** Mounted behind authenticate + resolveTenant. */
export const templatesRouter = Router();

const canView = requireAnyPermission("campaigns:view", "reminders:view", "settings:manage");
const canManage = requireAnyPermission("settings:manage", "campaigns:create");

templatesRouter.get("/", canView, controller.list);
templatesRouter.get("/variables", canView, controller.supportedVariables);
templatesRouter.post("/sync", canManage, controller.sync);
templatesRouter.post("/", canManage, controller.createLocal);
templatesRouter.get("/:id", canView, controller.get);
templatesRouter.patch("/:id", canManage, controller.updateMapping);
