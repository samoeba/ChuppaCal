import { addDays, startOfDay, type EventWithMember } from "@/lib/calendar";
import { timeZoneOf, zonedDate } from "@/lib/time-zone";

export function layoutTimedEvents(events: EventWithMember[], day: Date, startMinute: number, endMinute: number, pixelsPerMinute: number) {
  const midnight = startOfDay(day);
  const nextMidnight = addDays(midnight, 1);
  const minute = (value: string) => {
    const date = zonedDate(value, timeZoneOf(day));
    if (date < midnight) return 0;
    if (date >= nextMidnight) return 1440;
    return date.getHours() * 60 + date.getMinutes();
  };
  const positioned = events.flatMap((event) => {
    const start = minute(event.start_time);
    const end = minute(event.end_time);
    if (event.all_day || end < startMinute || (end === startMinute && end !== start) || start >= endMinute) return [];
    const clippedStart = Math.max(startMinute, start);
    const clippedEnd = Math.min(endMinute, Math.max(end, clippedStart + 20));
    return [{ event, top: (clippedStart - startMinute) * pixelsPerMinute, height: (clippedEnd - clippedStart) * pixelsPerMinute, column: 0, columns: 1 }];
  }).sort((a, b) => a.top - b.top || b.height - a.height || a.event.id.localeCompare(b.event.id));

  let group: typeof positioned = [];
  let columnEnds: number[] = [];
  const finishGroup = () => { for (const item of group) item.columns = columnEnds.length; };
  for (const item of positioned) {
    if (columnEnds.every((end) => end <= item.top)) {
      finishGroup();
      group = [];
      columnEnds = [];
    }
    let column = columnEnds.findIndex((end) => end <= item.top);
    if (column === -1) column = columnEnds.length;
    item.column = column;
    columnEnds[column] = item.top + item.height;
    group.push(item);
  }
  finishGroup();
  return positioned;
}
