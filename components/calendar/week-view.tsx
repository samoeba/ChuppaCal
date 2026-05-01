"use client";

import { useState } from "react";
import CurrentTimeIndicator from "@/components/calendar/current-time-indicator";
import EventChip from "@/components/calendar/event-chip";
import EventDetailPopover from "@/components/calendar/event-detail-popover";
import {
  END_MIN,
  HOUR_MARKS,
  MIN_PX,
  START_MIN,
  TOTAL_HEIGHT,
  VIEWPORT_HEIGHT,
} from "@/components/calendar/time-grid-constants";
import {
  type EventWithMember,
  WEEK_VIEW_DAYS,
  addDays,
  groupEventsByDay,
  isToday,
  startOfDay,
} from "@/lib/calendar";

// NOTE: Tailwind JIT can't evaluate template literals. If WEEK_VIEW_DAYS changes,
// this hard-coded class must be updated to match.
const GRID_COLS = "grid-cols-[3.5rem_repeat(5,minmax(0,1fr))]";

function hourLabel(h: number): string {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h12}${suffix}`;
}

function timedEventPosition(
  ev: EventWithMember,
  day: Date
): { top: number; height: number } | null {
  const start = new Date(ev.start_time);
  const end = ev.end_time
    ? new Date(ev.end_time)
    : new Date(start.getTime() + 30 * 60 * 1000);

  const dayMidnight = new Date(day);
  dayMidnight.setHours(0, 0, 0, 0);
  const dayStart = new Date(dayMidnight.getTime() + START_MIN * 60_000);
  const dayEnd = new Date(dayMidnight.getTime() + END_MIN * 60_000);

  if (end <= dayStart || start >= dayEnd) return null;

  const s = start < dayStart ? dayStart : start;
  const e = end > dayEnd ? dayEnd : end;

  const startOffsetMin = (s.getTime() - dayStart.getTime()) / 60_000;
  const durationMin = Math.max(20, (e.getTime() - s.getTime()) / 60_000);

  return {
    top: startOffsetMin * MIN_PX,
    height: durationMin * MIN_PX,
  };
}

export default function WeekView({
  date,
  events,
}: {
  date: Date;
  events: EventWithMember[];
}) {
  const weekStart = startOfDay(date);
  const buckets = groupEventsByDay(events, weekStart, WEEK_VIEW_DAYS);
  const days = Array.from({ length: WEEK_VIEW_DAYS }, (_, i) => addDays(weekStart, i));

  const allDayByDay = buckets.map((b) => b.filter((ev) => ev.all_day));
  const timedByDay = buckets.map((b) => b.filter((ev) => !ev.all_day));
  const hasAnyAllDay = allDayByDay.some((d) => d.length > 0);

  const [selected, setSelected] = useState<{
    event: EventWithMember;
    rect: DOMRect;
  } | null>(null);

  function handleSelect(event: EventWithMember, target: HTMLElement) {
    setSelected({ event, rect: target.getBoundingClientRect() });
  }

  return (
    <div className="rounded-cc-md bg-cc-white border border-cc-line overflow-hidden">
      {/* Day headers */}
      <div className={`grid ${GRID_COLS} border-b border-cc-line`}>
        <div />
        {days.map((dayDate, i) => {
          const today = isToday(dayDate);
          return (
            <div
              key={i}
              className={`flex items-baseline justify-between px-3 py-2 border-l border-cc-line ${
                today ? "bg-cc-cream" : ""
              }`}
            >
              <span className="text-label text-cc-ink-dim">
                {dayDate.toLocaleString("en-US", { weekday: "short" })}
              </span>
              <span
                className={
                  today
                    ? "inline-flex items-center justify-center w-9 h-9 rounded-full bg-cc-ink text-cc-white text-body-lg"
                    : "text-heading-md"
                }
              >
                {dayDate.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* All-day strip (only when present) */}
      {hasAnyAllDay && (
        <div className={`grid ${GRID_COLS} border-b border-cc-line bg-cc-cream/60`}>
          <div className="flex flex-col items-end justify-center pr-2 py-2 text-label text-cc-ink-dim leading-tight">
            <span>All</span>
            <span>day</span>
          </div>
          {allDayByDay.map((dayEvents, i) => (
            <div
              key={i}
              className="flex flex-col gap-1 p-1.5 border-l border-cc-line min-h-[2.5rem]"
            >
              {dayEvents.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={(e) => handleSelect(ev, e.currentTarget)}
                  className="text-left active:scale-[0.98] transition-transform"
                  aria-label={`Open details for ${ev.title}`}
                >
                  <EventChip event={ev} showTime={false} />
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Time grid — caps visible window at 6 hours, scroll for the rest */}
      <div className="overflow-y-auto" style={{ maxHeight: VIEWPORT_HEIGHT }}>
        <div className="relative" style={{ height: TOTAL_HEIGHT }}>
          <div className={`grid ${GRID_COLS}`} style={{ height: TOTAL_HEIGHT }}>
            {/* Time rail */}
            <div className="relative">
              {HOUR_MARKS.map(({ hour, offsetMin }) => (
                <div
                  key={hour}
                  className="absolute right-2 text-label text-cc-ink-dim"
                  style={{
                    top: offsetMin * MIN_PX,
                    transform: "translateY(2px)",
                  }}
                >
                  {hourLabel(hour)}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((dayDate, di) => {
              const today = isToday(dayDate);
              return (
                <div
                  key={di}
                  className={`relative border-l border-cc-line ${
                    today ? "bg-cc-cream/30" : ""
                  }`}
                >
                  {/* Hourly gridlines at exact label positions */}
                  {HOUR_MARKS.map(({ hour, offsetMin }) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-cc-line/60"
                      style={{ top: offsetMin * MIN_PX }}
                    />
                  ))}

                  {/* Positioned events */}
                  {timedByDay[di].map((ev) => {
                    const pos = timedEventPosition(ev, dayDate);
                    if (!pos) return null;
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={(e) => handleSelect(ev, e.currentTarget)}
                        className="absolute left-1 right-1 text-left active:scale-[0.98] transition-transform"
                        style={{ top: pos.top, height: pos.height }}
                        aria-label={`Open details for ${ev.title}`}
                      >
                        <EventChip event={ev} />
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <CurrentTimeIndicator
            rangeStartISO={weekStart.toISOString()}
            rangeDays={WEEK_VIEW_DAYS}
          />
        </div>
      </div>

      {selected && (
        <EventDetailPopover
          event={selected.event}
          anchorRect={selected.rect}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
