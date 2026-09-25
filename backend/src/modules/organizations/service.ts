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
import { isWhatsAppConfigured, isWhatsAppDryRun, whatsappConfig } from "../../config/whatsapp";
import { fetchPhoneNumber, fetchPhoneNumbers, fetchSubscribedApps, subscribeAppToWaba } from "../conversations/whatsapp.client";
import { Template } from "../templates/model";
import { templateSendProblem } from "../templates/service";
import { Organization, OrganizationDoc, toOrganizationDto } from "./model";

const QUALITY_RATINGS = ["GREEN", "YELLOW", "RED"] as const;

export async function getOrganization(organizationId: string) {
  const org = await Organization.findById(organizationId);
  if (!org) throw Errors.notFound("Organization");
  return toOrganizationDto(org);
}

/**
 * The organization's real WhatsApp connection state: whether messages are actually delivered
 * (live) or only logged (dry-run), which sender number is used, whether webhooks (delivery,
 * read and RSVP replies) can be received, and whether any template is sendable.
 */
export async function getWhatsAppStatus(organizationId: string) {
  const org = await Organization.findById(organizationId);
  if (!org) throw Errors.notFound("Organization");
  const live = isWhatsAppConfigured();
  const ownNumberId = org.whatsApp?.phoneNumberId ?? undefined;
  const senderNumberId = ownNumberId ?? whatsappConfig.phoneNumberId;
  const senderSource = ownNumberId ? "organization" : whatsappConfig.phoneNumberId ? "platform" : "none";
  const wabaId = org.whatsApp?.wabaId ?? whatsappConfig.businessAccountId;
  const templates = await Template.find({ organizationId });
  const approvedTemplates = templates.filter((t) => t.approvalStatus === "APPROVED").length;
  const sendableTemplates = templates.filter((t) => !templateSendProblem(t)).length;
  const webhook = {
    verifyTokenConfigured: Boolean(whatsappConfig.webhookVerifyToken),
    signatureVerification: Boolean(whatsappConfig.appSecret),
    /** Whether this app is subscribed to the WABA's webhooks (null when it could not be checked). */
    wabaSubscribed: null as boolean | null,
  };

  // Live checks against Meta: the token can use the sender number, the number is on the
  // Cloud API, and the WABA delivers webhooks to this app.
  const verification: { checked: boolean; ok: boolean; error?: string; platformType?: string } = { checked: false, ok: false };
  let sender: { phoneNumber?: string; businessDisplayName?: string; qualityRating?: string } = {};
  if (live && senderNumberId) {
    verification.checked = true;
    try {
      const details = await fetchPhoneNumber(senderNumberId);
      verification.platformType = details.platform_type;
      verification.ok = !details.platform_type || details.platform_type === "CLOUD_API";
      if (!verification.ok) verification.error = `The sender number is registered on ${details.platform_type}, not the Cloud API`;
      sender = {
        phoneNumber: details.display_phone_number,
        businessDisplayName: details.verified_name,
        qualityRating: (details.quality_rating ?? "").toUpperCase() || undefined,
      };
    } catch (err) {
      verification.error = (err as Error).message;
    }
  }
  if (live && wabaId) {
    try {
      webhook.wabaSubscribed = (await fetchSubscribedApps(wabaId)).length > 0;
    } catch {
      webhook.wabaSubscribed = null;
    }
  }

  const warnings: string[] = [];
  if (!live) warnings.push("WhatsApp Cloud API is not configured on the server: messages are logged, not delivered (dry-run).");
  if (live && senderSource === "none") warnings.push("No sender phone number is configured.");
  if (verification.checked && !verification.ok) warnings.push(`Meta rejected the sender check: ${verification.error ?? "unknown error"}`);
  if (live && !webhook.verifyTokenConfigured) warnings.push("The webhook verify token is not set, so Meta cannot subscribe to delivery and reply events.");
  if (live && !webhook.signatureVerification) {
    warnings.push("The WhatsApp app secret is not set, so delivery, read and RSVP reply webhooks cannot be verified.");
  }
  if (live && webhook.wabaSubscribed === false) {
    warnings.push("This app is not subscribed to the WhatsApp Business Account's webhooks: delivery, read and reply events will not arrive.");
  }
  if (approvedTemplates === 0) warnings.push("No approved templates yet: sync templates approved in WhatsApp Manager.");
  else if (sendableTemplates === 0) warnings.push("No template is ready to send: map the placeholders of an approved template.");

  const qualityRating = sender.qualityRating ?? org.whatsApp?.qualityRating ?? "UNKNOWN";
  return {
    mode: live ? ("live" as const) : ("dry_run" as const),
    dryRun: isWhatsAppDryRun(),
    sender: {
      source: senderSource,
      /** True when the organization uses its own number rather than the platform default. */
      dedicatedNumber: Boolean(ownNumberId),
      phoneNumberId: senderNumberId,
      phoneNumber: sender.phoneNumber ?? org.whatsApp?.phoneNumber ?? undefined,
      businessDisplayName: sender.businessDisplayName ?? org.whatsApp?.businessDisplayName ?? undefined,
      wabaId,
      qualityRating: (QUALITY_RATINGS as readonly string[]).includes(qualityRating) ? qualityRating : "UNKNOWN",
      tier: org.whatsApp?.tier ?? undefined,
      verification,
    },
    webhook,
    templates: { approved: approvedTemplates, sendable: sendableTemplates, total: templates.length, lastSyncAt: org.whatsApp?.lastSyncAt?.toISOString() },
    /** Ready to deliver real messages to guests and receive their statuses and replies. */
    ready:
      live &&
      verification.ok &&
      webhook.verifyTokenConfigured &&
      webhook.signatureVerification &&
      webhook.wabaSubscribed !== false &&
      sendableTemplates > 0,
    warnings,
  };
}

