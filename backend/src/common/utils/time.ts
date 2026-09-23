const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/** Parses "15m", "30d", "3600" into seconds. */
export function durationToSeconds(value: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration: ${value}`);
  return Number(match[1]) * UNIT_SECONDS[match[2] ?? "s"];
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** Offset of the zone from UTC at the given instant, in minutes. */
function zoneOffsetMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - Math.floor(date.getTime() / 60000) * 60000) / 60000);
}

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** "HH:MM" in the given zone. */
export function localHourMinute(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** True when `date` falls inside [start, end) local time; handles windows crossing midnight (21:00–09:00). */
export function isWithinQuietHours(date: Date, timeZone: string, start: string, end: string): boolean {
  const now = minutesOfDay(localHourMinute(date, timeZone));
  const s = minutesOfDay(start);
  const e = minutesOfDay(end);
  if (s === e) return false;
  return s < e ? now >= s && now < e : now >= s || now < e;
}

/** The next instant (after `date`) at which local time equals `end`. */
export function nextLocalTime(date: Date, timeZone: string, hhmm: string): Date {
  const p = zonedParts(date, timeZone);
  const offset = zoneOffsetMinutes(date, timeZone);
  const [h, m] = hhmm.split(":").map(Number);
  let candidate = Date.UTC(p.year, p.month - 1, p.day, h, m) - offset * 60000;
  if (candidate <= date.getTime()) candidate += 24 * 3600 * 1000;
  return new Date(candidate);
}

/** Hour bucket label ("18:00") in the given zone. */
export function localHourLabel(date: Date, timeZone: string): string {
  return `${String(zonedParts(date, timeZone).hour).padStart(2, "0")}:00`;
}

export function currentPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
