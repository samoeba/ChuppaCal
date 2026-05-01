import type { ReactNode } from "react";
import { isScheduledToday, toDateString } from "@/lib/chores";
import type { ChoreCompletion, ChoreTemplate } from "@/lib/types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface WeekViewProps {
  allTemplates: ChoreTemplate[];
  completionsWeek: ChoreCompletion[];
  today: string;
  weekStartStr: string;
}

export default function WeekView({ allTemplates, completionsWeek, today, weekStartStr }: WeekViewProps) {
  const weekDates: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStartStr + "T00:00:00");
    d.setDate(d.getDate() + i);
    return d;
  });

  const weekTemplates = allTemplates.filter((t) =>
    weekDates.some((d) => isScheduledToday(t.recurrence, d))
  );

  const doneSet = new Set(completionsWeek.map((c) => `${c.template_id}|${c.date}`));

  if (weekTemplates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-6">
        <div className="text-4xl mb-3">📅</div>
        <p className="text-slate-500 text-sm">No chores assigned yet.</p>
      </div>
    );
  }

  return (
    <div className="p-3 overflow-x-auto">
      <table className="w-full text-sm border-collapse table-fixed">
        <colgroup>
          <col style={{ width: "25%" }} />
          {weekDates.map((_, i) => (
            <col key={i} style={{ width: `${75 / 7}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="text-left text-xs font-bold uppercase tracking-wide text-slate-400 pb-2 pr-2">
              Chore
            </th>
            {weekDates.map((d, i) => (
              <th
                key={i}
                className={`text-center pb-2 text-xs font-bold uppercase tracking-wide ${
                  toDateString(d) === today ? "text-[#FD6B4A]" : "text-slate-400"
                }`}
              >
                {DAY_LABELS[i]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weekTemplates.map((template) => (
            <tr key={template.id} className="border-t border-slate-100">
              <td className="py-2 pr-2 text-xs font-semibold text-[#1C1A14] truncate">
                {template.emoji} {template.name}
              </td>
              {weekDates.map((d, i) => {
                const dateStr = toDateString(d);
                const scheduled = isScheduledToday(template.recurrence, d);
                const done = doneSet.has(`${template.id}|${dateStr}`);
                const isPast = dateStr < today;
                const isToday = dateStr === today;

                let cell: ReactNode;
                if (!scheduled) {
                  cell = <span className="text-slate-200">·</span>;
                } else if (done) {
                  cell = <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#52C17A] text-white text-xs font-bold">✓</span>;
                } else if (isPast) {
                  cell = <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-400 text-xs font-bold">✗</span>;
                } else if (isToday) {
                  cell = <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-[#FD6B4A] text-slate-300 text-xs">–</span>;
                } else {
                  cell = <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-300 text-xs">–</span>;
                }

                return <td key={i} className="py-2 text-center">{cell}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
