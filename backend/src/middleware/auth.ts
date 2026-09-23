import type { NextFunction, Request, Response } from "express";
import { Errors } from "../common/errors/app-error";
import type { Role } from "../common/constants/roles";
import { verifyAccessToken } from "../modules/auth/tokens";
import { userRepository } from "../modules/users/repository";

/**
 * Verifies the Bearer access token, then reloads the user and membership from the
 * database so suspensions and role changes take effect immediately. The role is
 * never taken from the token itself.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.header("authorization");
  if (!header || !header.startsWith("Bearer ")) throw Errors.unauthorized();
  const claims = verifyAccessToken(header.slice(7).trim());

  const user = await userRepository.findById(claims.sub);
  if (!user || user.status !== "active") throw Errors.unauthorized("Account is not active");

  const issuedAt = (claims as unknown as { iat?: number }).iat;
  if (user.passwordChangedAt && issuedAt && issuedAt * 1000 < user.passwordChangedAt.getTime() - 1000) {
    throw Errors.unauthorized("Session expired after password change");
  }

  let role: Role;
  if (user.platformRole === "PLATFORM_SUPER_ADMIN") {
    role = "PLATFORM_SUPER_ADMIN";
  } else {
    if (!claims.org) throw Errors.unauthorized();
    const membership = await userRepository.findMembership(claims.org, user.id);
    if (!membership || membership.status !== "active") throw Errors.unauthorized("Organization access has been removed");
    role = membership.role as Role;
  }

  req.auth = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role,
    organizationId: claims.org,
    isPlatformAdmin: role === "PLATFORM_SUPER_ADMIN",
  };
  req.sessionFamily = claims.fam;
  next();
}
