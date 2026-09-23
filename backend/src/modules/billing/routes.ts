import { Router } from "express";
import { requirePermission } from "../../middleware/rbac";
import * as controller from "./controller";

/** Mounted behind authenticate + resolveTenant. */
export const billingRouter = Router();

billingRouter.use(requirePermission("settings:manage"));
billingRouter.get("/usage", controller.usage);
billingRouter.get("/subscription", controller.subscription);
billingRouter.get("/invoices", controller.invoices);
