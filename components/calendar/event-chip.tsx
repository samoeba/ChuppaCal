import type { EventWithMember } from "@/lib/calendar";
import { formatTime } from "@/lib/calendar";

const FALLBACK_COLOR = "#4ecdc4";

export default function EventChip({
  event,
  showTime = true,
}: {
  event: EventWithMember;
  showTime?: boolean;
}) {
  const color = event.member?.color ?? FALLBACK_COLOR;
  const label = event.all_day
    ? "All day"
    : showTime
    ? formatTime(new Date(event.start_time))
    : null;

  return (
    <div
      className="px-2 py-1.5 rounded-cc-sm text-body-sm leading-tight"
      style={{
        backgroundColor: color + "26",
        borderLeft: `3px solid ${color}`,
        color: "var(--color-cc-ink)",
      }}
    >
      {label ? <div className="text-caption">{label}</div> : null}
      <div className="font-semibold truncate">{event.title}</div>
    </div>
  );
}
