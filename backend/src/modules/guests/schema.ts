import { z } from "zod";
import { CHECKIN_STATUSES, GUEST_CATEGORIES, RSVP_STATUSES } from "../../common/constants/enums";
import { booleanQuerySchema, objectIdSchema } from "../../common/validators/common";

const contactFields = {
  name: z.string().trim().min(1, "Name is required").max(200),
  mobile: z.string().trim().min(1, "Mobile number is required").max(32),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254).optional().or(z.literal("").transform(() => undefined)),
  category: z.enum(GUEST_CATEGORIES).default("Family"),
  isVip: z.boolean().default(false),
  city: z.string().trim().max(120).optional(),
  preferredLanguage: z.string().trim().max(40).optional(),
  relationshipWithHost: z.string().trim().max(120).optional(),
  assignedRelationshipManager: z.string().trim().max(120).optional(),
};

const invitationFields = {
  allowedCompanions: z.number().int().min(0).max(50).default(0),
  invitedSessionIds: z.array(objectIdSchema).max(30).default([]),
  groupId: objectIdSchema.nullable().optional(),
  notes: z.string().max(2000).optional(),
};

export const createGuestSchema = z.object({
  eventId: objectIdSchema,
  ...contactFields,
  ...invitationFields,
});

export const updateGuestSchema = z
  .object({
    ...contactFields,
    category: z.enum(GUEST_CATEGORIES),
    isVip: z.boolean(),
    allowedCompanions: z.number().int().min(0).max(50),
    invitedSessionIds: z.array(objectIdSchema).max(30),
    groupId: invitationFields.groupId,
    notes: invitationFields.notes,
  })
  .partial();

export const listGuestsQuerySchema = z.object({
  eventId: objectIdSchema.optional(),
  search: z.string().max(100).optional(),
  category: z.enum(GUEST_CATEGORIES).optional(),
  isVip: booleanQuerySchema.optional(),
  rsvpStatus: z.enum(RSVP_STATUSES).optional(),
  checkInStatus: z.enum(CHECKIN_STATUSES).optional(),
  groupId: objectIdSchema.optional(),
});

export const communicationChangeSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type CreateGuestInput = z.infer<typeof createGuestSchema>;
export type UpdateGuestInput = z.infer<typeof updateGuestSchema>;
export type ListGuestsFilters = z.infer<typeof listGuestsQuerySchema>;
