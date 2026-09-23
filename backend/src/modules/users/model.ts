import { HydratedDocument, InferSchemaType, model, Schema } from "mongoose";
import { ORGANIZATION_ROLES } from "../../common/constants/roles";
import { baseSchemaOptions, tenantGuardPlugin } from "../../common/utils/model";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    passwordHash: { type: String, select: false },
    status: { type: String, enum: ["active", "invited", "suspended"], default: "active" },
    /** Platform-level role; only PLATFORM_SUPER_ADMIN exists. Never assignable through the API. */
    platformRole: { type: String, enum: ["PLATFORM_SUPER_ADMIN"] },
    avatarUrl: { type: String },
    lastLoginAt: { type: Date },
    defaultOrganizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    inviteTokenHash: { type: String, select: false },
    inviteExpiresAt: { type: Date, select: false },
    passwordChangedAt: { type: Date },
  },
  { ...baseSchemaOptions(["passwordHash", "inviteTokenHash", "inviteExpiresAt"]), collection: "users" }
);

userSchema.index({ inviteTokenHash: 1 }, { sparse: true });

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model("User", userSchema);

/**
 * A user's role inside one organization. Stored in the `roles` collection:
 * one document per (organization, user) pair.
 */
const membershipSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ORGANIZATION_ROLES, required: true },
    status: { type: String, enum: ["active", "invited", "suspended"], default: "active" },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { ...baseSchemaOptions(), collection: "roles" }
);

membershipSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
membershipSchema.index({ userId: 1, status: 1 });
membershipSchema.plugin(tenantGuardPlugin);

export type MembershipDoc = HydratedDocument<InferSchemaType<typeof membershipSchema>>;
export const Membership = model("Membership", membershipSchema);
