import type { NextFunction, Request, Response } from "express";
import { Errors } from "../common/errors/app-error";
import { Permission, roleHasPermission } from "../common/constants/roles";

/** Requires every listed permission. */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.auth?.role;
    if (!role) throw Errors.unauthorized();
    if (!permissions.every((p) => roleHasPermission(role, p))) throw Errors.forbidden();
    next();
  };
}

/** Requires at least one of the listed permissions. */
export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.auth?.role;
    if (!role) throw Errors.unauthorized();
    if (!permissions.some((p) => roleHasPermission(role, p))) throw Errors.forbidden();
    next();
  };
}

export function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth) throw Errors.unauthorized();
  if (!req.auth.isPlatformAdmin) throw Errors.forbidden();
  next();
}
