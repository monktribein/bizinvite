import { z } from "zod";
import { ORGANIZATION_ROLES } from "../../common/constants/roles";

export const inviteUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  role: z.enum(ORGANIZATION_ROLES as [string, ...string[]]),
});

export const updateMemberSchema = z
  .object({
    role: z.enum(ORGANIZATION_ROLES as [string, ...string[]]).optional(),
    status: z.enum(["active", "suspended"]).optional(),
    name: z.string().trim().min(1).max(120).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");
