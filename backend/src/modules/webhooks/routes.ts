import { Router } from "express";
import * as controller from "./controller";

/** Public (Meta-called) routes. Authenticity is established by the verify token and body signature. */
export const webhooksRouter = Router();

webhooksRouter.get("/whatsapp", controller.verify);
webhooksRouter.post("/whatsapp", controller.receive);
