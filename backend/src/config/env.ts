import dotenv from "dotenv";
import { z } from "zod";

if (process.env.NODE_ENV !== "test") {
  dotenv.config();
}

export const REQUIRED_DB_NAME = "bizinvite_db";

/**
 * Extracts the database name from a MongoDB connection string
 * (the path segment between the host list and the query string).
 */
export function extractDbName(uri: string): string | null {
  const withoutScheme = uri.replace(/^mongodb(\+srv)?:\/\//, "");
  const slashIndex = withoutScheme.indexOf("/");
  if (slashIndex === -1) return null;
  const path = withoutScheme.slice(slashIndex + 1).split("?")[0];
  return path ? decodeURIComponent(path) : null;
}

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    API_PREFIX: z.string().default("/api/v1"),

    MONGODB_URI: z
      .string({ required_error: "MONGODB_URI is required" })
      .min(1, "MONGODB_URI is required")
      .refine((v) => /^mongodb(\+srv)?:\/\//.test(v), "MONGODB_URI must be a mongodb:// or mongodb+srv:// URI")
      .refine((v) => {
        const db = extractDbName(v);
        return db === null || db === REQUIRED_DB_NAME;
      }, `MONGODB_URI must target the ${REQUIRED_DB_NAME} database`),

    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

    /** Run the MongoDB-backed job scheduler in this process (default). "false" for API-only instances. */
    SCHEDULER_ENABLED: z
      .enum(["true", "false"], { message: 'SCHEDULER_ENABLED must be "true" or "false"' })
      .default("true")
      .transform((v) => v === "true"),

    CORS_ORIGIN: z.string().default("http://localhost:3000"),

    WHATSAPP_API_VERSION: z.string().default("v21.0"),
    WHATSAPP_ACCESS_TOKEN: optionalString,
    WHATSAPP_PHONE_NUMBER_ID: optionalString,
    WHATSAPP_BUSINESS_ACCOUNT_ID: optionalString,
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: optionalString,
    WHATSAPP_APP_SECRET: optionalString,

    S3_ENDPOINT: optionalString,
    S3_REGION: z.string().default("ap-south-1"),
    S3_BUCKET: optionalString,
    S3_ACCESS_KEY: optionalString,
    S3_SECRET_KEY: optionalString,

    QR_SIGNING_SECRET: z.string().min(32, "QR_SIGNING_SECRET must be at least 32 characters"),

    /** Public URL of this API, used for links sent to guests (pass QR images). Optional. */
    PUBLIC_BASE_URL: optionalString,

    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  })
  .superRefine((env, ctx) => {
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({ code: "custom", path: ["JWT_REFRESH_SECRET"], message: "Must differ from JWT_ACCESS_SECRET" });
    }
    if (env.NODE_ENV === "production" && process.env.REQUIRE_WHATSAPP === "true") {
      for (const key of [
        "WHATSAPP_ACCESS_TOKEN",
        "WHATSAPP_PHONE_NUMBER_ID",
        "WHATSAPP_BUSINESS_ACCOUNT_ID",
        "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
        "WHATSAPP_APP_SECRET",
      ] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required when REQUIRE_WHATSAPP=true` });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "env"}: ${i.message}`).join("\n");
    // The logger depends on env, so report directly and stop before anything else starts.
    process.stderr.write(`Invalid BizInvite environment configuration:\n${problems}\n`);
    process.exit(1);
  }
  return parsed.data;
}

export const env: Env = loadEnv();

export const corsOrigins = env.CORS_ORIGIN.split(",")
  .map((o) => o.trim())
  .filter(Boolean);