/**
 * Subscribes this app to the organization's WABA (or the platform WABA) so Meta delivers
 * message status and reply webhooks. Idempotent on Meta's side.
 */
export async function subscribeWhatsAppWebhooks(actor: ActorContext) {
  if (!isWhatsAppConfigured()) throw Errors.validation("WhatsApp Cloud API is not configured on the server");
  const org = await Organization.findById(actor.organizationId);
  if (!org) throw Errors.notFound("Organization");
  const wabaId = org.whatsApp?.wabaId ?? whatsappConfig.businessAccountId;
  if (!wabaId) throw Errors.validation("No WhatsApp Business Account is configured");
  try {
    await subscribeAppToWaba(wabaId);
  } catch (err) {
    throw Errors.whatsapp(`Meta refused the webhook subscription: ${(err as Error).message}`);
  }
  await recordAudit(actor, { action: "whatsapp.webhooks_subscribed", resourceType: "settings", resourceId: org.id, details: `Subscribed webhooks for WABA ${wabaId}` });
  return getWhatsAppStatus(actor.organizationId);
}

export async function listOrganizations() {
  const orgs = await Organization.find().sort({ createdAt: -1 }).limit(500);
  return orgs.map(toOrganizationDto);
}

export interface WhatsAppSettingsChanges {
  phoneNumberId?: string | null;
  phoneNumber?: string;
  wabaId?: string | null;
  businessDisplayName?: string;
}


/**
 * Changes the organization's WhatsApp sender. The platform access token can send from any
 * number in any WABA it manages, so the sender is a security boundary:
 * - Only platform admins may set the WABA or the display fields.
 * - Organization users may only pick a phone number that Meta lists under the WABA a
 *   platform admin connected to their organization.
 * - A phone number id is never shared by two organizations (inbound replies are routed by it).
 */
async function applyWhatsAppChanges(actor: ActorContext, org: OrganizationDoc, changes: WhatsAppSettingsChanges) {
  const isPlatformAdmin = actor.userRole === "PLATFORM_SUPER_ADMIN";
  const adminOnly = (["wabaId", "phoneNumber", "businessDisplayName"] as const).filter((k) => changes[k] !== undefined);
  if (adminOnly.length && !isPlatformAdmin) {
    throw Errors.forbidden(`Only a platform administrator can change the WhatsApp ${adminOnly.join(", ")}`);
  }

  if (changes.wabaId !== undefined) org.set("whatsApp.wabaId", changes.wabaId ?? undefined);
  if (changes.phoneNumber !== undefined) org.set("whatsApp.phoneNumber", changes.phoneNumber);
  if (changes.businessDisplayName !== undefined) org.set("whatsApp.businessDisplayName", changes.businessDisplayName);

  const phoneNumberId = changes.phoneNumberId;
  if (phoneNumberId === null) {
    // Back to the platform default sender.
    org.set("whatsApp.phoneNumberId", undefined);
  } else if (phoneNumberId !== undefined) {
    const takenBy = await Organization.exists({ _id: { $ne: org._id }, "whatsApp.phoneNumberId": phoneNumberId });
    if (takenBy) throw Errors.conflict("This WhatsApp phone number is already connected to another organization");

    const ownWabaId = org.whatsApp?.wabaId ?? undefined;
    if (!isPlatformAdmin && !ownWabaId) {
      throw Errors.forbidden("A platform administrator must connect your WhatsApp Business Account before you can choose a sender number");
    }
    if (isWhatsAppConfigured()) {
      const wabaId = ownWabaId ?? whatsappConfig.businessAccountId;
      if (!wabaId) throw Errors.validation("No WhatsApp Business Account is configured to verify the number against");
      let numbers;
      try {
        numbers = await fetchPhoneNumbers(wabaId);
      } catch (err) {
        throw Errors.whatsapp(`Could not verify the phone number with WhatsApp: ${(err as Error).message}`);
      }
      const match = numbers.find((n) => n.id === phoneNumberId);
      if (!match) {
        throw Errors.validation("This phone number is not registered to the organization's WhatsApp Business Account", {
          "whatsApp.phoneNumberId": ["Not found in the WhatsApp Business Account"],
        });
      }
      if (match.display_phone_number) org.set("whatsApp.phoneNumber", match.display_phone_number);
      if (match.verified_name) org.set("whatsApp.businessDisplayName", match.verified_name);
      const rating = (match.quality_rating ?? "").toUpperCase();
      org.set("whatsApp.qualityRating", (QUALITY_RATINGS as readonly string[]).includes(rating) ? rating : "UNKNOWN");
    } else if (!isPlatformAdmin) {
      // Without Cloud API credentials the number cannot be checked, so only an admin may set it.
      throw Errors.validation("WhatsApp is not configured on the server, so the phone number cannot be verified");
    }
    org.set("whatsApp.phoneNumberId", phoneNumberId);
  }
  org.set("whatsApp.connected", Boolean(org.whatsApp?.phoneNumberId));
}

export async function updateOrganization(
  actor: ActorContext,
  changes: {
    name?: string;
    logoUrl?: string;
    timezone?: string;
    defaultCountryCode?: string;
    whatsApp?: WhatsAppSettingsChanges;
  }
) {
  const org = await Organization.findById(actor.organizationId);
  if (!org) throw Errors.notFound("Organization");
  if (changes.name) org.name = changes.name;
  if (changes.logoUrl) org.logoUrl = changes.logoUrl;
  if (changes.timezone) org.set("settings.timezone", changes.timezone);
  if (changes.defaultCountryCode) org.set("settings.defaultCountryCode", changes.defaultCountryCode);
  if (changes.whatsApp) await applyWhatsAppChanges(actor, org, changes.whatsApp);
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
