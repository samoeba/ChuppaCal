"use client";

import { useState } from "react";
import KidColumn from "@/components/chores/kid-column";
import { templatesForDay } from "@/lib/chores";
import type { ChoreCompletion, ChoreTemplate, FamilyMember, StarRedemption, StarReward } from "@/lib/types";

interface ChoresBoardProps {
  kids: FamilyMember[];
  templatesByMember: Record<string, ChoreTemplate[]>;
  completionsToday: ChoreCompletion[];
  completionsWeek: ChoreCompletion[];
  allCompletions: ChoreCompletion[];
  rewards: StarReward[];
  redemptions: StarRedemption[];
  familyId: string;
  familyPin: string;
  today: string;
  weekStartStr: string;
}

export default function ChoresBoard({
  kids,
  templatesByMember,
  completionsToday,
  completionsWeek,
  allCompletions,
  rewards,
  redemptions,
  familyId,
  familyPin,
  today,
  weekStartStr,
}: ChoresBoardProps) {
  const [optToday, setOptToday] = useState(completionsToday);
  const [optWeek, setOptWeek] = useState(completionsWeek);
  const [optAll, setOptAll] = useState(allCompletions);
  const [optRedemptions, setOptRedemptions] = useState(redemptions);

  function addCompletion(c: ChoreCompletion) {
    setOptToday((p) => [...p, c]);
    setOptWeek((p) => [...p, c]);
    setOptAll((p) => [...p, c]);
  }

  function removeCompletion(templateId: string, memberId: string) {
    const filter = (p: ChoreCompletion[]) =>
      p.filter((c) => !(c.template_id === templateId && c.member_id === memberId && c.date === today));
    setOptToday(filter);
    setOptWeek(filter);
    setOptAll(filter);
  }

  function addRedemption(r: StarRedemption) {
    setOptRedemptions((p) => [...p, r]);
  }

  if (kids.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-5xl mb-3">✅</div>
          <p className="text-slate-500">No kids have chores enabled.</p>
          <p className="text-slate-400 text-sm mt-1">Enable chores in Settings → Family Members.</p>
        </div>
      </div>
    );
  }

  const todayDate = new Date(today + "T00:00:00");

  return (
    <div className="flex gap-4 h-full p-4">
      {kids.map((kid) => {
        return (
          <KidColumn
            key={kid.id}
            kid={kid}
            todayTemplates={templatesForDay(templatesByMember[kid.id] ?? [], todayDate)}
            allTemplates={templatesByMember[kid.id] ?? []}
            completionsToday={optToday.filter((c) => c.member_id === kid.id)}
            completionsWeek={optWeek.filter((c) => c.member_id === kid.id)}
            allCompletions={optAll.filter((c) => c.member_id === kid.id)}
            rewards={rewards}
            redemptions={optRedemptions}
            familyId={familyId}
            familyPin={familyPin}
            today={today}
            weekStartStr={weekStartStr}
            onComplete={addCompletion}
            onUncomplete={removeCompletion}
            onRedeem={addRedemption}
          />
        );
      })}
    </div>
  );
}
