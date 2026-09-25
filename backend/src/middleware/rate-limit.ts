import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { ErrorCodes } from "../common/errors/app-error";
import { env } from "../config/env";

function rateLimitedResponse(req: Request, res: Response): void {
  res.status(429).json({
    success: false,
    error: { code: ErrorCodes.RATE_LIMITED, message: "Too many requests. Please try again later." },
    meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
  });
}

const skipInTests = () => env.NODE_ENV === "test";

/**
 * Meta's webhook deliveries are exempt from the per-IP API limit: a large campaign produces
 * several status events per guest from a few Meta IPs, and a throttled delivery arrives late.
 * They are authenticated by their signature and processed asynchronously instead.
 */
export function isRateLimitExempt(path: string): boolean {
  return path.startsWith("/webhooks/");
}

/**
 * In-memory stores: limits apply per API instance. Use a shared store (for example
 * a MongoDB-backed one) if the API is scaled horizontally.
 */
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => skipInTests() || isRateLimitExempt(req.path),
  handler: rateLimitedResponse,
});

/** Brute-force protection for credential endpoints, keyed by IP + submitted email. */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: skipInTests,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase().slice(0, 254) : "";
    return `${req.ip}|${email}`;
  },
  handler: rateLimitedResponse,
});

/** Gate scanning is bursty but bounded; protects pass-code guessing. */
export const scanRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: skipInTests,
  handler: rateLimitedResponse,
});
