import { Router } from "express";
import { requirePermission } from "../../middleware/rbac";
import * as controller from "./controller";

/** Mounted behind authenticate + resolveTenant. */
export const reminderRulesRouter = Router();

reminderRulesRouter.get("/", requirePermission("reminders:view"), controller.list);
reminderRulesRouter.post("/", requirePermission("reminders:configure"), controller.create);
reminderRulesRouter.patch("/:id", requirePermission("reminders:configure"), controller.update);
reminderRulesRouter.post("/:id/activate", requirePermission("reminders:configure"), controller.activate);
reminderRulesRouter.post("/:id/pause", requirePermission("reminders:configure"), controller.pause);
