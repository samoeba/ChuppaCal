import EventChip from "@/components/calendar/event-chip";
import {
  type EventWithMember,
  addDays,
  groupEventsByDay,
  isToday,
  startOfWeek,
} from "@/lib/calendar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function WeekView({
  date,
  events,
}: {
  date: Date;
  events: EventWithMember[];
}) {
  const weekStart = startOfWeek(date);
  const buckets = groupEventsByDay(events, weekStart, 7);

  return (
    <div className="grid grid-cols-7 gap-2 min-h-[60vh]">
      {buckets.map((dayEvents, i) => {
        const dayDate = addDays(weekStart, i);
        const today = isToday(dayDate);
        return (
          <div
            key={i}
            className={`flex flex-col rounded-cc-md border p-2 gap-2 ${
              today ? "bg-cc-cream border-cc-ink/20" : "bg-cc-white border-cc-line"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-label text-cc-ink-dim">{WEEKDAYS[i]}</span>
              <span
                className={`text-heading-md ${
                  today
                    ? "inline-flex items-center justify-center w-9 h-9 rounded-full bg-cc-ink text-cc-white text-body-lg"
                    : ""
                }`}
              >
                {dayDate.getDate()}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 overflow-hidden">
              {dayEvents.length === 0 ? (
                <span className="text-caption opacity-40">—</span>
              ) : (
                dayEvents.map((ev) => <EventChip key={ev.id} event={ev} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
