import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { authRateLimit } from "../../middleware/rate-limit";
import * as controller from "./controller";

export const authRouter = Router();

authRouter.post("/login", authRateLimit, controller.login);
authRouter.post("/refresh", authRateLimit, controller.refresh);
authRouter.post("/accept-invite", authRateLimit, controller.acceptInvite);

authRouter.post("/logout", authenticate, controller.logout);
authRouter.get("/me", authenticate, controller.me);
authRouter.post("/switch-organization", authenticate, controller.switchOrganization);
authRouter.post("/change-password", authenticate, authRateLimit, controller.changePassword);
