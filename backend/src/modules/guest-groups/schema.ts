import { z } from "zod";
import { objectIdSchema } from "../../common/validators/common";

export const createGroupSchema = z.object({
  eventId: objectIdSchema,
  name: z.string().trim().min(1).max(200),
  notes: z.string().max(2000).optional(),
  primaryContactGuestId: objectIdSchema.optional(),
});

export const updateGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    notes: z.string().max(2000),
    primaryContactGuestId: objectIdSchema.nullable(),
  })
  .partial();

export const membersSchema = z.object({
  guestIds: z.array(objectIdSchema).min(1).max(200),
});

export const listGroupsQuerySchema = z.object({ eventId: objectIdSchema });
