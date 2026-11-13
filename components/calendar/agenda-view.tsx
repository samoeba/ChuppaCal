"use client";
import Link from "next/link";
import { addDays, dayLabel, groupEventsByDay, startOfDay, toDateParam, type EventWithMember } from "@/lib/calendar";
import EventChip from "@/components/calendar/event-chip";

export default function AgendaView({ date, events }: { date: Date; events: EventWithMember[] }) {
  const start = startOfDay(date);
  const buckets = groupEventsByDay(events, start, 5);
  return <div className="space-y-4" aria-label="Five-day agenda">
    {buckets.map((items, index) => {
      const day = addDays(start, index);
      return <section key={toDateParam(day)} className="rounded-2xl bg-white border border-cc-line p-4">
        <h2 className="font-bold mb-3"><Link href={`/calendar?view=day&date=${toDateParam(day)}`}>{dayLabel(day)}</Link></h2>
        {items.length ? <div className="space-y-2">{items.map((event) => <div key={event.id}>
          <EventChip event={event} />
          {(event.member || event.location) && <p className="text-sm text-cc-ink-dim px-2 mt-1">{[event.member?.name, event.location].filter(Boolean).join(" · ")}</p>}
        </div>)}</div> : <p className="text-sm text-cc-ink-dim">Nothing planned.</p>}
      </section>;
    })}
  </div>;
}
