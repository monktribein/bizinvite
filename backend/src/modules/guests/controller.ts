import type { Request, Response } from "express";
import { actorFromRequest } from "../../common/utils/context";
import { sendPaginated, sendSuccess } from "../../common/utils/response";
import { paginationSchema, parseId } from "../../common/validators/common";
import { optInContact, optOutContact, resolveContact, setSuppression } from "./consent.service";
import { communicationChangeSchema, createGuestSchema, listGuestsQuerySchema, updateGuestSchema } from "./schema";
import * as guestService from "./service";

export async function list(req: Request, res: Response) {
  const page = paginationSchema.parse(req.query);
  const filters = listGuestsQuerySchema.parse(req.query);
  const { items, total } = await guestService.listGuests(req.tenant!.organizationId, filters, page);
  sendPaginated(req, res, items, { ...page, total });
}

export async function get(req: Request, res: Response) {
  const id = parseId(req.params.id, "Guest");
  sendSuccess(req, res, await guestService.getGuest(req.tenant!.organizationId, id));
}

export async function create(req: Request, res: Response) {
  const body = createGuestSchema.parse(req.body);
  sendSuccess(req, res, await guestService.createGuest(actorFromRequest(req), body), { status: 201, message: "Guest added" });
}

export async function update(req: Request, res: Response) {
  const id = parseId(req.params.id, "Guest");
  const body = updateGuestSchema.parse(req.body);
  sendSuccess(req, res, await guestService.updateGuest(actorFromRequest(req), id, body));
}

export async function cancel(req: Request, res: Response) {
  const id = parseId(req.params.id, "Guest");
  sendSuccess(req, res, await guestService.cancelInvitation(actorFromRequest(req), id), { message: "Invitation cancelled" });
}

export async function optOut(req: Request, res: Response) {
  const id = parseId(req.params.id, "Guest");
  const { reason } = communicationChangeSchema.parse(req.body ?? {});
  const actor = actorFromRequest(req);
  await optOutContact(actor, await resolveContact(actor.organizationId, id), "manual_staff_entry", reason);
  sendSuccess(req, res, { id, optedOut: true }, { message: "Guest opted out" });
}

export async function optIn(req: Request, res: Response) {
  const id = parseId(req.params.id, "Guest");
  const actor = actorFromRequest(req);
  await optInContact(actor, await resolveContact(actor.organizationId, id), "manual_staff_entry");
  sendSuccess(req, res, { id, optedOut: false }, { message: "Guest opted in" });
}

export async function suppress(req: Request, res: Response) {
  const id = parseId(req.params.id, "Guest");
  const { reason } = communicationChangeSchema.parse(req.body ?? {});
  const actor = actorFromRequest(req);
  await setSuppression(actor, await resolveContact(actor.organizationId, id), true, reason);
  sendSuccess(req, res, { id, communicationSuppressed: true }, { message: "Communication suppressed" });
}

export async function unsuppress(req: Request, res: Response) {
  const id = parseId(req.params.id, "Guest");
  const actor = actorFromRequest(req);
  await setSuppression(actor, await resolveContact(actor.organizationId, id), false);
  sendSuccess(req, res, { id, communicationSuppressed: false }, { message: "Communication resumed" });
}
