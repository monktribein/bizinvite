import { z } from "zod";
import { GUEST_CATEGORIES, RSVP_STATUSES } from "../../common/constants/enums";
import { isoDateSchema, objectIdSchema, timeOfDaySchema } from "../../common/validators/common";
import { RELATIVE_TO, REMINDER_TYPES, STOP_CONDITIONS, TRIGGER_TYPES } from "./model";

const ruleFields = {
  name: z.string().trim().min(1).max(200),
  reminderType: z.enum(REMINDER_TYPES).default("rsvp_deadline"),
  triggerType: z.enum(TRIGGER_TYPES),
  relativeTo: z.enum(RELATIVE_TO).optional(),
  offsetMinutes: z.number().int().min(-60 * 24 * 90).max(60 * 24 * 90).default(0),
  scheduledAt: isoDateSchema.optional(),
  sessionId: objectIdSchema.optional(),
  targetFilters: z
    .object({
      rsvpStatuses: z.array(z.enum(RSVP_STATUSES)).max(10).optional(),
      guestCategories: z.array(z.enum(GUEST_CATEGORIES)).max(10).optional(),
      onlyVip: z.boolean().optional(),
    })
    .optional(),
  channel: z.literal("whatsapp").default("whatsapp"),
  templateId: objectIdSchema,
  maximumAttempts: z.number().int().min(1).max(10).optional(),
  repeatIntervalMinutes: z.number().int().min(60).max(7 * 24 * 60).optional(),
  quietHours: z
    .object({ enabled: z.boolean(), start: timeOfDaySchema, end: timeOfDaySchema })
    .optional(),
  requiresApproval: z.boolean().default(false),
  fallbackChannel: z.enum(["none", "sms"]).default("none"),
  stopConditions: z.array(z.enum(STOP_CONDITIONS)).max(3).optional(),
  escalationRule: z.object({ enabled: z.boolean(), assignToRMAfterHours: z.number().int().min(1).max(720) }).optional(),
};

function triggerIsComplete(v: { triggerType?: string; scheduledAt?: Date; relativeTo?: string; sessionId?: string }) {
  if (v.triggerType === "scheduled_time") return Boolean(v.scheduledAt);
  if (v.relativeTo === "session_start") return Boolean(v.sessionId);
  return true;
}

export const createRuleSchema = z
  .object({ eventId: objectIdSchema, ...ruleFields })
  .refine(triggerIsComplete, { message: "scheduledAt (scheduled_time) or sessionId (session_start) is required", path: ["triggerType"] });

export const updateRuleSchema = z
  .object({
    ...ruleFields,
    reminderType: z.enum(REMINDER_TYPES),
    offsetMinutes: ruleFields.offsetMinutes.removeDefault(),
    requiresApproval: z.boolean(),
    fallbackChannel: z.enum(["none", "sms"]),
  })
  .partial()
  .omit({ channel: true });

export const listRulesQuerySchema = z.object({ eventId: objectIdSchema.optional() });

export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
