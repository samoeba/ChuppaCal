import type { EventWithMember } from "@/lib/calendar";
import { formatTimeLong } from "@/lib/calendar";

const FALLBACK_COLOR = "#4ecdc4";

export default function EventChip({
  event,
  showTime = true,
}: {
  event: EventWithMember;
  showTime?: boolean;
}) {
  const color = event.member?.color ?? FALLBACK_COLOR;
  const start = new Date(event.start_time);
  const end = event.end_time ? new Date(event.end_time) : null;
  const timeLabel = event.all_day
    ? "All day"
    : end
    ? `${formatTimeLong(start)} - ${formatTimeLong(end)}`
    : formatTimeLong(start);

  return (
    <div
      className="relative h-full flex items-stretch rounded-cc-xs overflow-hidden"
      style={{ backgroundColor: `${color}40` }}
    >
      <div
        className="my-1.5 ml-1.5 w-1 rounded-xl flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 min-w-0 pl-2 pr-2.5 py-1.5">
        <div className="font-bold text-[0.95rem] leading-tight truncate text-cc-ink">
          {event.title}
        </div>
        {showTime && timeLabel ? (
          <div className="text-[0.8rem] leading-tight truncate mt-0.5 text-cc-ink-dim">
            {timeLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
}
