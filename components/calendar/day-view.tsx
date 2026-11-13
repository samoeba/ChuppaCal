"use client";

import { useState } from "react";
import EventChip from "@/components/calendar/event-chip";
import EventDetailPopover from "@/components/calendar/event-detail-popover";
import type { EventWithMember } from "@/lib/calendar";
import { groupEventsByDay, startOfDay } from "@/lib/calendar";
import { timeZoneOf, zonedDate } from "@/lib/time-zone";

export default function DayView({
  date,
  events,
}: {
  date: Date;
  events: EventWithMember[];
}) {
  const [selected, setSelected] = useState<{ event: EventWithMember; rect: DOMRect } | null>(null);
  const dayEvents = groupEventsByDay(events, startOfDay(date), 1)[0];
  const allDay = dayEvents.filter((ev) => ev.all_day);
  const timed = dayEvents.filter((ev) => !ev.all_day);

  const byHour = new Map<number, EventWithMember[]>();
  for (const ev of timed) {
    const start = zonedDate(ev.start_time, timeZoneOf(date));
    const h = start < startOfDay(date) ? 0 : start.getHours();
    const bucket = byHour.get(h) ?? [];
    bucket.push(ev);
    byHour.set(h, bucket);
  }
  const firstHour = Math.min(6, ...byHour.keys());
  const hours = Array.from({ length: 24 - firstHour }, (_, i) => i + firstHour);
  function chip(event: EventWithMember, showTime = true) {
    return <button key={event.id} onClick={(e) => setSelected({ event, rect: e.currentTarget.getBoundingClientRect() })} aria-label={`Open details for ${event.title}`} className="text-left min-h-11"><EventChip event={event} showTime={showTime} /></button>;
  }

  return (
    <div className="rounded-cc-md bg-cc-white border border-cc-line overflow-hidden">
      {allDay.length > 0 && (
        <div className="p-3 border-b border-cc-line bg-cc-cream flex flex-wrap gap-2">
          {allDay.map((ev) => (
            <div key={ev.id} className="min-w-[160px]">
              {chip(ev, false)}
            </div>
          ))}
        </div>
      )}
      <div className="divide-y divide-cc-line">
        {hours.map((h) => {
          const slot = byHour.get(h) ?? [];
          const hourLabel = `${h % 12 || 12}${h >= 12 ? "p" : "a"}`;
          return (
            <div key={h} className="flex min-h-[64px]">
              <div className="w-20 py-2 pl-4 text-caption flex-shrink-0">{hourLabel}</div>
              <div className="flex-1 py-2 pr-4 flex flex-col gap-1.5">
                {slot.map((ev) => chip(ev))}
              </div>
            </div>
          );
        })}
      </div>
      {selected && <EventDetailPopover event={selected.event} anchorRect={selected.rect} onClose={() => setSelected(null)} />}
    </div>
  );
}
