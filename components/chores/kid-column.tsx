"use client";

import { useState } from "react";
import Image from "next/image";
import TodayView from "@/components/chores/today-view";
import WeekView from "@/components/chores/week-view";
import RewardsView from "@/components/chores/rewards-view";
import { computeStarBalance } from "@/lib/chores";
import type { ChoreCompletion, ChoreTemplate, FamilyMember, StarRedemption, StarReward } from "@/lib/types";

type ViewType = "today" | "week" | "rewards";

interface KidColumnProps {
  kid: FamilyMember;
  todayTemplates: ChoreTemplate[];
  allTemplates: ChoreTemplate[];
  completionsToday: ChoreCompletion[];
  completionsWeek: ChoreCompletion[];
  allCompletions: ChoreCompletion[];
  rewards: StarReward[];
  redemptions: StarRedemption[];
  familyId: string;
  familyPin: string;
  today: string;
  weekStartStr: string;
  onComplete: (c: ChoreCompletion) => void;
  onUncomplete: (templateId: string, memberId: string) => void;
  onRedeem: (r: StarRedemption) => void;
}

export default function KidColumn({
  kid, todayTemplates, allTemplates, completionsToday, completionsWeek,
  allCompletions, rewards, redemptions, familyId, familyPin, today,
  weekStartStr, onComplete, onUncomplete, onRedeem,
}: KidColumnProps) {
  const [view, setView] = useState<ViewType>("today");

  const starBalance = computeStarBalance(kid.id, allCompletions, redemptions);
  const doneCount = completionsToday.length;
  const totalCount = todayTemplates.length;

  const progressLabel =
    view === "today" ? `${doneCount} of ${totalCount} done`
    : view === "week" ? "This week"
    : "Rewards";

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ background: "#FAF6E8", borderRadius: "35px" }}
    >
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-5" style={{ borderBottom: "2px solid #F3EFE0" }}>
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-3xl flex-shrink-0"
          style={{ backgroundColor: kid.color + "30" }}
        >
          {kid.avatar_emoji}
        </div>
        <div className="flex-1">
          <div className="font-bold text-xl text-[#1C1A14]">{kid.name}</div>
          <div className="text-xs text-slate-400 mt-0.5 bg-slate-100 rounded-full px-2 py-0.5 inline-block">
            {progressLabel}
          </div>
        </div>
        <div className="flex items-center gap-1 font-bold text-2xl text-[#1C1A14]">
          <Image src="/star-small.png" alt="star" width={24} height={24} />
          {starBalance}
          <span className="text-sm font-normal text-slate-400 ml-1">stars</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {view === "today" && (
          <TodayView
            kid={kid} templates={todayTemplates} completions={completionsToday}
            familyId={familyId} familyPin={familyPin} today={today}
            onComplete={onComplete} onUncomplete={onUncomplete}
          />
        )}
        {view === "week" && (
          <WeekView
            kid={kid} allTemplates={allTemplates} completionsWeek={completionsWeek}
            today={today} weekStartStr={weekStartStr}
          />
        )}
        {view === "rewards" && (
          <RewardsView
            kid={kid} rewards={rewards} starBalance={starBalance}
            familyId={familyId} familyPin={familyPin} onRedeem={onRedeem}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: "2px solid #F3EFE0" }}>
        <div className="flex gap-2">
          {(["today", "week"] as ViewType[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-4 py-1.5 rounded-full text-sm font-semibold capitalize touch-manipulation transition-colors"
              style={view === v
                ? { background: "#1C1A14", color: "white" }
                : { background: "white", color: "#888", border: "2px solid #ddd" }}
            >
              {v}
            </button>
          ))}
        </div>
        <button
          onClick={() => setView(view === "rewards" ? "today" : "rewards")}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold touch-manipulation"
          style={view === "rewards"
            ? { background: "#1C1A14", color: "white" }
            : { background: "#FDCB40", color: "#1C1A14" }}
        >
          <Image src="/star-small.png" alt="" width={14} height={14} />
          {view === "rewards" ? "✕ Close" : "Rewards"}
        </button>
      </div>
    </div>
  );
}
