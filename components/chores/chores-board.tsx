"use client";

import { useEffect, useRef, useState } from "react";
import KidColumn from "@/components/chores/kid-column";
import JobBoard from "@/components/chores/job-board";
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

  // Functional updaters only. ChoreRow.handleTap awaits a server call plus a 450ms
  // delay before calling this, so two taps inside ~1s would otherwise commit a stale
  // pre-first-completion array and erase the earlier completion. The unlock
  // celebration is handled by the gate-transition effect below, NOT here -- updater
  // functions must stay pure (StrictMode may invoke them twice).
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

  const [optClaims, setOptClaims] = useState(claimsToday);

  function addClaim(c: ChoreCompletion) {
    setOptClaims((p) => [...p, c]);
    setOptAll((p) => [...p, c]);
  }

  function removeClaim(templateId: string) {
    setOptClaims((p) => p.filter((c) => c.template_id !== templateId));
    setOptAll((p) => p.filter((c) => !(c.template_id === templateId && c.date === today)));
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

  // Fire the unlock celebration on a false->true gate transition. On first mount the
  // previous value is `undefined`, and `undefined === false` is false, so nothing
  // fires on load. This deliberately lives in an effect rather than in the
  // setOptToday updater: updaters must be pure, and StrictMode may run them twice.
  // The setState is guarded by a strict transition check and prevGateRef is written
  // on every run, so it cannot cascade -- hence the targeted rule suppression.
  const prevGateRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    for (const kid of kids) {
      if (prevGateRef.current[kid.id] === false && liveGateByKid[kid.id]) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUnlockedKid(kid.name);
      }
    }
    prevGateRef.current = liveGateByKid;
  }, [liveGateByKid, kids]);

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
          <JobBoard
            jobs={jobs}
            kids={kids}
            gateByKid={liveGateByKid}
            claimsToday={optClaims}
            familyId={familyId}
            familyPin={familyPin}
            today={today}
            onClaim={addClaim}
            onRevoke={removeClaim}
          />
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
