import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { env } from "../../config/env";
import { Errors } from "../../common/errors/app-error";
import { durationToSeconds } from "../../common/utils/time";

export interface AccessTokenClaims {
  sub: string;
  org: string | null;
  fam: string;
  typ: "access";
}

export interface RefreshTokenClaims {
  sub: string;
  org: string | null;
  fam: string;
  typ: "refresh";
  jti: string;
}

const ISSUER = "bizinvite";

export const accessTokenTtlSeconds = () => durationToSeconds(env.JWT_ACCESS_EXPIRES_IN);
export const refreshTokenTtlSeconds = () => durationToSeconds(env.JWT_REFRESH_EXPIRES_IN);

export function signAccessToken(userId: string, organizationId: string | null, familyId: string): string {
  const claims: AccessTokenClaims = { sub: userId, org: organizationId, fam: familyId, typ: "access" };
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    expiresIn: accessTokenTtlSeconds(),
    issuer: ISSUER,
  });
}

export function signRefreshToken(userId: string, organizationId: string | null, familyId: string): string {
  const claims: RefreshTokenClaims = { sub: userId, org: organizationId, fam: familyId, typ: "refresh", jti: randomUUID() };
  return jwt.sign(claims, env.JWT_REFRESH_SECRET, {
    algorithm: "HS256",
    expiresIn: refreshTokenTtlSeconds(),
    issuer: ISSUER,
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ["HS256"], issuer: ISSUER }) as AccessTokenClaims;
    if (decoded.typ !== "access" || !decoded.sub) throw new Error("wrong token type");
    return decoded;
  } catch {
    throw Errors.unauthorized("Invalid or expired access token");
  }
}

export function verifyRefreshToken(token: string): RefreshTokenClaims {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ["HS256"], issuer: ISSUER }) as RefreshTokenClaims;
    if (decoded.typ !== "refresh" || !decoded.sub) throw new Error("wrong token type");
    return decoded;
  } catch {
    throw Errors.unauthorized("Invalid or expired refresh token");
  }
}
