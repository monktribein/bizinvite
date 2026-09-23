import { Errors } from "../../common/errors/app-error";
import { OrganizationRole, Role, ROLE_RANK } from "../../common/constants/roles";
import type { ActorContext } from "../../common/utils/context";
import { randomToken, sha256 } from "../../common/utils/crypto";
import { recordAudit } from "../audit";
import { RefreshToken } from "../auth/model";
import { Membership, MembershipDoc, User, UserDoc } from "./model";
import { userRepository } from "./repository";

const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;

/** Frontend `TeamMember` shape. */
export function toTeamMemberDto(user: UserDoc, membership: MembershipDoc) {
  return {
    id: user.id as string,
    membershipId: membership.id as string,
    name: user.name,
    email: user.email,
    role: membership.role as Role,
    status: membership.status === "active" && user.status === "suspended" ? "suspended" : membership.status,
    lastLoginAt: user.lastLoginAt?.toISOString(),
    createdAt: (membership.get("createdAt") as Date).toISOString(),
  };
}

export async function listTeam(organizationId: string) {
  const memberships = await userRepository.listMembershipsForOrganization(organizationId);
  const users = await User.find({ _id: { $in: memberships.map((m) => m.userId) } });
  const byId = new Map(users.map((u) => [u.id as string, u]));
  return memberships
    .map((m) => {
      const user = byId.get(String(m.userId));
      return user ? toTeamMemberDto(user, m) : null;
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);
}

function assertCanAssign(actorRole: string | undefined, targetRole: string): void {
  const actorRank = ROLE_RANK[(actorRole ?? "READ_ONLY_VIEWER") as Role] ?? 0;
  const targetRank = ROLE_RANK[targetRole as Role] ?? 0;
  if (targetRank > actorRank) throw Errors.forbidden("You cannot assign a role higher than your own");
}

/**
 * Invites a user into the organization. Email delivery is outside the MVP scope,
 * so the one-time invitation token is returned to the inviter to share.
 */
export async function inviteUser(actor: ActorContext, input: { name: string; email: string; role: string }) {
  assertCanAssign(actor.userRole, input.role);

  let user = await userRepository.findByEmail(input.email);
  let inviteToken: string | undefined;

  if (!user) {
    inviteToken = randomToken(32);
    user = await User.create({
      email: input.email,
      name: input.name,
      status: "invited",
      inviteTokenHash: sha256(inviteToken),
      inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
      defaultOrganizationId: actor.organizationId,
    });
  }

  const existing = await userRepository.findMembership(actor.organizationId, user.id);
  if (existing) throw Errors.conflict("This user is already a member of the organization");

  const membership = await Membership.create({
    organizationId: actor.organizationId,
    userId: user.id,
    role: input.role as OrganizationRole,
    // Existing active accounts join immediately; new accounts activate on invitation acceptance.
    status: user.status === "active" ? "active" : "invited",
    invitedBy: actor.userId,
  });

  await recordAudit(actor, {
    action: "user.invited",
    resourceType: "settings",
    resourceId: user.id,
    details: `Invited ${input.email} as ${input.role}`,
    metadata: { role: input.role },
  });

  return { member: toTeamMemberDto(user, membership), inviteToken };
}

export async function updateMember(
  actor: ActorContext,
  userId: string,
  changes: { role?: string; status?: "active" | "suspended"; name?: string }
) {
  const membership = await userRepository.findMembership(actor.organizationId, userId);
  if (!membership) throw Errors.notFound("Team member");
  const user = await User.findById(userId);
  if (!user) throw Errors.notFound("Team member");

  if (userId === actor.userId && (changes.role || changes.status)) {
    throw Errors.forbidden("You cannot change your own role or status");
  }
  // The target's current role must also be within the actor's authority.
  assertCanAssign(actor.userRole, membership.role);
  if (changes.role) assertCanAssign(actor.userRole, changes.role);

  if (membership.role === "ORGANIZATION_OWNER" && (changes.role && changes.role !== "ORGANIZATION_OWNER" || changes.status === "suspended")) {
    const owners = await Membership.countDocuments({ organizationId: actor.organizationId, role: "ORGANIZATION_OWNER", status: "active" });
    if (owners <= 1) throw Errors.conflict("An organization must keep at least one active owner");
  }

  const before = { role: membership.role, status: membership.status };
  if (changes.role) membership.role = changes.role as OrganizationRole;
  if (changes.status) membership.status = changes.status;
  await membership.save();
  if (changes.name) {
    user.name = changes.name;
    await user.save();
  }

  if (changes.status === "suspended") {
    // Revoke refresh sessions bound to this organization.
    await RefreshToken.updateMany(
      { userId, organizationId: actor.organizationId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: "membership_suspended" } }
    );
  }

  await recordAudit(actor, {
    action: "user.updated",
    resourceType: "settings",
    resourceId: userId,
    details: `Updated team member ${user.email}`,
    metadata: { before, after: { role: membership.role, status: membership.status } },
  });

  return toTeamMemberDto(user, membership);
}
