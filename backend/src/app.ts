import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { corsOrigins, env } from "./config/env";
import { logger } from "./common/utils/logger";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { apiRateLimit } from "./middleware/rate-limit";
import { requestId } from "./middleware/request-id";
import { healthRouter } from "./routes/health";
import { apiRouter } from "./routes/index";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  // One reverse proxy / load balancer in front in production (needed for correct req.ip).
  app.set("trust proxy", env.NODE_ENV === "production" ? 1 : false);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).requestId,
      // Log the path only: query strings can carry tokens (e.g. webhook verify token).
      serializers: {
        req: (req: { method: string; url: string; id: string }) => ({ id: req.id, method: req.method, path: req.url.split("?")[0] }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      autoLogging: { ignore: (req) => req.url === "/health" || req.url === "/ready" },
    })
  );
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Non-browser clients (no Origin header) such as Meta webhooks are allowed; CORS only governs browsers.
        if (!origin || corsOrigins.includes(origin)) return callback(null, true);
        callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id", "X-Organization-Id"],
      exposedHeaders: ["X-Request-Id", "Content-Disposition"],
      maxAge: 600,
    })
  );
  app.use(
    express.json({
      limit: "1mb",
      // The raw body is kept for WhatsApp webhook signature verification.
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = buf;
      },
    })
  );

  app.use(healthRouter);
  app.use(env.API_PREFIX, apiRateLimit, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
