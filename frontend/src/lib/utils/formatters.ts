export function formatDate(dateStr: string | Date | undefined, includeTime = true): string {
  if (!dateStr) return "-";
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", hour12: true } : {}),
  }).format(date);
}

export function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null) return "0";
  return new Intl.NumberFormat("en-IN").format(num);
}

export function formatPercentage(value: number, total: number): string {
  if (!total || total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

export function formatPhone(phone: string): string {
  if (!phone) return "-";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  return phone;
}
