import type { Request, Response } from "express";
import { z } from "zod";
import { sendPaginated, sendSuccess } from "../../common/utils/response";
import { objectIdSchema, paginationSchema, parseId } from "../../common/validators/common";
import * as conversationService from "./service";

const listQuerySchema = z.object({ guestId: objectIdSchema.optional(), eventId: objectIdSchema.optional() });

export async function list(req: Request, res: Response) {
  const page = paginationSchema.parse(req.query);
  const filters = listQuerySchema.parse(req.query);
  const { items, total } = await conversationService.listConversations(req.tenant!.organizationId, filters, page);
  sendPaginated(req, res, items, { ...page, total });
}

export async function messages(req: Request, res: Response) {
  const id = parseId(req.params.id, "Conversation");
  const page = paginationSchema.parse(req.query);
  const { items, total } = await conversationService.listMessages(req.tenant!.organizationId, id, page);
  sendPaginated(req, res, items, { ...page, total });
}

export async function markRead(req: Request, res: Response) {
  const id = parseId(req.params.id, "Conversation");
  sendSuccess(req, res, await conversationService.markConversationRead(req.tenant!.organizationId, id));
}
