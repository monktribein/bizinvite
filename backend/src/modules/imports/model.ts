import { HydratedDocument, InferSchemaType, model, Schema } from "mongoose";
import { baseSchemaOptions, tenantGuardPlugin } from "../../common/utils/model";

/**
 * One CSV import session. The raw file is kept on the document between preview and
 * commit (files are capped well below the 16MB document limit); previews that are
 * never committed expire automatically via the TTL index on expiresAt.
 */
const importSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    rawCsv: { type: String, required: true, select: false },
    status: { type: String, enum: ["previewed", "pending", "processing", "completed", "failed"], default: "previewed" },
    eventId: { type: Schema.Types.ObjectId, ref: "Event" },
    columnMappings: [{ _id: false, csvHeader: String, targetField: String }],
    duplicateResolutions: { type: Map, of: String },
    preview: {
      totalRows: Number,
      validRows: Number,
      errorRows: Number,
      duplicateCount: Number,
    },
    summary: {
      totalRows: { type: Number, default: 0 },
      successfulRows: { type: Number, default: 0 },
      duplicateRows: { type: Number, default: 0 },
      invalidRows: { type: Number, default: 0 },
      createdCount: { type: Number, default: 0 },
      updatedCount: { type: Number, default: 0 },
    },
    rowErrors: [{ _id: false, rowNumber: Number, field: String, message: String }],
    failureReason: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    startedAt: { type: Date },
    completedAt: { type: Date },
    expiresAt: { type: Date },
  },
  { ...baseSchemaOptions(["rawCsv"]), collection: "imports" }
);

importSchema.index({ organizationId: 1, createdAt: -1 });
importSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
importSchema.plugin(tenantGuardPlugin);

export type ImportDoc = HydratedDocument<InferSchemaType<typeof importSchema>>;
export const Import = model("Import", importSchema);
