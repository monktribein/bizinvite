import { Router } from "express";
import { requirePermission } from "../../middleware/rbac";
import * as controller from "./controller";

/** Mounted behind authenticate + resolveTenant. */
export const guestGroupsRouter = Router();

guestGroupsRouter.get("/", requirePermission("guests:view"), controller.list);
guestGroupsRouter.post("/", requirePermission("guests:manage"), controller.create);
guestGroupsRouter.patch("/:id", requirePermission("guests:manage"), controller.update);
guestGroupsRouter.post("/:id/members", requirePermission("guests:manage"), controller.addMembers);
guestGroupsRouter.post("/:id/members/remove", requirePermission("guests:manage"), controller.removeMembers);
