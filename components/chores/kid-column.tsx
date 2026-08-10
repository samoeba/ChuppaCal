"use client";

import Image from "next/image";
import TodayView from "@/components/chores/today-view";
import WeekView from "@/components/chores/week-view";
import RewardsView from "@/components/chores/rewards-view";
import MemberAvatar from "@/components/family/member-avatar";
import { computeStarBalance } from "@/lib/chores";
import type { ChoreCompletion, ChoreTemplate, FamilyMember, StarRedemption, StarReward } from "@/lib/types";

interface KidColumnProps {
  kid: FamilyMember;
  view: "today" | "week" | "rewards";
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
  kid, view, todayTemplates, allTemplates, completionsToday, completionsWeek,
  allCompletions, rewards, redemptions, familyId, familyPin, today,
  weekStartStr, onComplete, onUncomplete, onRedeem,
}: KidColumnProps) {
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
        <MemberAvatar member={kid} size={56} emojiClassName="text-3xl" />
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
            allTemplates={allTemplates} completionsWeek={completionsWeek}
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
    </div>
  );
}
