import Link from "next/link";
import {
  type EventWithMember,
  addDays,
  endOfMonthGrid,
  isToday,
  sameDay,
  startOfMonthGrid,
  toDateParam,
} from "@/lib/calendar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FALLBACK_COLOR = "#4ecdc4";
const MAX_DOTS_PER_DAY = 5;

export default function MonthView({
  date,
  events,
}: {
  date: Date;
  events: EventWithMember[];
}) {
  const gridStart = startOfMonthGrid(date);
  const gridEnd = endOfMonthGrid(date);
  const dayCount = Math.round((gridEnd.getTime() - gridStart.getTime()) / (24 * 3600 * 1000));
  const currentMonth = date.getMonth();

  // Group events per ISO date string for O(1) lookup.
  const byDate = new Map<string, EventWithMember[]>();
  for (const ev of events) {
    const key = toDateParam(new Date(ev.start_time));
    const bucket = byDate.get(key) ?? [];
    bucket.push(ev);
    byDate.set(key, bucket);
  }

  const days = Array.from({ length: dayCount }, (_, i) => addDays(gridStart, i));

  return (
    <div className="rounded-cc-md bg-cc-white border border-cc-line overflow-hidden">
      <div className="grid grid-cols-7 border-b border-cc-line">
        {WEEKDAYS.map((w) => (
          <div key={w} className="p-2 text-label text-cc-ink-dim text-center">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === currentMonth;
          const today = isToday(d);
          const dayEvents = byDate.get(toDateParam(d)) ?? [];
          const dots = dayEvents.slice(0, MAX_DOTS_PER_DAY);
          const extra = dayEvents.length - dots.length;
          return (
            <Link
              key={i}
              href={`/calendar?view=day&date=${toDateParam(d)}`}
              scroll={false}
              className={`min-h-[88px] border-r border-b border-cc-line p-2 flex flex-col gap-1 active:bg-cc-beige ${
                inMonth ? "" : "bg-cc-beige/40 opacity-60"
              } ${(i + 1) % 7 === 0 ? "border-r-0" : ""}`}
            >
              <div
                className={`text-body self-start ${
                  today
                    ? "inline-flex items-center justify-center w-7 h-7 rounded-full bg-cc-ink text-cc-white"
                    : ""
                }`}
              >
                {d.getDate()}
              </div>
              <div className="flex flex-wrap gap-1 mt-auto">
                {dots.map((ev) => (
                  <span
                    key={ev.id}
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: ev.member?.color ?? FALLBACK_COLOR }}
                    aria-hidden
                  />
                ))}
                {extra > 0 && (
                  <span className="text-caption opacity-60">+{extra}</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
