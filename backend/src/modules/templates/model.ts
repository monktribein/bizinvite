import { HydratedDocument, InferSchemaType, model, Schema } from "mongoose";
import { TEMPLATE_APPROVAL_STATUSES } from "../../common/constants/enums";
import { baseSchemaOptions, tenantGuardPlugin } from "../../common/utils/model";
import { bodyParameterNames, templateMappingProblems } from "./variables";

const templateSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    /** Meta template id (absent for local dry-run templates). */
    externalId: { type: String },
    source: { type: String, enum: ["meta", "local"], default: "meta" },
    name: { type: String, required: true },
    language: { type: String, required: true },
    category: { type: String, enum: ["MARKETING", "UTILITY", "AUTHENTICATION"], default: "UTILITY" },
    approvalStatus: { type: String, enum: TEMPLATE_APPROVAL_STATUSES, default: "PENDING" },
    /** Raw Meta status (APPROVED, PENDING, REJECTED, PAUSED, DISABLED...). */
    metaStatus: { type: String },
    headerType: { type: String, enum: ["TEXT", "IMAGE", "VIDEO", "DOCUMENT", "NONE"], default: "NONE" },
    headerContent: { type: String },
    /** Media URL sent for IMAGE/VIDEO/DOCUMENT headers when the message has no specific media. */
    headerMediaUrl: { type: String },
    bodyText: { type: String, default: "" },
    footerText: { type: String },
    /** Business field bound to each body placeholder, in order ({{1}} -> variables[0]). */
    variables: { type: [String], default: [] },
    /** True when the template uses named placeholders ({{guest_name}}) instead of positional ones. */
    namedParameters: { type: Boolean, default: false },
    /**
     * Meta's own body placeholder names, in order ("1", "2" or "first_name"). Sent as parameter_name for
     * named templates, so a Meta name can be bound to a differently named business field.
     * Absent on older documents: variables then double as the names.
     */
    parameterNames: { type: [String], default: undefined },
    /** TEXT header placeholder (Meta allows one) and the business field bound to it. */
    headerParameterName: { type: String },
    headerVariable: { type: String },
    buttons: [
      {
        _id: false,
        type: { type: String, enum: ["QUICK_REPLY", "URL", "PHONE_NUMBER"] },
        text: String,
        /** For QUICK_REPLY: the BizInvite action (ACTION_RSVP_YES, ACTION_RSVP_NO, ACTION_RSVP_MAYBE, ACTION_OPT_OUT). */
        payload: String,
        url: String,
        /** URL button whose link ends in a {{1}} placeholder that must be filled per message. */
        dynamicUrl: Boolean,
        /** Business field that fills a dynamic URL button's placeholder. */
        urlVariable: String,
      },
    ],
    lastSyncedAt: { type: Date },
  },
  { ...baseSchemaOptions(), collection: "templates" }
);

templateSchema.index({ organizationId: 1, name: 1, language: 1 }, { unique: true });
templateSchema.index({ organizationId: 1, approvalStatus: 1 });
templateSchema.plugin(tenantGuardPlugin);

export type TemplateDoc = HydratedDocument<InferSchemaType<typeof templateSchema>>;
export const Template = model("Template", templateSchema);

/** Frontend `WhatsAppTemplate` shape. */
export function toTemplateDto(t: TemplateDoc) {
  return {
    id: t.id as string,
    name: t.name,
    language: t.language,
    category: t.category,
    approvalStatus: t.approvalStatus,
    metaStatus: t.metaStatus ?? undefined,
    source: t.source,
    headerType: t.headerType,
    headerContent: t.headerContent ?? undefined,
    headerMediaUrl: t.headerMediaUrl ?? undefined,
    headerParameterName: t.headerParameterName ?? undefined,
    headerVariable: t.headerVariable ?? undefined,
    bodyText: t.bodyText,
    footerText: t.footerText ?? undefined,
    variables: t.variables,
    parameterNames: bodyParameterNames(t),
    namedParameters: t.namedParameters,
    buttons: (t.buttons ?? []).map((b) => ({
      type: b.type,
      text: b.text,
      payload: b.payload ?? undefined,
      url: b.url ?? undefined,
      dynamicUrl: b.dynamicUrl ?? false,
      urlVariable: b.urlVariable ?? undefined,
    })),
    /** What still has to be mapped before the template can be sent (empty when it is ready). */
    mappingProblems: templateMappingProblems(t),
    lastSyncedAt: t.lastSyncedAt?.toISOString(),
  };
}
