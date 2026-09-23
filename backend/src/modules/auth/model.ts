import { InferSchemaType, model, Schema } from "mongoose";

/**
 * Refresh tokens are stored only as SHA-256 hashes. Tokens rotate on every refresh;
 * all tokens issued from one login share a `familyId` so reuse of a rotated token
 * can revoke the whole session family.
 */
const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    revokedReason: { type: String },
    createdByIp: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true, collection: "refreshTokens" }
);

// Expired tokens are removed automatically.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenDoc = InferSchemaType<typeof refreshTokenSchema>;
export const RefreshToken = model("RefreshToken", refreshTokenSchema);
