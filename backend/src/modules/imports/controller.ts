import type { Request, Response } from "express";
import { z } from "zod";
import { Errors } from "../../common/errors/app-error";
import { actorFromRequest } from "../../common/utils/context";
import { sendSuccess } from "../../common/utils/response";
import { objectIdSchema, parseId } from "../../common/validators/common";
import { looksLikeText } from "./csv";
import * as importService from "./service";

const commitSchema = z.object({
  importId: objectIdSchema,
  eventId: objectIdSchema,
  columnMappings: z.array(z.object({ csvHeader: z.string().max(200), targetField: z.string().max(50) })).max(50).optional(),
  duplicateResolutions: z.record(z.string().regex(/^row_\d+$/), z.enum(["skip", "overwrite"])).optional(),
});

export async function preview(req: Request, res: Response) {
  const file = req.file;
  if (!file) throw Errors.validation("A CSV file is required", { file: ["A CSV file is required"] });
  if (!looksLikeText(file.buffer)) throw Errors.importError("The uploaded file is not a text CSV file");
  sendSuccess(req, res, await importService.previewImport(actorFromRequest(req), file));
}

export async function commit(req: Request, res: Response) {
  const body = commitSchema.parse(req.body);
  const { async, result } = await importService.commitImport(actorFromRequest(req), body);
  sendSuccess(req, res, result, {
    status: async ? 202 : 200,
    message: async ? "Import queued for background processing" : "Import completed",
  });
}

export async function get(req: Request, res: Response) {
  const id = parseId(req.params.id, "Import");
  sendSuccess(req, res, await importService.getImport(req.tenant!.organizationId, id));
}
