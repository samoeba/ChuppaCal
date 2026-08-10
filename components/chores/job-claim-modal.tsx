"use client";

import MemberAvatar from "@/components/family/member-avatar";
import type { ChoreTemplate, FamilyMember } from "@/lib/types";

interface JobClaimModalProps {
  job: ChoreTemplate;
  kids: FamilyMember[];
  gateByKid: Record<string, boolean>;
  onPick: (kid: FamilyMember) => void;
  onCancel: () => void;
}

export default function JobClaimModal({ job, kids, gateByKid, onPick, onCancel }: JobClaimModalProps) {
  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-9997 flex items-center justify-center p-6 touch-manipulation"
      style={{ background: "#1C1A14CC" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-cc-lg px-8 py-8 text-center"
        style={{ background: "#FAF6E8" }}
      >
        <div className="text-5xl mb-2">{job.emoji}</div>
        <div className="text-2xl font-bold text-cc-ink">Who did it?</div>
        <div className="text-base font-semibold mt-1" style={{ color: "#8A5E00" }}>
          {job.name} · earns {"★".repeat(job.star_value)}
        </div>

        <div className="flex justify-center gap-6 mt-7">
          {kids.map((kid) => {
            const open = gateByKid[kid.id];
            return (
              <button
                key={kid.id}
                disabled={!open}
                onClick={() => open && onPick(kid)}
                className="flex flex-col items-center gap-2 touch-manipulation disabled:opacity-40"
              >
                <div className="relative">
                  <MemberAvatar member={kid} size={72} emojiClassName="text-4xl" />
                  {!open && (
                    <div className="absolute inset-0 rounded-full flex items-center justify-center text-2xl"
                         style={{ background: "#1C1A1499" }}>
                      🔒
                    </div>
                  )}
                </div>
                <span className="font-bold text-cc-ink">{kid.name}</span>
                {!open && <span className="text-xs text-slate-500">Finish your jobs</span>}
              </button>
            );
          })}
        </div>

        <button
          onClick={onCancel}
          className="mt-8 px-6 py-2.5 rounded-full font-bold touch-manipulation"
          style={{ background: "#F3EFE0", color: "#1C1A14B3" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
