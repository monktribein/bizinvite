import { Router } from "express";
import { requirePermission } from "../../middleware/rbac";
import * as controller from "./controller";

/** Mounted behind authenticate + resolveTenant. */
export const sessionsRouter = Router();

sessionsRouter.get("/", requirePermission("events:view"), controller.list);
sessionsRouter.post("/", requirePermission("events:edit"), controller.create);
sessionsRouter.patch("/:id", requirePermission("events:edit"), controller.update);
sessionsRouter.delete("/:id", requirePermission("events:edit"), controller.remove);
