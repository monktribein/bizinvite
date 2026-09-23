import { Router } from "express";
import { requirePermission } from "../../middleware/rbac";
import * as controller from "./controller";

/** Mounted behind authenticate + resolveTenant. Ids are invitation (eventGuest) ids. */
export const guestsRouter = Router();

guestsRouter.get("/", requirePermission("guests:view"), controller.list);
guestsRouter.post("/", requirePermission("guests:manage"), controller.create);
guestsRouter.get("/:id", requirePermission("guests:view"), controller.get);
guestsRouter.patch("/:id", requirePermission("guests:manage"), controller.update);
guestsRouter.delete("/:id", requirePermission("guests:manage"), controller.cancel);
guestsRouter.post("/:id/opt-out", requirePermission("guests:manage"), controller.optOut);
guestsRouter.post("/:id/opt-in", requirePermission("guests:manage"), controller.optIn);
guestsRouter.post("/:id/suppress", requirePermission("guests:manage"), controller.suppress);
guestsRouter.post("/:id/unsuppress", requirePermission("guests:manage"), controller.unsuppress);
