export const INVALID_MOBILE_MESSAGE = "Invalid phone number format. Must contain 10-12 digits.";

export type MobileResult = { valid: true; e164: string } | { valid: false; error: string };

/**
 * Normalizes a phone number to E.164 (e.g. +919811099887).
 * National 10-digit numbers get the organization's default country code.
 */
export function normalizeMobile(input: string | undefined | null, defaultCountryCode = "91"): MobileResult {
  if (!input) return { valid: false, error: "Mobile number is required" };
  let value = String(input).trim().replace(/[\s\-().]/g, "");
  if (value.startsWith("00")) value = `+${value.slice(2)}`;

  if (value.startsWith("+")) {
    const digits = value.slice(1);
    if (!/^\d{8,15}$/.test(digits) || digits.startsWith("0")) return { valid: false, error: INVALID_MOBILE_MESSAGE };
    return { valid: true, e164: `+${digits}` };
  }

  if (!/^\d+$/.test(value)) return { valid: false, error: INVALID_MOBILE_MESSAGE };
  if (value.length === 11 && value.startsWith("0")) value = value.slice(1);
  if (value.length === 10) return { valid: true, e164: `+${defaultCountryCode}${value}` };
  if (value.length === 12 && value.startsWith(defaultCountryCode)) return { valid: true, e164: `+${value}` };
  return { valid: false, error: INVALID_MOBILE_MESSAGE };
}

/** Cloud API `to`/`from` values are digits without the leading "+". */
export function toWhatsAppNumber(e164: string): string {
  return e164.replace(/^\+/, "");
}

export function fromWhatsAppNumber(waId: string): string {
  return waId.startsWith("+") ? waId : `+${waId}`;
}
