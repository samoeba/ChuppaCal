"use client";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatWeekLabel(weekStartStr: string): string {
  const start = new Date(weekStartStr + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}`;
}

interface Props {
  weekStartStr: string;
  onPrev: () => void;
  onNext: () => void;
  onCurrentWeek: () => void;
}

export default function WeekNav({ weekStartStr, onPrev, onNext, onCurrentWeek }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0">
      <button
        onClick={onPrev}
        aria-label="Previous week"
        className="w-10 h-10 flex items-center justify-center rounded-xl bg-cc-cream text-cc-ink text-lg font-semibold touch-manipulation active:opacity-70"
      >
        ←
      </button>
      <button
        onClick={onCurrentWeek}
        className="flex-1 text-center font-semibold text-cc-ink touch-manipulation active:opacity-70"
      >
        {formatWeekLabel(weekStartStr)}
      </button>
      <button
        onClick={onNext}
        aria-label="Next week"
        className="w-10 h-10 flex items-center justify-center rounded-xl bg-cc-cream text-cc-ink text-lg font-semibold touch-manipulation active:opacity-70"
      >
        →
      </button>
    </div>
  );
}
