import { Types } from "mongoose";
import { z } from "zod";
import { Errors } from "../errors/app-error";

export const objectIdSchema = z
  .string()
  .trim()
  .refine((v) => Types.ObjectId.isValid(v) && /^[a-f\d]{24}$/i.test(v), "Invalid id");

export const isoDateSchema = z.coerce.date({ invalid_type_error: "Invalid date" });

/** Accepts "true"/"false" query strings as well as booleans. */
export const booleanQuerySchema = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((v) => v === true || v === "true");

/**
 * The current frontend never sends page/limit and paginates client-side, so the
 * default page is large. Clients that need smaller pages pass `limit` explicitly.
 */
export const DEFAULT_PAGE_LIMIT = 500;
export const MAX_PAGE_LIMIT = 1000;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});

export type Pagination = z.infer<typeof paginationSchema>;

/** Validates a route id; malformed ids are reported as "not found" rather than leaking cast errors. */
export function parseId(value: unknown, entity = "Resource"): string {
  const result = objectIdSchema.safeParse(value);
  if (!result.success) throw Errors.notFound(entity);
  return result.data;
}

export const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");
