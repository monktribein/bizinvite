import { z } from "zod";
import { objectIdSchema } from "../../common/validators/common";
import { passwordSchema } from "./password";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  password: z.string().min(1, "Password is required").max(128),
  organizationId: objectIdSchema.optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20, "refreshToken is required").max(2048),
});

export const logoutSchema = z.object({
  refreshToken: z.string().max(2048).optional(),
});

export const switchOrganizationSchema = z.object({
  organizationId: objectIdSchema,
});

export const acceptInviteSchema = z.object({
  token: z.string().min(20).max(256),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
