import { Router } from "express";
import { requirePermission } from "../../middleware/rbac";
import * as controller from "./controller";

/** Mounted behind authenticate + resolveTenant. */
export const rsvpsRouter = Router();

rsvpsRouter.get("/", requirePermission("rsvp:view"), controller.list);
rsvpsRouter.get("/summary", requirePermission("rsvp:view"), controller.summary);
rsvpsRouter.patch("/:guestId", requirePermission("rsvp:update"), controller.update);
