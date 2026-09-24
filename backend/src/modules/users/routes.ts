import { Router } from "express";
import { requireAnyPermission, requirePermission } from "../../middleware/rbac";
import * as controller from "./controller";

/** Mounted behind authenticate + resolveTenant. */
export const usersRouter = Router();

usersRouter.get("/", requireAnyPermission("team:manage", "settings:manage"), controller.list);
usersRouter.post("/invite", requirePermission("team:manage"), controller.invite);
usersRouter.patch("/:id", requirePermission("team:manage"), controller.update);
usersRouter.delete("/:id", requirePermission("team:manage"), controller.remove);
