import { HydratedDocument, InferSchemaType, model, Schema } from "mongoose";
import { DEFAULT_TIMEZONE } from "../../common/constants/enums";
import { baseSchemaOptions } from "../../common/utils/model";

export const ORGANIZATION_PLANS = ["starter", "growth", "enterprise"] as const;

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logoUrl: { type: String },
    plan: { type: String, enum: ORGANIZATION_PLANS, default: "starter" },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    whatsApp: {
      connected: { type: Boolean, default: false },
      /** Cloud API phone number id used to send for this organization (falls back to the platform default). */
      phoneNumberId: { type: String },
      phoneNumber: { type: String },
      wabaId: { type: String },
      businessDisplayName: { type: String },
      qualityRating: { type: String, enum: ["GREEN", "YELLOW", "RED", "UNKNOWN"], default: "UNKNOWN" },
      tier: { type: String },
      lastSyncAt: { type: Date },
    },
    settings: {
      timezone: { type: String, default: DEFAULT_TIMEZONE },
      defaultCountryCode: { type: String, default: "91" },
    },
  },
  { ...baseSchemaOptions(), collection: "organizations" }
);

organizationSchema.index({ "whatsApp.phoneNumberId": 1 }, { sparse: true });

export type OrganizationDoc = HydratedDocument<InferSchemaType<typeof organizationSchema>>;
export const Organization = model("Organization", organizationSchema);

/** Response shape matching frontend `Organization`. */
export function toOrganizationDto(org: OrganizationDoc) {
  return {
    id: org.id as string,
    name: org.name,
    slug: org.slug,
    logoUrl: org.logoUrl ?? undefined,
    plan: org.plan,
    status: org.status,
    whatsAppStatus: {
      connected: org.whatsApp?.connected ?? false,
      phoneNumber: org.whatsApp?.phoneNumber ?? undefined,
      wabaId: org.whatsApp?.wabaId ?? undefined,
      businessDisplayName: org.whatsApp?.businessDisplayName ?? undefined,
      qualityRating: org.whatsApp?.qualityRating ?? "UNKNOWN",
      tier: org.whatsApp?.tier ?? undefined,
      lastSyncAt: org.whatsApp?.lastSyncAt?.toISOString(),
    },
    settings: {
      timezone: org.settings?.timezone,
      defaultCountryCode: org.settings?.defaultCountryCode,
    },
    createdAt: (org.get("createdAt") as Date | undefined)?.toISOString(),
  };
}
