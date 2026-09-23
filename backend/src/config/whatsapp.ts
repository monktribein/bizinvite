import { env } from "./env";

export const whatsappConfig = {
  apiVersion: env.WHATSAPP_API_VERSION,
  graphBaseUrl: "https://graph.facebook.com",
  accessToken: env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
  businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  webhookVerifyToken: env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  appSecret: env.WHATSAPP_APP_SECRET,
};

/** True when real Cloud API calls can be made. */
export function isWhatsAppConfigured(): boolean {
  return Boolean(whatsappConfig.accessToken && whatsappConfig.phoneNumberId);
}

/**
 * Outside production, an unconfigured WhatsApp integration falls back to a log-only
 * dry-run sender so the campaign/reminder pipeline can be exercised locally.
 * Production startup requires the WhatsApp variables (see env.ts).
 */
export function isWhatsAppDryRun(): boolean {
  return !isWhatsAppConfigured() && env.NODE_ENV !== "production";
}
