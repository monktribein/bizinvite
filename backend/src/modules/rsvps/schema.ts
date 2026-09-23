import { z } from "zod";
import { RSVP_STATUSES } from "../../common/constants/enums";
import { objectIdSchema } from "../../common/validators/common";

export const requirementsSchema = z
  .object({
    dietaryPreference: z.enum(["vegetarian", "non_vegetarian", "vegan", "jain", "other"]),
    dietaryNotes: z.string().max(1000),
    needsAccommodation: z.boolean(),
    accommodationNotes: z.string().max(1000),
    needsTransport: z.boolean(),
    arrivalDetails: z.string().max(1000),
    specialRequests: z.string().max(2000),
  })
  .partial();

export const updateRsvpSchema = z.object({
  status: z.enum(RSVP_STATUSES),
  /** Total people attending including the guest (contract `count`). */
  count: z.number().int().min(0).max(51).optional(),
  attendingSessionIds: z.array(objectIdSchema).max(30).optional(),
  requirements: requirementsSchema.optional(),
  source: z.enum(["manual_staff_entry", "phone_call"]).default("manual_staff_entry"),
  reason: z.string().max(500).optional(),
});

export const listRsvpsQuerySchema = z.object({
  eventId: objectIdSchema.optional(),
  status: z.enum(RSVP_STATUSES).optional(),
  search: z.string().max(100).optional(),
});

export type RequirementsInput = z.infer<typeof requirementsSchema>;
export type UpdateRsvpInput = z.infer<typeof updateRsvpSchema>;
