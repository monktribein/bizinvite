import { z } from "zod";
import { passwordSchema } from "../auth/password";
import { ORGANIZATION_PLANS } from "./model";

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,60}$/, "Use lowercase letters, numbers and dashes")
    .optional(),
  plan: z.enum(ORGANIZATION_PLANS).default("starter"),
  timezone: z.string().max(60).optional(),
  owner: z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().toLowerCase().email().max(254),
    password: passwordSchema.optional(),
  }),
});

export const updateOrganizationSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    logoUrl: z.string().url().max(1000).optional(),
    timezone: z.string().max(60).optional(),
    defaultCountryCode: z.string().regex(/^\d{1,4}$/).optional(),
    whatsApp: z
      .object({
        phoneNumberId: z.string().max(64).optional(),
        phoneNumber: z.string().max(32).optional(),
        wabaId: z.string().max(64).optional(),
        businessDisplayName: z.string().max(120).optional(),
      })
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");

export const auditQuerySchema = z.object({
  resourceType: z.string().max(40).optional(),
  action: z.string().max(80).optional(),
});
