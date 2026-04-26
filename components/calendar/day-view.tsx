import EventChip from "@/components/calendar/event-chip";
import type { EventWithMember } from "@/lib/calendar";
import { formatTime, sameDay } from "@/lib/calendar";

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6a – 11p

export default function DayView({
  date,
  events,
}: {
  date: Date;
  events: EventWithMember[];
}) {
  const dayEvents = events.filter((ev) => sameDay(new Date(ev.start_time), date));
  const allDay = dayEvents.filter((ev) => ev.all_day);
  const timed = dayEvents.filter((ev) => !ev.all_day);

  const byHour = new Map<number, EventWithMember[]>();
  for (const ev of timed) {
    const h = new Date(ev.start_time).getHours();
    const bucket = byHour.get(h) ?? [];
    bucket.push(ev);
    byHour.set(h, bucket);
  }

  return (
    <div className="rounded-cc-md bg-cc-white border border-cc-line overflow-hidden">
      {allDay.length > 0 && (
        <div className="p-3 border-b border-cc-line bg-cc-cream flex flex-wrap gap-2">
          {allDay.map((ev) => (
            <div key={ev.id} className="min-w-[160px]">
              <EventChip event={ev} showTime={false} />
            </div>
          ))}
        </div>
      )}
      <div className="divide-y divide-cc-line">
        {HOURS.map((h) => {
          const slot = byHour.get(h) ?? [];
          const hourLabel = formatTime(new Date(2000, 0, 1, h, 0));
          return (
            <div key={h} className="flex min-h-[64px]">
              <div className="w-20 py-2 pl-4 text-caption flex-shrink-0">{hourLabel}</div>
              <div className="flex-1 py-2 pr-4 flex flex-col gap-1.5">
                {slot.map((ev) => (
                  <EventChip key={ev.id} event={ev} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
