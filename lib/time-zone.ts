import { TZDate } from "@date-fns/tz";

export const DEFAULT_TIME_ZONE = "America/Chicago";

export function familyTimeZone(value?: string | null): string {
  if (value) {
    try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return value; } catch { /* legacy invalid setting */ }
  }
  return DEFAULT_TIME_ZONE;
}

export function timeZoneOf(date: Date): string {
  return date instanceof TZDate ? familyTimeZone(date.timeZone) : DEFAULT_TIME_ZONE;
}

export function zonedDate(value: Date | string | number = Date.now(), zone = value instanceof Date ? timeZoneOf(value) : DEFAULT_TIME_ZONE): TZDate {
  const stamp = value instanceof Date ? value.getTime() : typeof value === "string" ? new Date(value).getTime() : value;
  return new TZDate(stamp, familyTimeZone(zone));
}

/** A civil date is not an instant. Construct it in the chosen zone, including UTC±14. */
export function civilDate(value: string, zone = DEFAULT_TIME_ZONE): TZDate {
  const [year, month, day] = value.split("-").map(Number);
  return new TZDate(year, month - 1, day, 12, 0, 0, 0, familyTimeZone(zone));
}
