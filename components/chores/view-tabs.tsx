"use client";

export type ChoresView = "today" | "jobs" | "week" | "rewards";

const TABS: { id: ChoresView; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "jobs", label: "Extra Work" },
  { id: "week", label: "Week" },
  { id: "rewards", label: "Rewards" },
];

interface ViewTabsProps {
  view: ChoresView;
  onChange: (v: ChoresView) => void;
  allLocked: boolean;
}

export default function ViewTabs({ view, onChange, allLocked }: ViewTabsProps) {
  return (
    <div className="flex gap-2 px-4 pt-4">
      {TABS.map((tab) => {
        const active = view === tab.id;
        const locked = tab.id === "jobs" && allLocked;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="px-5 py-2.5 rounded-full text-base font-bold touch-manipulation transition-colors"
            style={
              active
                ? { background: "#1C1A14", color: "#FAF6E8" }
                : { background: "#FAF6E8", color: "#1C1A14B3" }
            }
          >
            {locked ? "🔒 " : ""}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
