import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { ZodError } from "zod";
import { AppError, ErrorCodes, FieldErrors } from "../common/errors/app-error";
import { logger } from "../common/utils/logger";
import { isDuplicateKeyError, TenantGuardError } from "../common/utils/model";
import { env } from "../config/env";

function zodFields(error: ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

interface ErrorBody {
  code: string;
  message: string;
  fields?: FieldErrors;
  details?: Record<string, unknown>;
}

function send(req: Request, res: Response, status: number, error: ErrorBody): void {
  res.status(status).json({
    success: false,
    error,
    meta: { requestId: req.requestId, timestamp: new Date().toISOString() },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  send(req, res, 404, { code: ErrorCodes.NOT_FOUND, message: `Route ${req.method} ${req.path} not found` });
}

/** Central error translator. Never exposes stack traces or internal messages in production. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error({ requestId: req.requestId, code: err.code, err: err.message }, "Request failed");
    return send(req, res, err.status, {
      code: err.code,
      message: err.message,
      ...(err.fields ? { fields: err.fields } : {}),
      ...(err.details ? { details: err.details } : {}),
    });
  }

  if (err instanceof ZodError) {
    return send(req, res, 422, {
      code: ErrorCodes.VALIDATION_ERROR,
      message: "Request validation failed",
      fields: zodFields(err),
    });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const fields: FieldErrors = {};
    for (const [key, value] of Object.entries(err.errors)) fields[key] = [value.message];
    return send(req, res, 422, { code: ErrorCodes.VALIDATION_ERROR, message: "Request validation failed", fields });
  }

  if (err instanceof mongoose.Error.CastError) {
    return send(req, res, 422, {
      code: ErrorCodes.VALIDATION_ERROR,
      message: "Request validation failed",
      fields: { [err.path]: [`Invalid value for ${err.path}`] },
    });
  }

  if (isDuplicateKeyError(err)) {
    return send(req, res, 409, { code: ErrorCodes.CONFLICT, message: "A record with the same unique value already exists" });
  }

  if (err instanceof multer.MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return send(req, res, status, {
      code: status === 413 ? ErrorCodes.PAYLOAD_TOO_LARGE : ErrorCodes.IMPORT_ERROR,
      message: err.code === "LIMIT_FILE_SIZE" ? "Uploaded file is too large" : err.message,
    });
  }

  const bodyError = err as { type?: string; status?: number };
  if (bodyError?.type === "entity.parse.failed") {
    return send(req, res, 400, { code: ErrorCodes.VALIDATION_ERROR, message: "Malformed JSON body" });
  }
  if (bodyError?.type === "entity.too.large") {
    return send(req, res, 413, { code: ErrorCodes.PAYLOAD_TOO_LARGE, message: "Request body is too large" });
  }

  const message = err instanceof Error ? err.message : String(err);
  logger.error(
    { requestId: req.requestId, err: message, stack: err instanceof Error ? err.stack : undefined, tenantGuard: err instanceof TenantGuardError },
    "Unhandled error"
  );
  send(req, res, 500, {
    code: ErrorCodes.SERVER_ERROR,
    message: env.NODE_ENV === "production" ? "An unexpected error occurred" : message,
  });
}
