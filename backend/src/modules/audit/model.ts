import { InferSchemaType, model, Schema } from "mongoose";
import { baseSchemaOptions, tenantGuardPlugin } from "../../common/utils/model";

const auditLogSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    userName: { type: String, default: "system" },
    userRole: { type: String, default: "SYSTEM" },
    /** e.g. "auth.login", "event.updated", "checkin.admitted" */
    action: { type: String, required: true },
    /** Entity type (frontend field name: resourceType). */
    resourceType: { type: String, required: true },
    resourceId: { type: String },
    details: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    requestId: { type: String },
    timestamp: { type: Date, default: () => new Date() },
  },
  { ...baseSchemaOptions(["updatedAt", "createdAt"]), collection: "auditLogs" }
);

auditLogSchema.index({ organizationId: 1, timestamp: -1 });
auditLogSchema.index({ organizationId: 1, resourceType: 1, timestamp: -1 });
auditLogSchema.plugin(tenantGuardPlugin);

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema>;
export const AuditLog = model("AuditLog", auditLogSchema);
