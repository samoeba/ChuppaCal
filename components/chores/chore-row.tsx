"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import PinGate from "@/components/pin-gate";
import { completeChore, uncompleteChore } from "@/app/actions/chores";
import type { ChoreCompletion, ChoreTemplate, FamilyMember } from "@/lib/types";

function withViewTransition(cb: () => void) {
  if (typeof document !== "undefined" && "startViewTransition" in document) {
    (document as Document & { startViewTransition: (cb: () => void) => unknown }).startViewTransition(() => {
      flushSync(cb);
    });
  } else {
    cb();
  }
}

interface ChoreRowProps {
  template: ChoreTemplate;
  kid: FamilyMember;
  completion: ChoreCompletion | undefined;
  familyId: string;
  familyPin: string;
  today: string;
  onComplete: (c: ChoreCompletion) => void;
  onUncomplete: (templateId: string, memberId: string) => void;
}

export default function ChoreRow({
  template, kid, completion, familyId, familyPin, today, onComplete, onUncomplete,
}: ChoreRowProps) {
  const [animating, setAnimating] = useState(false);
  const [pendingComplete, setPendingComplete] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const circleRef = useRef<HTMLButtonElement>(null);
  const done = !!completion || pendingComplete;

  async function handleTap() {
    if (done || animating) return;
    setAnimating(true);
    setPendingComplete(true);
    const optimistic: ChoreCompletion = {
      id: crypto.randomUUID(),
      family_id: familyId,
      template_id: template.id,
      member_id: kid.id,
      date: today,
      stars_earned: 0,
      completed_at: new Date().toISOString(),
      category: "expectation",
    };
    try {
      await Promise.all([
        completeChore(template.id, kid.id, familyId, today),
        new Promise((r) => setTimeout(r, 450)),
      ]);
      withViewTransition(() => onComplete(optimistic));
    } catch {
      setPendingComplete(false);
    } finally {
      setAnimating(false);
    }
  }

  async function performUndo() {
    setPendingComplete(false);
    withViewTransition(() => onUncomplete(template.id, kid.id));
    try {
      await uncompleteChore(template.id, kid.id, today);
      setShowUndo(false);
    } catch {
      if (completion) onComplete(completion);
    }
  }

  return (
    <>
      <div
        className={`flex items-center gap-3 rounded-[20px] px-4 py-2.5 transition-colors ${done ? "bg-green-50" : "bg-white"}`}
        style={{ viewTransitionName: `chore-${kid.id}-${template.id}` }}
      >
        <button
          ref={circleRef}
          onClick={done ? () => setShowUndo(true) : handleTap}
          disabled={animating}
          className={`w-11 h-11 rounded-full border-[3px] flex items-center justify-center text-xl flex-shrink-0 touch-manipulation transition-all ${
            done ? "bg-[#52C17A] border-[#52C17A] text-white" : "bg-white border-slate-200"
          }`}
          style={animating ? { animation: "choreComplete 0.45s cubic-bezier(0.34,1.56,0.64,1)" } : {}}
        >
          {done ? "✓" : template.emoji}
        </button>
        <div className={`flex-1 text-base font-semibold ${done ? "line-through text-slate-400" : "text-[#1C1A14]"}`}>
          {template.name}
        </div>
      </div>

      {showUndo && (
        <PinGate
          familyPin={familyPin}
          message={`Undo "${template.name}" for ${kid.name}?`}
          onVerified={performUndo}
          onCancel={() => setShowUndo(false)}
        >
          <div />
        </PinGate>
      )}

      <style>{`
        @keyframes choreComplete {
          0%   { transform: scale(1); box-shadow: 0 0 0 0 rgba(82,193,122,0.7); }
          25%  { transform: scale(1.4); }
          55%  { transform: scale(0.88); }
          75%  { transform: scale(1.12); box-shadow: 0 0 0 18px rgba(82,193,122,0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(82,193,122,0); }
        }
      `}</style>
    </>
  );
}
