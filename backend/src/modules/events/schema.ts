import { z } from "zod";
import { EVENT_STATUSES } from "../../common/constants/enums";
import { isoDateSchema, objectIdSchema } from "../../common/validators/common";
import { embeddedSessionSchema } from "../sessions/schema";

const venueSchema = z.object({
  name: z.string().trim().min(1, "Venue name is required").max(200),
  address: z.string().max(500).default(""),
  city: z.string().max(200).default(""),
  googleMapsUrl: z.string().url().max(1000).optional(),
  gateNotes: z.string().max(1000).optional(),
});

const checkInConfigSchema = z.object({
  allowMultipleEntries: z.boolean().default(true),
  requirePassVerification: z.boolean().default(true),
  activeGates: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
});

const rsvpConfigSchema = z
  .object({
    collectCompanionCount: z.boolean(),
    collectSessionSelection: z.boolean(),
    collectDietary: z.boolean(),
    collectAccommodation: z.boolean(),
    collectTransport: z.boolean(),
    collectArrivalDetails: z.boolean(),
    collectSpecialRequests: z.boolean(),
  })
  .partial();

const reminderConfigSchema = z
  .object({
    enabled: z.boolean(),
    defaultMaximumAttempts: z.number().int().min(1).max(10),
    repeatIntervalMinutes: z.number().int().min(60).max(7 * 24 * 60),
  })
  .partial();

const baseEventFields = {
  name: z.string().trim().min(1, "Event name is required").max(200),
  category: z.string().trim().min(1).max(100).default("other"),
  status: z.enum(EVENT_STATUSES).default("draft"),
  description: z.string().max(5000).optional(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  rsvpDeadline: isoDateSchema,
  timezone: z.string().max(60).optional(),
  venue: venueSchema,
  hosts: z
    .array(z.object({ name: z.string().max(200), relationship: z.string().max(100).default(""), phone: z.string().max(32).optional() }))
    .max(20)
    .default([]),
  contactPersons: z
    .array(z.object({ name: z.string().max(200), role: z.string().max(100).default(""), phone: z.string().max(32).default("") }))
    .max(20)
    .default([]),
  languages: z.array(z.string().max(40)).max(20).default([]),
  dressCode: z.string().max(200).optional(),
  accommodationInfo: z.string().max(2000).optional(),
  transportInfo: z.string().max(2000).optional(),
  faqs: z.array(z.object({ question: z.string().max(500), answer: z.string().max(2000) })).max(50).default([]),
  checkInConfig: checkInConfigSchema.default({}),
  rsvpConfig: rsvpConfigSchema.optional(),
  reminderConfig: reminderConfigSchema.optional(),
  communication: z.object({ passTemplateId: objectIdSchema.nullable().optional() }).optional(),
};

function datesAreConsistent(v: { startDate?: Date; endDate?: Date; rsvpDeadline?: Date }) {
  if (v.startDate && v.endDate && v.endDate < v.startDate) return false;
  return true;
}

export const createEventSchema = z
  .object({ ...baseEventFields, sessions: z.array(embeddedSessionSchema).max(30).default([]) })
  .refine(datesAreConsistent, { message: "endDate must be on or after startDate", path: ["endDate"] })
  .refine((v) => v.rsvpDeadline <= v.endDate, { message: "rsvpDeadline must be before the event ends", path: ["rsvpDeadline"] });

/** PATCH accepts any subset; sessions are managed through /sessions and ignored here. */
export const updateEventSchema = z
  .object({
    ...baseEventFields,
    category: z.string().trim().min(1).max(100),
    status: z.enum(EVENT_STATUSES),
    hosts: baseEventFields.hosts.removeDefault(),
    contactPersons: baseEventFields.contactPersons.removeDefault(),
    languages: baseEventFields.languages.removeDefault(),
    faqs: baseEventFields.faqs.removeDefault(),
    checkInConfig: checkInConfigSchema.partial(),
  })
  .partial()
  .refine(datesAreConsistent, { message: "endDate must be on or after startDate", path: ["endDate"] });

export const listEventsQuerySchema = z.object({
  search: z.string().max(100).optional(),
  status: z.enum(EVENT_STATUSES).optional(),
  category: z.string().trim().max(100).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
