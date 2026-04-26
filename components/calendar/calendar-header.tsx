"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type CalendarView,
  shiftForView,
  toDateParam,
  weekRangeLabel,
  monthLabel,
  dayLabel,
} from "@/lib/calendar";

type Props = {
  view: CalendarView;
  date: Date;
  children?: React.ReactNode;
};

export default function CalendarHeader({ view, date, children }: Props) {
  const router = useRouter();

  const label =
    view === "week" ? weekRangeLabel(date) : view === "month" ? monthLabel(date) : dayLabel(date);

  function go(delta: number) {
    const next = shiftForView(view, date, delta);
    router.push(`/calendar?view=${view}&date=${toDateParam(next)}`);
  }

  function jumpToday() {
    router.push(`/calendar?view=${view}&date=${toDateParam(new Date())}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        {children}
        <div>
          <div className="text-heading-md leading-tight">{label}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => go(-1)}
          className="w-10 h-10 rounded-cc-pill bg-cc-white border border-cc-line flex items-center justify-center active:bg-cc-beige"
          aria-label="Previous"
        >
          ‹
        </button>
        <button
          onClick={jumpToday}
          className="px-4 h-10 rounded-cc-pill bg-cc-white border border-cc-line text-body active:bg-cc-beige"
        >
          Today
        </button>
        <button
          onClick={() => go(1)}
          className="w-10 h-10 rounded-cc-pill bg-cc-white border border-cc-line flex items-center justify-center active:bg-cc-beige"
          aria-label="Next"
        >
          ›
        </button>
        <ViewToggle view={view} date={date} />
      </div>
    </div>
  );
}

function ViewToggle({ view, date }: { view: CalendarView; date: Date }) {
  const dateParam = toDateParam(date);
  const views: CalendarView[] = ["day", "week", "month"];
  return (
    <div className="flex items-center p-1 rounded-cc-pill bg-cc-white border border-cc-line">
      {views.map((v) => (
        <Link
          key={v}
          href={`/calendar?view=${v}&date=${dateParam}`}
          scroll={false}
          className={`px-4 h-8 inline-flex items-center justify-center rounded-cc-pill text-body capitalize ${
            view === v ? "bg-cc-ink text-cc-white" : "text-cc-ink-dim"
          }`}
        >
          {v}
        </Link>
      ))}
    </div>
  );
}
