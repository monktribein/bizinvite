import type { Request, Response } from "express";
import { z } from "zod";
import { TEMPLATE_APPROVAL_STATUSES } from "../../common/constants/enums";
import { actorFromRequest } from "../../common/utils/context";
import { isWhatsAppConfigured, isWhatsAppDryRun } from "../../config/whatsapp";
import { sendSuccess } from "../../common/utils/response";
import { parseId } from "../../common/validators/common";
import { toTemplateDto } from "./model";
import * as templateService from "./service";
import { QUICK_REPLY_ACTIONS, SUPPORTED_VARIABLES } from "./variables";

const listQuerySchema = z.object({ approvalStatus: z.enum(TEMPLATE_APPROVAL_STATUSES).optional() });

const updateMappingSchema = z
  .object({
    variables: z.array(z.enum(SUPPORTED_VARIABLES)).max(20),
    buttonPayloads: z.array(z.enum(QUICK_REPLY_ACTIONS).nullable()).max(10),
    /** Public https link used as the IMAGE/VIDEO/DOCUMENT header when a message has no attachment; null clears it. */
    headerMediaUrl: z.string().url().max(1000).refine((u) => u.startsWith("https://"), "Must be an https link Meta can download").nullable(),
    /** Business field for a TEXT header placeholder; null clears it. */
    headerVariable: z.enum(SUPPORTED_VARIABLES).nullable(),
    /** Business field per button (index-aligned) for dynamic URL buttons. */
    buttonUrlVariables: z.array(z.enum(SUPPORTED_VARIABLES).nullable()).max(10),
  })
  .partial();

const createLocalSchema = z.object({
  name: z.string().trim().regex(/^[a-z0-9_]{1,100}$/, "Use lowercase letters, numbers and underscores"),
  language: z.string().max(10).default("en"),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).default("UTILITY"),
  bodyText: z.string().min(1).max(1024),
  variables: z.array(z.enum(SUPPORTED_VARIABLES)).max(20).optional(),
  buttons: z
    .array(z.object({ type: z.literal("QUICK_REPLY"), text: z.string().max(25), payload: z.enum(QUICK_REPLY_ACTIONS).optional() }))
    .max(3)
    .optional(),
});

export async function list(req: Request, res: Response) {
  const filters = listQuerySchema.parse(req.query);
  sendSuccess(req, res, await templateService.listTemplates(req.tenant!.organizationId, filters));
}

export async function get(req: Request, res: Response) {
  const id = parseId(req.params.id, "Template");
  sendSuccess(req, res, toTemplateDto(await templateService.findTemplateOrThrow(req.tenant!.organizationId, id)));
}

export async function sync(req: Request, res: Response) {
  sendSuccess(req, res, await templateService.syncTemplates(actorFromRequest(req)), { message: "Templates synchronized" });
}

export async function updateMapping(req: Request, res: Response) {
  const id = parseId(req.params.id, "Template");
  sendSuccess(req, res, await templateService.updateTemplateMapping(actorFromRequest(req), id, updateMappingSchema.parse(req.body)));
}

export async function createLocal(req: Request, res: Response) {
  const body = createLocalSchema.parse(req.body);
  sendSuccess(req, res, await templateService.createLocalTemplate(actorFromRequest(req), body), { status: 201 });
}

export function supportedVariables(req: Request, res: Response) {
  sendSuccess(req, res, {
    variables: SUPPORTED_VARIABLES,
    quickReplyActions: QUICK_REPLY_ACTIONS,
    // Lets the UI offer local test templates (dry-run) or Meta sync (live)
    whatsapp: { configured: isWhatsAppConfigured(), dryRun: isWhatsAppDryRun() },
  });
}
