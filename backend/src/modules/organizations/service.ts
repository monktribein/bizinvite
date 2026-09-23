import { Errors } from "../../common/errors/app-error";
import type { ActorContext } from "../../common/utils/context";
import { randomToken, sha256 } from "../../common/utils/crypto";
import { isDuplicateKeyError } from "../../common/utils/model";
import { slugify } from "../../common/utils/text";
import { recordAudit } from "../audit";
import { hashPassword } from "../auth/password";
import { ensureSubscription } from "../billing/service";
import { Membership, User } from "../users/model";
import { userRepository } from "../users/repository";
import { Organization, toOrganizationDto } from "./model";

export async function getOrganization(organizationId: string) {
  const org = await Organization.findById(organizationId);
  if (!org) throw Errors.notFound("Organization");
  return toOrganizationDto(org);
}

export async function listOrganizations() {
  const orgs = await Organization.find().sort({ createdAt: -1 }).limit(500);
  return orgs.map(toOrganizationDto);
}

export async function updateOrganization(
  actor: ActorContext,
  changes: {
    name?: string;
    logoUrl?: string;
    timezone?: string;
    defaultCountryCode?: string;
    whatsApp?: { phoneNumberId?: string; phoneNumber?: string; wabaId?: string; businessDisplayName?: string };
  }
) {
  const org = await Organization.findById(actor.organizationId);
  if (!org) throw Errors.notFound("Organization");
  if (changes.name) org.name = changes.name;
  if (changes.logoUrl) org.logoUrl = changes.logoUrl;
  if (changes.timezone) org.set("settings.timezone", changes.timezone);
  if (changes.defaultCountryCode) org.set("settings.defaultCountryCode", changes.defaultCountryCode);
  if (changes.whatsApp) {
    for (const [key, value] of Object.entries(changes.whatsApp)) {
      if (value !== undefined) org.set(`whatsApp.${key}`, value);
    }
    org.set("whatsApp.connected", Boolean(org.whatsApp?.phoneNumberId || org.whatsApp?.phoneNumber));
  }
  await org.save();
  await recordAudit(actor, {
    action: "organization.updated",
    resourceType: "settings",
    resourceId: org.id,
    details: "Updated organization settings",
    metadata: { fields: Object.keys(changes) },
  });
  return toOrganizationDto(org);
}

/** Platform-admin provisioning of a new tenant with its first owner. */
export async function createOrganization(
  actor: { userId: string; name: string; requestId?: string; ip?: string },
  input: {
    name: string;
    slug?: string;
    plan: "starter" | "growth" | "enterprise";
    timezone?: string;
    owner: { name: string; email: string; password?: string };
  }
) {
  let org;
  try {
    org = await Organization.create({
      name: input.name,
      slug: input.slug ?? `${slugify(input.name)}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      plan: input.plan,
      ...(input.timezone ? { settings: { timezone: input.timezone } } : {}),
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) throw Errors.conflict("Organization slug is already in use");
    throw err;
  }
  await ensureSubscription(org.id, input.plan);

  let owner = await userRepository.findByEmail(input.owner.email);
  let inviteToken: string | undefined;
  if (!owner) {
    if (input.owner.password) {
      owner = await User.create({
        email: input.owner.email,
        name: input.owner.name,
        passwordHash: await hashPassword(input.owner.password),
        status: "active",
        defaultOrganizationId: org.id,
      });
    } else {
      inviteToken = randomToken(32);
      owner = await User.create({
        email: input.owner.email,
        name: input.owner.name,
        status: "invited",
        inviteTokenHash: sha256(inviteToken),
        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        defaultOrganizationId: org.id,
      });
    }
  }
  await Membership.create({
    organizationId: org.id,
    userId: owner.id,
    role: "ORGANIZATION_OWNER",
    status: owner.status === "active" ? "active" : "invited",
    invitedBy: actor.userId,
  });

  await recordAudit(
    { organizationId: org.id, userId: actor.userId, userName: actor.name, userRole: "PLATFORM_SUPER_ADMIN", requestId: actor.requestId, ipAddress: actor.ip },
    { action: "organization.created", resourceType: "settings", resourceId: org.id, details: `Created organization ${org.name}` }
  );
  return { organization: toOrganizationDto(org), ownerId: owner.id as string, inviteToken };
}
