export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  TENANT_ACCESS_DENIED: "TENANT_ACCESS_DENIED",
  TENANT_CONTEXT_REQUIRED: "TENANT_CONTEXT_REQUIRED",
  RATE_LIMITED: "RATE_LIMITED",
  WHATSAPP_ERROR: "WHATSAPP_ERROR",
  TEMPLATE_NOT_APPROVED: "TEMPLATE_NOT_APPROVED",
  DATABASE_ERROR: "DATABASE_ERROR",
  IMPORT_ERROR: "IMPORT_ERROR",
  STORAGE_ERROR: "STORAGE_ERROR",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  SERVER_ERROR: "SERVER_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    public readonly fields?: FieldErrors,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const Errors = {
  validation: (message = "Request validation failed", fields?: FieldErrors) =>
    new AppError(ErrorCodes.VALIDATION_ERROR, message, 422, fields),
  unauthorized: (message = "Authentication required") => new AppError(ErrorCodes.UNAUTHORIZED, message, 401),
  forbidden: (message = "You do not have permission to perform this action") =>
    new AppError(ErrorCodes.FORBIDDEN, message, 403),
  notFound: (entity = "Resource") => new AppError(ErrorCodes.NOT_FOUND, `${entity} not found`, 404),
  conflict: (message: string, details?: Record<string, unknown>) =>
    new AppError(ErrorCodes.CONFLICT, message, 409, undefined, details),
  tenantDenied: () =>
    new AppError(ErrorCodes.TENANT_ACCESS_DENIED, "You do not have access to this organization", 403),
  tenantRequired: () =>
    new AppError(
      ErrorCodes.TENANT_CONTEXT_REQUIRED,
      "An organization context is required. Platform admins must send the X-Organization-Id header.",
      400
    ),
  templateNotApproved: (name: string) =>
    new AppError(ErrorCodes.TEMPLATE_NOT_APPROVED, `Template "${name}" is not approved by Meta`, 400),
  whatsapp: (message: string, details?: Record<string, unknown>) =>
    new AppError(ErrorCodes.WHATSAPP_ERROR, message, 502, undefined, details),
  importError: (message: string) => new AppError(ErrorCodes.IMPORT_ERROR, message, 400),
  storage: (message: string) => new AppError(ErrorCodes.STORAGE_ERROR, message, 503),
};
