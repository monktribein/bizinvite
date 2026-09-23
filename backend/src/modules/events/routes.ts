import { Router } from "express";
import { requirePermission } from "../../middleware/rbac";
import * as controller from "./controller";

/** Mounted behind authenticate + resolveTenant. */
export const eventsRouter = Router();

eventsRouter.get("/", requirePermission("events:view"), controller.list);
eventsRouter.post("/", requirePermission("events:create"), controller.create);
eventsRouter.get("/:id", requirePermission("events:view"), controller.get);
eventsRouter.patch("/:id", requirePermission("events:edit"), controller.update);
