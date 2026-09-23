import { env } from "../../config/env";
import { hmacSha256, safeEqual, sha256 } from "../../common/utils/crypto";

/**
 * Signed pass token: "v1.<base64url(json payload)>.<base64url(HMAC-SHA256)>".
 * The payload identifies the pass; the backend always re-checks the database
 * (status, admitted count) before admitting anyone, so the token grants nothing on
 * its own and cannot be forged without QR_SIGNING_SECRET.
 */
export interface PassTokenPayload {
  /** pass id */
  p: string;
  /** event id */
  e: string;
  /** invitation (eventGuest) id */
  g: string;
  /** allowed pax at issue */
  x: number;
  /** expiry, epoch seconds */
  exp: number;
  /** nonce: rotating it invalidates previously issued tokens */
  n: string;
}

const VERSION = "v1";

export function signPassToken(payload: PassTokenPayload, secret = env.QR_SIGNING_SECRET): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = hmacSha256(secret, `${VERSION}.${body}`, "base64url");
  return `${VERSION}.${body}.${signature}`;
}

export type TokenCheck = { valid: true; payload: PassTokenPayload } | { valid: false; reason: "malformed" | "bad_signature" | "expired" };

export function verifyPassToken(token: string, now = new Date(), secret = env.QR_SIGNING_SECRET): TokenCheck {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION || token.length > 1024) return { valid: false, reason: "malformed" };
  const expected = hmacSha256(secret, `${parts[0]}.${parts[1]}`, "base64url");
  if (!safeEqual(parts[2], expected)) return { valid: false, reason: "bad_signature" };
  let payload: PassTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as PassTokenPayload;
  } catch {
    return { valid: false, reason: "malformed" };
  }
  if (typeof payload.p !== "string" || typeof payload.exp !== "number") return { valid: false, reason: "malformed" };
  if (payload.exp * 1000 < now.getTime()) return { valid: false, reason: "expired" };
  return { valid: true, payload };
}

export function hashPassToken(token: string): string {
  return sha256(token);
}

/** Pass codes are entered by hand at gates: "BIZ-2026-X79K2P". */
export const PASS_CODE_PATTERN = /^BIZ-\d{4}-[A-Z0-9]{4,8}$/;
