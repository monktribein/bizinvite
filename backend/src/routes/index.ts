import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { resolveTenant } from "../middleware/tenant";
import { authRouter } from "../modules/auth/routes";
import { billingRouter } from "../modules/billing/routes";
import { campaignsRouter } from "../modules/campaigns/routes";
import { checkInsRouter } from "../modules/check-ins/routes";
import { conversationsRouter } from "../modules/conversations/routes";
import { eventsRouter } from "../modules/events/routes";
import { guestGroupsRouter } from "../modules/guest-groups/routes";
import { guestsRouter } from "../modules/guests/routes";
import { importsRouter } from "../modules/imports/routes";
import { organizationsRouter } from "../modules/organizations/routes";
import { passesRouter, publicPassesRouter } from "../modules/passes/routes";
import { reminderRulesRouter } from "../modules/reminder-rules/routes";
import { reportsRouter } from "../modules/reports/routes";
import { rsvpsRouter } from "../modules/rsvps/routes";
import { sessionsRouter } from "../modules/sessions/routes";
import { templatesRouter } from "../modules/templates/routes";
import { usersRouter } from "../modules/users/routes";
import { webhooksRouter } from "../modules/webhooks/routes";

/** Everything under API_PREFIX (/api/v1). */
export const apiRouter = Router();

// Public
apiRouter.use("/auth", authRouter);
apiRouter.use("/webhooks", webhooksRouter);
apiRouter.use("/passes", publicPassesRouter);

// Authenticated; tenant taken from the :id path segment
apiRouter.use("/organizations", authenticate, organizationsRouter);

// Authenticated and tenant-scoped
const tenant = [authenticate, resolveTenant];
apiRouter.use("/users", ...tenant, usersRouter);
apiRouter.use("/events", ...tenant, eventsRouter);
apiRouter.use("/sessions", ...tenant, sessionsRouter);
apiRouter.use("/guests", ...tenant, guestsRouter);
apiRouter.use("/guest-groups", ...tenant, guestGroupsRouter);
apiRouter.use("/imports", ...tenant, importsRouter);
apiRouter.use("/templates", ...tenant, templatesRouter);
apiRouter.use("/campaigns", ...tenant, campaignsRouter);
apiRouter.use("/reminder-rules", ...tenant, reminderRulesRouter);
apiRouter.use("/rsvps", ...tenant, rsvpsRouter);
apiRouter.use("/conversations", ...tenant, conversationsRouter);
apiRouter.use("/passes", ...tenant, passesRouter);
apiRouter.use("/check-ins", ...tenant, checkInsRouter);
apiRouter.use("/reports", ...tenant, reportsRouter);
apiRouter.use("/billing", ...tenant, billingRouter);
