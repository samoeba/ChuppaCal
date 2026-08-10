"use client";

import { useState } from "react";
import JobRow from "@/components/chores/job-row";
import JobClaimModal from "@/components/chores/job-claim-modal";
import PinGate from "@/components/pin-gate";
import { claimJob, revokeJob } from "@/app/actions/chores";
import type { ChoreCompletion, ChoreTemplate, FamilyMember } from "@/lib/types";

interface JobBoardProps {
  jobs: ChoreTemplate[];
  kids: FamilyMember[];
  gateByKid: Record<string, boolean>;
  claimsToday: ChoreCompletion[];
  familyId: string;
  familyPin: string;
  today: string;
  onClaim: (c: ChoreCompletion) => void;
  onRevoke: (templateId: string) => void;
}

export default function JobBoard({
  jobs, kids, gateByKid, claimsToday, familyId, familyPin, today, onClaim, onRevoke,
}: JobBoardProps) {
  const [picking, setPicking] = useState<ChoreTemplate | null>(null);
  const [revoking, setRevoking] = useState<ChoreTemplate | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const claimByTemplate = Object.fromEntries(claimsToday.map((c) => [c.template_id, c]));

  async function handlePick(job: ChoreTemplate, kid: FamilyMember) {
    setPicking(null);
    const optimistic: ChoreCompletion = {
      id: crypto.randomUUID(),
      family_id: familyId,
      template_id: job.id,
      member_id: kid.id,
      date: today,
      stars_earned: job.star_value,
      completed_at: new Date().toISOString(),
      category: "extra_work",
    };
    onClaim(optimistic);

    // claimJob returns a result for expected outcomes but THROWS on a genuine database
    // error, so the call needs a catch — otherwise a failed query becomes an unhandled
    // rejection inside a click handler and the optimistic claim is never rolled back.
    try {
      const result = await claimJob(job.id, kid.id, familyId, today);
      if (!result.ok) {
        onRevoke(job.id);
        setToast(
          result.reason === "already_claimed"
            ? "Someone already claimed this one"
            : result.reason === "locked"
            ? `${kid.name} needs to finish their jobs first`
            : "That job isn't available anymore"
        );
        setTimeout(() => setToast(null), 2600);
      }
    } catch {
      onRevoke(job.id);
      setToast("Couldn't save that — try again");
      setTimeout(() => setToast(null), 2600);
    }
  }

  async function performRevoke(job: ChoreTemplate) {
    const previous = claimByTemplate[job.id];
    onRevoke(job.id);
    setRevoking(null);
    try {
      await revokeJob(job.id, today);
    } catch {
      if (previous) onClaim(previous);   // put it back — the DB row still exists
      setToast("Couldn't undo that — try again");
      setTimeout(() => setToast(null), 2600);
    }
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl mb-3">🧰</div>
        <p className="font-semibold text-slate-600">No extra work posted</p>
        <p className="text-sm text-slate-400 mt-1">Add jobs in Settings → Extra Work.</p>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-3" style={{ background: "#F3EFE0", borderRadius: 35 }}>
      {jobs.map((job) => (
        <JobRow
          key={job.id}
          job={job}
          kids={kids}
          gateByKid={gateByKid}
          claim={claimByTemplate[job.id]}
          onOpen={() => setPicking(job)}
          onLongPress={() => setRevoking(job)}
        />
      ))}

      {picking && (
        <JobClaimModal
          job={picking}
          kids={kids}
          gateByKid={gateByKid}
          onPick={(kid) => handlePick(picking, kid)}
          onCancel={() => setPicking(null)}
        />
      )}

      {revoking && (
        <PinGate
          familyPin={familyPin}
          message={`Undo "${revoking.name}"?`}
          onVerified={() => performRevoke(revoking)}
          onCancel={() => setRevoking(null)}
        >
          <div />
        </PinGate>
      )}

      {toast && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full font-bold z-9999"
          style={{ background: "#1C1A14", color: "#FAF6E8" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
