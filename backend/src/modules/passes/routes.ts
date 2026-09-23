import { Router } from "express";
import { requireAnyPermission, requirePermission } from "../../middleware/rbac";
import * as controller from "./controller";

/** Public: signed-token QR image (no auth; the signature is the credential). Mounted before authentication. */
export const publicPassesRouter = Router();
publicPassesRouter.get("/qr/:file", controller.publicQr);

/** Mounted behind authenticate + resolveTenant. */
export const passesRouter = Router();

const canView = requireAnyPermission("passes:manage", "checkin:perform");

passesRouter.get("/", canView, controller.list);
passesRouter.post("/generate", requirePermission("passes:manage"), controller.generate);
passesRouter.post("/validate", canView, controller.validate);
passesRouter.get("/:id", canView, controller.get);
passesRouter.get("/:id/qr", canView, controller.qr);
passesRouter.post("/:id/resend", requirePermission("passes:manage"), controller.resend);
passesRouter.post("/:id/revoke", requirePermission("passes:manage"), controller.revoke);
passesRouter.post("/:id/reissue", requirePermission("passes:manage"), controller.reissue);
