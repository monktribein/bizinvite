import { z } from "zod";
import { isoDateSchema, objectIdSchema } from "../../common/validators/common";

const sessionFields = {
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  startTime: isoDateSchema,
  endTime: isoDateSchema,
  venueName: z.string().max(200).optional(),
  venueAddress: z.string().max(500).optional(),
  dressCode: z.string().max(200).optional(),
  capacity: z.number().int().min(0).optional(),
};

/** Session payload embedded in POST /events. */
export const embeddedSessionSchema = z
  .object(sessionFields)
  .refine((s) => s.endTime >= s.startTime, { message: "endTime must be after startTime", path: ["endTime"] });

export const createSessionSchema = z
  .object({ eventId: objectIdSchema, ...sessionFields })
  .refine((s) => s.endTime >= s.startTime, { message: "endTime must be after startTime", path: ["endTime"] });

export const updateSessionSchema = z.object(sessionFields).partial();

export const listSessionsQuerySchema = z.object({ eventId: objectIdSchema });
