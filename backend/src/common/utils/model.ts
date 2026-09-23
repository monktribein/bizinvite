import { Schema, Types } from "mongoose";

/**
 * JSON output: `_id` becomes `id`, ObjectIds become strings, `__v` is dropped.
 * Fields listed in `hidden` are always stripped.
 */
export function baseSchemaOptions(hidden: string[] = []) {
  return {
    timestamps: true as const,
    toJSON: {
      virtuals: false,
      versionKey: false,
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        for (const field of hidden) delete ret[field];
        return ret;
      },
    },
  };
}

const TENANT_GUARDED_OPS = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
  "countDocuments",
  "updateOne",
  "updateMany",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "distinct",
] as const;

export class TenantGuardError extends Error {
  constructor(model: string, op: string) {
    super(`Tenant guard: ${model}.${op} executed without an organizationId filter`);
    this.name = "TenantGuardError";
  }
}

/**
 * Defense in depth for multi-tenancy: every query on a tenant-owned model must
 * filter by organizationId. Legitimate cross-tenant lookups (webhook routing by
 * WhatsApp message id, the scheduler claiming jobs) opt out explicitly with
 * `.setOptions({ skipTenantGuard: true })`.
 */
export function tenantGuardPlugin(schema: Schema): void {
  for (const op of TENANT_GUARDED_OPS) {
    schema.pre(op, function (this: { getFilter(): Record<string, unknown>; getOptions(): Record<string, unknown>; model: { modelName: string } }) {
      if (this.getOptions().skipTenantGuard) return;
      const filter = this.getFilter();
      if (filter.organizationId === undefined || filter.organizationId === null) {
        throw new TenantGuardError(this.model.modelName, op);
      }
    });
  }
}

export const tenantField = {
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
};

export function toObjectId(id: string | Types.ObjectId): Types.ObjectId {
  return typeof id === "string" ? new Types.ObjectId(id) : id;
}

export function idString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Types.ObjectId) return value.toHexString();
  if (typeof value === "object" && "_id" in (value as Record<string, unknown>)) {
    return idString((value as Record<string, unknown>)._id);
  }
  return String(value);
}

export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

/** Mongoose query options including the tenant-guard escape hatch. */
export const CROSS_TENANT = { skipTenantGuard: true } as const;
