import { Router } from "express";
import { requireAnyPermission } from "../../middleware/rbac";
import * as controller from "./controller";

/** Mounted behind authenticate + resolveTenant. Guest chat history is limited to messaging/guest managers. */
export const conversationsRouter = Router();

const canRead = requireAnyPermission("campaigns:view", "guests:manage");

conversationsRouter.get("/", canRead, controller.list);
conversationsRouter.get("/:id/messages", canRead, controller.messages);
conversationsRouter.post("/:id/read", canRead, controller.markRead);
