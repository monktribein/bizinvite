import { Router, type Request, type Response } from "express";
import { databaseState } from "../config/database";
import { schedulerStatus } from "../scheduler/scheduler";

const startedAt = new Date();

/** Liveness: always 200 while the process serves HTTP. No secrets or connection strings are exposed. */
export const healthRouter = Router();

healthRouter.get("/health", (_req: Request, res: Response) => {
  const mongodb = databaseState();
  res.status(200).json({
    success: true,
    data: {
      status: mongodb === "up" ? "ok" : "degraded",
      uptimeSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
      api: "up",
      mongodb,
      scheduler: schedulerStatus(),
    },
  });
});

/** Readiness: 503 until MongoDB (the only required external service) is connected. */
healthRouter.get("/ready", (_req: Request, res: Response) => {
  const mongodb = databaseState();
  const ready = mongodb === "up";
  res.status(ready ? 200 : 503).json({ success: ready, data: { ready, api: "up", mongodb, scheduler: schedulerStatus().state } });
});
