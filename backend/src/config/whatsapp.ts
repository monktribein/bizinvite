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

/** True when real Cloud API calls are made (live). The sender number may come from the organization. */
export function isWhatsAppConfigured(): boolean {
  return Boolean(whatsappConfig.accessToken);
}

/**
 * When WhatsApp credentials are not configured, falls back to a log-only
 * dry-run sender so the campaign/reminder pipeline works smoothly.
 */
export function isWhatsAppDryRun(): boolean {
  return !isWhatsAppConfigured();
}

/** Logged at startup: WhatsApp states that work but lose data or safety. */
export function whatsappStartupWarnings(): string[] {
  if (isWhatsAppDryRun()) return ["WhatsApp is not configured: messages are logged, not sent (dry-run)"];
  const warnings: string[] = [];
  if (!whatsappConfig.appSecret) warnings.push("WHATSAPP_APP_SECRET is not set: webhooks are accepted without signature verification (never allowed in production)");
  if (!whatsappConfig.webhookVerifyToken) warnings.push("WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set: Meta cannot subscribe to delivery and reply webhooks");
  return warnings;
}
