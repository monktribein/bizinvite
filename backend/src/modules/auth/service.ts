import { randomUUID } from "crypto";
import { Errors } from "../../common/errors/app-error";
import { ROLE_PERMISSIONS, Role } from "../../common/constants/roles";
import { sha256 } from "../../common/utils/crypto";
import { logger } from "../../common/utils/logger";
import { recordAudit } from "../audit";
import { Organization } from "../organizations/model";
import { MembershipDoc, UserDoc } from "../users/model";
import { userRepository } from "../users/repository";
import { RefreshToken } from "./model";
import { burnPasswordCheck, hashPassword, verifyPassword } from "./password";
import {
  accessTokenTtlSeconds,
  refreshTokenTtlSeconds,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "./tokens";

export interface ClientInfo {
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Matches frontend `User` plus the permission list and the user's organizations. */
export interface AuthUserDto {
  id: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
  organizationName: string;
  avatarUrl?: string;
  createdAt: string;
  permissions: readonly string[];
  organizations: Array<{ id: string; name: string; role: Role }>;
}

const INVALID_CREDENTIALS = "Invalid email or password";

async function issueTokens(
  userId: string,
  organizationId: string | null,
  client: ClientInfo,
  familyId: string = randomUUID()
): Promise<AuthTokensDto> {
  const accessToken = signAccessToken(userId, organizationId, familyId);
  const refreshToken = signRefreshToken(userId, organizationId, familyId);
  await RefreshToken.create({
    userId,
    organizationId: organizationId ?? undefined,
    tokenHash: sha256(refreshToken),
    familyId,
    expiresAt: new Date(Date.now() + refreshTokenTtlSeconds() * 1000),
    createdByIp: client.ip,
    userAgent: client.userAgent?.slice(0, 300),
  });
  return { accessToken, refreshToken, expiresIn: accessTokenTtlSeconds() };
}

/** Picks the organization a session should be scoped to. */
async function resolveSessionMembership(
  user: UserDoc,
  requestedOrgId?: string
): Promise<MembershipDoc | null> {
  const memberships = await userRepository.listMembershipsForUser(user.id, "active");
  if (requestedOrgId) {
    const match = memberships.find((m) => String(m.organizationId) === requestedOrgId);
    if (!match && !user.platformRole) throw Errors.tenantDenied();
    return match ?? null;
  }
  const preferred = memberships.find((m) => String(m.organizationId) === String(user.defaultOrganizationId));
  const chosen = preferred ?? memberships[0] ?? null;
  if (!chosen && !user.platformRole) throw Errors.forbidden("Your account has no active organization membership");
  return chosen;
}

export async function buildAuthUser(user: UserDoc, organizationId: string | null): Promise<AuthUserDto> {
  const memberships = await userRepository.listMembershipsForUser(user.id, "active");
  const orgIds = memberships.map((m) => String(m.organizationId));
  if (organizationId && !orgIds.includes(organizationId)) orgIds.push(organizationId);
  const orgs = await Organization.find({ _id: { $in: orgIds } }).select("name");
  const orgName = new Map(orgs.map((o) => [o.id as string, o.name]));

  const membership = memberships.find((m) => String(m.organizationId) === organizationId);
  const role: Role = user.platformRole ? "PLATFORM_SUPER_ADMIN" : ((membership?.role as Role) ?? "READ_ONLY_VIEWER");

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role,
    organizationId: organizationId ?? "",
    organizationName: organizationId ? (orgName.get(organizationId) ?? "") : "",
    avatarUrl: user.avatarUrl ?? undefined,
    createdAt: (user.get("createdAt") as Date).toISOString(),
    permissions: ROLE_PERMISSIONS[role],
    organizations: memberships.map((m) => ({
      id: String(m.organizationId),
      name: orgName.get(String(m.organizationId)) ?? "",
      role: m.role as Role,
    })),
  };
}

export async function login(
  input: { email: string; password: string; organizationId?: string },
  client: ClientInfo
): Promise<{ user: AuthUserDto; tokens: AuthTokensDto }> {
  const user = await userRepository.findByEmail(input.email, true);
  if (!user || !user.passwordHash) {
    await burnPasswordCheck(input.password);
    logger.warn({ requestId: client.requestId }, "Login failed: unknown account");
    throw Errors.unauthorized(INVALID_CREDENTIALS);
  }
  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    logger.warn({ requestId: client.requestId, userId: user.id }, "Login failed: bad password");
    throw Errors.unauthorized(INVALID_CREDENTIALS);
  }
  if (user.status !== "active") throw Errors.forbidden("This account is not active");

  const membership = await resolveSessionMembership(user, input.organizationId);
  const organizationId = membership ? String(membership.organizationId) : (input.organizationId ?? null);

  const tokens = await issueTokens(user.id, organizationId, client);
  user.lastLoginAt = new Date();
  await user.save();

  const dto = await buildAuthUser(user, organizationId);
  if (organizationId) {
    await recordAudit(
      { organizationId, userId: user.id, userName: user.name, userRole: dto.role, ipAddress: client.ip, requestId: client.requestId },
      { action: "auth.login", resourceType: "auth", resourceId: user.id, details: `${user.email} signed in` }
    );
  }
  return { user: dto, tokens };
}

