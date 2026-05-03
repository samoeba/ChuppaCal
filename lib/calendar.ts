import type { CalendarEvent, FamilyMember } from "@/lib/types";

export type CalendarView = "day" | "week" | "month";

// Week view shows the anchor day + the next N-1 days (today on the far left).
export const WEEK_VIEW_DAYS = 5;

export function parseView(raw: string | undefined): CalendarView {
  return raw === "day" || raw === "month" ? raw : "week";
}

// Anchor parsed YYYY-MM-DD at noon UTC so the date "name" is stable in any
// timezone between UTC-12 and UTC+11. Without this, server (UTC) and client
// (e.g. PDT) round-trip the URL ?date param asymmetrically and the week-view
// arrows shift by 4 days forward / 6 days backward instead of 5/5.
export function parseDate(raw: string | undefined): Date {
  if (raw) {
    const d = new Date(raw + "T12:00:00Z");
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function toDateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
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
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  return startOfWeek(first);
}

export function endOfMonthGrid(d: Date): Date {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return addDays(endOfWeek(last), 0);
}

export function rangeForView(view: CalendarView, d: Date): { start: Date; end: Date } {
  if (view === "day") return { start: startOfDay(d), end: addDays(startOfDay(d), 1) };
  if (view === "month") return { start: startOfMonthGrid(d), end: endOfMonthGrid(d) };
  const start = startOfDay(d);
  return { start, end: addDays(start, WEEK_VIEW_DAYS) };
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(d: Date): boolean {
  return sameDay(d, new Date());
}

export function formatTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? "p" : "a";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

export function formatTimeLong(d: Date): string {
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
    const evStart = new Date(ev.start_time);
    const diff = Math.floor(
      (startOfDay(evStart).getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
    );
    if (diff >= 0 && diff < dayCount) buckets[diff].push(ev);
  }
  for (const bucket of buckets) {
    bucket.sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
  }
  return buckets;
}

export function monthLabel(d: Date): string {
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
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
  return d.toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export function shiftForView(view: CalendarView, d: Date, delta: number): Date {
  if (view === "day") return addDays(d, delta);
  if (view === "month") {
    const r = new Date(d);
    r.setMonth(r.getMonth() + delta);
    return r;
  }
  return addDays(d, delta * WEEK_VIEW_DAYS);
}
