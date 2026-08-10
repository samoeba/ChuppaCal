"use client";

import { useState } from "react";
import KidColumn from "@/components/chores/kid-column";
import UnlockCelebration from "@/components/chores/unlock-celebration";
import ViewTabs, { type ChoresView } from "@/components/chores/view-tabs";
import { expectationsForDay, gateOpen } from "@/lib/chores";
import type { ChoreCompletion, ChoreTemplate, FamilyMember, StarRedemption, StarReward } from "@/lib/types";

interface ChoresBoardProps {
  kids: FamilyMember[];
  templatesByMember: Record<string, ChoreTemplate[]>;
  completionsToday: ChoreCompletion[];
  completionsWeek: ChoreCompletion[];
  allCompletions: ChoreCompletion[];
  rewards: StarReward[];
  redemptions: StarRedemption[];
  jobs: ChoreTemplate[];
  claimsToday: ChoreCompletion[];
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
  jobs,
  claimsToday,
  familyId,
  familyPin,
  today,
  weekStartStr,
}: ChoresBoardProps) {
  const [optToday, setOptToday] = useState(completionsToday);
  const [optWeek, setOptWeek] = useState(completionsWeek);
  const [optAll, setOptAll] = useState(allCompletions);
  const [optRedemptions, setOptRedemptions] = useState(redemptions);
  const [unlockedKid, setUnlockedKid] = useState<string | null>(null);

  function addCompletion(c: ChoreCompletion) {
    const next = [...optToday, c];
    setOptToday(next);
    setOptWeek((p) => [...p, c]);
    setOptAll((p) => [...p, c]);

    if (c.category !== "expectation") return;
    const wasOpen = liveGate(optToday, c.member_id);
    const nowOpen = liveGate(next, c.member_id);
    if (!wasOpen && nowOpen) {
      const kid = kids.find((k) => k.id === c.member_id);
      if (kid) setUnlockedKid(kid.name);
    }
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

  const [view, setView] = useState<ChoresView>("today");

  function liveGate(completions: ChoreCompletion[], memberId: string) {
    return gateOpen(
      templatesByMember[memberId] ?? [],
      completions.filter((c) => c.member_id === memberId),
      today
    );
  }

  const liveGateByKid: Record<string, boolean> = Object.fromEntries(
    kids.map((k) => [k.id, liveGate(optToday, k.id)])
  );
  const allLocked = kids.every((k) => !liveGateByKid[k.id]);

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
    <div className="flex flex-col h-full">
      {unlockedKid && (
        <UnlockCelebration kidName={unlockedKid} onDone={() => setUnlockedKid(null)} />
      )}
      <ViewTabs view={view} onChange={setView} allLocked={allLocked} />

      {view === "jobs" ? (
        <div className="flex-1 p-4 overflow-y-auto">
          <p className="text-sm text-slate-400">Job board lands in Task 7.</p>
        </div>
      ) : (
        <div className="flex gap-4 flex-1 p-4 overflow-hidden">
          {kids.map((kid) => (
            <KidColumn
              key={kid.id}
              kid={kid}
              view={view}
              todayTemplates={expectationsForDay(templatesByMember[kid.id] ?? [], todayDate)}
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
          ))}
        </div>
      )}
    </div>
  );
}
