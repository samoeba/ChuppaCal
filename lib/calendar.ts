import type { CalendarEvent, FamilyMember } from "@/lib/types";
import { isDateString } from "@/lib/validation";
import { civilDate, DEFAULT_TIME_ZONE, timeZoneOf, zonedDate } from "@/lib/time-zone";

export type CalendarView = "day" | "week" | "month";

// Week view shows the anchor day + the next N-1 days (today on the far left).
export const WEEK_VIEW_DAYS = 5;

export function parseView(raw: string | undefined): CalendarView {
  return raw === "day" || raw === "month" ? raw : "week";
}

export function parseDate(raw: string | undefined, timeZone = DEFAULT_TIME_ZONE): Date {
  return isDateString(raw) ? civilDate(raw, timeZone) : zonedDate(Date.now(), timeZone);
}

export function toDateParam(value: Date, timeZone = timeZoneOf(value)): string {
  const d = zonedDate(value, timeZone);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfDay(d: Date): Date {
  const r = zonedDate(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function addDays(d: Date, n: number): Date {
  const r = zonedDate(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Week starts on Sunday (US convention — matches the spec's weather + family context).
export function startOfWeek(d: Date): Date {
  const r = startOfDay(d);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

export function endOfWeek(d: Date): Date {
  return addDays(startOfWeek(d), 7);
}

export function startOfMonthGrid(d: Date): Date {
  const first = zonedDate(d);
  first.setDate(1);
  return startOfWeek(first);
}

export function endOfMonthGrid(d: Date): Date {
  const last = zonedDate(d);
  last.setMonth(last.getMonth() + 1, 0);
  return addDays(endOfWeek(last), 0);
}

export function rangeForView(view: CalendarView, d: Date): { start: Date; end: Date } {
  if (view === "day") return { start: startOfDay(d), end: addDays(startOfDay(d), 1) };
  if (view === "month") return { start: startOfMonthGrid(d), end: endOfMonthGrid(d) };
  const start = startOfDay(d);
  return { start, end: addDays(start, WEEK_VIEW_DAYS) };
}

export function sameDay(a: Date, b: Date): boolean {
  return toDateParam(a) === toDateParam(b, timeZoneOf(a));
}

export function isToday(d: Date): boolean {
  return sameDay(d, new Date());
}

export function formatTime(value: Date): string {
  const d = zonedDate(value);
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? "p" : "a";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

export function formatTimeLong(value: Date): string {
  const d = zonedDate(value);
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export type EventWithMember = CalendarEvent & { member: FamilyMember | null };

export function groupEventsByDay(
  events: EventWithMember[],
  start: Date,
  dayCount: number
): EventWithMember[][] {
  const buckets: EventWithMember[][] = Array.from({ length: dayCount }, () => []);
  for (const ev of events) {
    for (let i = 0; i < dayCount; i++) {
      if (eventOccursOnDay(ev, addDays(start, i))) buckets[i].push(ev);
    }
  }
  for (const bucket of buckets) {
    bucket.sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
  }
  return buckets;
}

export function eventOccursOnDay(event: EventWithMember, day: Date): boolean {
  if (event.all_day) {
    const date = toDateParam(day);
    // Google all-day end dates are exclusive; never convert civil dates to local time.
    return event.start_time.slice(0, 10) <= date && date < event.end_time.slice(0, 10);
  }
  const start = +new Date(event.start_time);
  const end = +new Date(event.end_time);
  const dayStart = +startOfDay(day);
  const dayEnd = +addDays(startOfDay(day), 1);
  return start < dayEnd && (end > dayStart || (start === end && start >= dayStart));
}

export function monthLabel(d: Date): string {
  return zonedDate(d).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function weekRangeLabel(d: Date): string {
  const start = startOfDay(d);
  const end = addDays(start, WEEK_VIEW_DAYS - 1);
  const sameMonth = start.getMonth() === end.getMonth();
  const startStr = start.toLocaleString("en-US", { month: "short", day: "numeric" });
  const endStr = sameMonth
    ? end.toLocaleString("en-US", { day: "numeric" })
    : end.toLocaleString("en-US", { month: "short", day: "numeric" });
  return `${startStr} – ${endStr}, ${end.getFullYear()}`;
}

export function dayLabel(d: Date): string {
  return zonedDate(d).toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export function shiftForView(view: CalendarView, d: Date, delta: number): Date {
  if (view === "day") return addDays(d, delta);
  if (view === "month") {
    const r = zonedDate(d);
    const day = r.getDate();
    r.setDate(1);
    r.setMonth(r.getMonth() + delta);
    const last = zonedDate(r);
    last.setMonth(last.getMonth() + 1, 0);
    r.setDate(Math.min(day, last.getDate()));
    return r;
  }
  return addDays(d, delta * WEEK_VIEW_DAYS);
}
