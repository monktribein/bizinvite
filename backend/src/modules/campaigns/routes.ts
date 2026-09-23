import { Router } from "express";
import { requirePermission } from "../../middleware/rbac";
import * as controller from "./controller";

/** Mounted behind authenticate + resolveTenant. */
export const campaignsRouter = Router();

campaignsRouter.get("/", requirePermission("campaigns:view"), controller.list);
campaignsRouter.post("/", requirePermission("campaigns:create"), controller.create);
campaignsRouter.get("/:id", requirePermission("campaigns:view"), controller.get);
campaignsRouter.patch("/:id", requirePermission("campaigns:create"), controller.update);
campaignsRouter.get("/:id/recipients", requirePermission("campaigns:view"), controller.recipients);
campaignsRouter.post("/:id/send", requirePermission("campaigns:send"), controller.send);
campaignsRouter.post("/:id/pause", requirePermission("campaigns:send"), controller.pause);
campaignsRouter.post("/:id/resume", requirePermission("campaigns:send"), controller.resume);
campaignsRouter.post("/:id/cancel", requirePermission("campaigns:send"), controller.cancel);
campaignsRouter.post("/:id/test", requirePermission("campaigns:send"), controller.test);
