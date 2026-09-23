import { z } from "zod";

/** Only the fields BizInvite reads are validated; anything else in Meta's payload is ignored. */
const idString = z.string().min(1).max(256);

export const inboundMessageSchema = z.object({
  id: idString,
  from: z.string().regex(/^\d{6,20}$/),
  timestamp: z.string().max(20).optional(),
  type: z.string().max(40),
  text: z.object({ body: z.string().max(4096) }).optional(),
  button: z.object({ payload: z.string().max(256).optional(), text: z.string().max(256).optional() }).optional(),
  interactive: z
    .object({
      type: z.string().max(40).optional(),
      button_reply: z.object({ id: z.string().max(256), title: z.string().max(256).optional() }).optional(),
    })
    .optional(),
  context: z.object({ id: idString.optional(), from: z.string().max(20).optional() }).optional(),
});

export const statusUpdateSchema = z.object({
  id: idString,
  status: z.enum(["sent", "delivered", "read", "failed", "deleted", "warning"]),
  timestamp: z.string().max(20).optional(),
  recipient_id: z.string().max(20).optional(),
  errors: z
    .array(z.object({ code: z.number().optional(), title: z.string().max(500).optional(), message: z.string().max(500).optional() }))
    .max(5)
    .optional(),
});

export const webhookBodySchema = z.object({
  object: z.string(),
  entry: z
    .array(
      z.object({
        id: z.string().max(64).optional(),
        changes: z
          .array(
            z.object({
              field: z.string().max(64),
              value: z
                .object({
                  metadata: z.object({ phone_number_id: z.string().max(64).optional() }).optional(),
                  messages: z.array(z.unknown()).max(1000).optional(),
                  statuses: z.array(z.unknown()).max(1000).optional(),
                })
                .passthrough(),
            })
          )
          .max(100),
      })
    )
    .max(100),
});

export type InboundMessage = z.infer<typeof inboundMessageSchema>;
export type StatusUpdate = z.infer<typeof statusUpdateSchema>;
