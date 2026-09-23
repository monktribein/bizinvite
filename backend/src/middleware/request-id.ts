import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

const SAFE_ID = /^[\w-]{8,64}$/;

/** Accepts a caller-supplied X-Request-Id when well-formed, otherwise generates one. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id");
  req.requestId = incoming && SAFE_ID.test(incoming) ? incoming : `req_${randomUUID().replace(/-/g, "")}`;
  res.setHeader("X-Request-Id", req.requestId);
  next();
}
