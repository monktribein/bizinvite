import type { Request, Response } from "express";
import { Errors } from "../../common/errors/app-error";
import { safeEqual } from "../../common/utils/crypto";
import { logger } from "../../common/utils/logger";
import { whatsappConfig } from "../../config/whatsapp";
import { env } from "../../config/env";
import { enqueueWebhookEvents, ingestWebhook, verifySignature } from "./service";

/** Meta's subscription handshake: echo hub.challenge when the verify token matches. */
export function verify(req: Request, res: Response) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const expected = whatsappConfig.webhookVerifyToken;
  if (mode === "subscribe" && typeof token === "string" && expected && safeEqual(token, expected) && typeof challenge === "string") {
    res.status(200).type("text/plain").send(challenge.slice(0, 200));
    return;
  }
  throw Errors.forbidden("Webhook verification failed");
}

export async function receive(req: Request, res: Response) {
  if (whatsappConfig.appSecret) {
    if (!verifySignature(req.rawBody, req.header("x-hub-signature-256"))) {
      logger.warn({ requestId: req.requestId }, "Rejected WhatsApp webhook with invalid signature");
      throw Errors.unauthorized("Invalid webhook signature");
    }
  } else if (env.NODE_ENV === "production") {
    // Unreachable with a valid production env, kept as a hard stop.
    throw Errors.unauthorized("Webhook signature verification is not configured");
  }

  const ids = await ingestWebhook(req.body);
  await enqueueWebhookEvents(ids);
  // Meta only needs a fast 2xx; processing happens in whatsapp.process-webhook jobs.
  res.status(200).json({ success: true, data: { received: ids.length } });
}