async function revokeFamily(familyId: string, reason: string): Promise<void> {
  await RefreshToken.updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });
}

export async function refresh(refreshToken: string, client: ClientInfo): Promise<AuthTokensDto> {
  const claims = verifyRefreshToken(refreshToken);
  const tokenHash = sha256(refreshToken);

  // Atomically consume the token so two concurrent refreshes cannot both succeed.
  const consumed = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { revokedAt: new Date(), revokedReason: "rotated" } }
  );
  if (!consumed) {
    const existing = await RefreshToken.findOne({ tokenHash });
    if (existing?.revokedAt) {
      // A rotated token was presented again: treat as theft and end the whole session family.
      await revokeFamily(existing.familyId, "reuse_detected");
      logger.warn({ userId: String(existing.userId), requestId: client.requestId }, "Refresh token reuse detected");
    }
    throw Errors.unauthorized("Invalid or expired refresh token");
  }

  const user = await userRepository.findById(claims.sub);
  if (!user || user.status !== "active") throw Errors.unauthorized("Account is not active");
  if (claims.org && !user.platformRole) {
    const membership = await userRepository.findMembership(claims.org, user.id);
    if (!membership || membership.status !== "active") throw Errors.unauthorized("Organization access has been removed");
  }
  return issueTokens(user.id, claims.org, client, consumed.familyId);
}

export async function logout(familyId: string | undefined, refreshToken: string | undefined, actor: {
  userId: string;
  organizationId: string | null;
  name: string;
  role: string;
  client: ClientInfo;
}): Promise<void> {
  if (refreshToken) {
    const doc = await RefreshToken.findOne({ tokenHash: sha256(refreshToken), userId: actor.userId });
    if (doc) await revokeFamily(doc.familyId, "logout");
  }
  if (familyId) await RefreshToken.updateMany({ familyId, userId: actor.userId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: "logout" } });
  if (actor.organizationId) {
    await recordAudit(
      { organizationId: actor.organizationId, userId: actor.userId, userName: actor.name, userRole: actor.role, ipAddress: actor.client.ip, requestId: actor.client.requestId },
      { action: "auth.logout", resourceType: "auth", resourceId: actor.userId, details: "Signed out" }
    );
  }
}

export async function switchOrganization(userId: string, organizationId: string, currentFamily: string, client: ClientInfo) {
  const user = await userRepository.findById(userId);
  if (!user || user.status !== "active") throw Errors.unauthorized();
  if (!user.platformRole) {
    const membership = await userRepository.findMembership(organizationId, userId);
    if (!membership || membership.status !== "active") throw Errors.tenantDenied();
  } else if (!(await Organization.exists({ _id: organizationId }))) {
    throw Errors.notFound("Organization");
  }
  await revokeFamily(currentFamily, "organization_switch");
  const tokens = await issueTokens(userId, organizationId, client);
  return { user: await buildAuthUser(user, organizationId), tokens };
}

export async function acceptInvite(token: string, password: string, client: ClientInfo) {
  const user = await userRepository.findByInviteTokenHash(sha256(token));
  if (!user || !user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
    throw Errors.validation("Invitation is invalid or has expired", { token: ["Invitation is invalid or has expired"] });
  }
  user.passwordHash = await hashPassword(password);
  user.status = "active";
  user.inviteTokenHash = undefined;
  user.inviteExpiresAt = undefined;
  user.passwordChangedAt = new Date();
  await user.save();

  const memberships = await userRepository.listMembershipsForUser(user.id);
  for (const m of memberships.filter((m) => m.status === "invited")) {
    m.status = "active";
    await m.save();
  }
  return login({ email: user.email, password }, client);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await userRepository.findById(userId).select("+passwordHash");
  if (!user || !user.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw Errors.validation("Current password is incorrect", { currentPassword: ["Current password is incorrect"] });
  }
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  await user.save();
  // End every other session.
  await RefreshToken.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: "password_changed" } });
}
