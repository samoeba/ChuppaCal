"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import PinGate from "@/components/pin-gate";
import { completeChore, uncompleteChore } from "@/app/actions/chores";
import type { ChoreCompletion, ChoreTemplate, FamilyMember } from "@/lib/types";

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
  const [showUndo, setShowUndo] = useState(false);
  const circleRef = useRef<HTMLButtonElement>(null);
  const done = !!completion;

  async function handleTap() {
    if (done || animating) return;
    setAnimating(true);
    const optimistic: ChoreCompletion = {
      id: crypto.randomUUID(),
      family_id: familyId,
      template_id: template.id,
      member_id: kid.id,
      date: today,
      stars_earned: template.star_value,
      completed_at: new Date().toISOString(),
    };
    onComplete(optimistic);
    if (circleRef.current) {
      const r = circleRef.current.getBoundingClientRect();
      fireStars(r.left + r.width / 2, r.top + r.height / 2);
    }
    try {
      await completeChore(template.id, kid.id, familyId, today, template.star_value);
    } catch {
      onUncomplete(template.id, kid.id);
    } finally {
      setAnimating(false);
    }
  }

  async function performUndo() {
    onUncomplete(template.id, kid.id);
    await uncompleteChore(template.id, kid.id, today);
    setShowUndo(false);
  }

  return (
    <>
      <div className={`flex items-center gap-3 rounded-[20px] px-4 py-2.5 transition-colors ${done ? "bg-green-50" : "bg-white"}`}>
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
        <div className="flex gap-0.5">
          {Array.from({ length: template.star_value }).map((_, i) => (
            <Image key={i} src="/star-small.png" alt="★" width={14} height={14} />
          ))}
        </div>
      </div>

      {showUndo && (
        <PinGate familyPin={familyPin} message={`Undo "${template.name}" for ${kid.name}?`} onVerified={performUndo}>
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
        @keyframes starFly {
          0%   { opacity: 1; transform: translate(0,0) scale(1) rotate(0deg); }
          100% { opacity: 0; transform: translate(var(--dx),var(--dy)) scale(0.3) rotate(var(--dr)); }
        }
        .star-particle {
          position: fixed; width: 24px; height: 24px;
          pointer-events: none; z-index: 9999;
          animation: starFly 0.85s cubic-bezier(0.2,0.8,0.4,1) forwards;
        }
      `}</style>
    </>
  );
}

function fireStars(cx: number, cy: number) {
  [-55, -30, -10, 10, 30, 55].forEach((angle, i) => {
    const img = document.createElement("img");
    img.src = "/star-small.png";
    img.className = "star-particle";
    const rad = (angle - 90) * Math.PI / 180;
    const dist = 80 + Math.random() * 40;
    img.style.setProperty("--dx", `${Math.cos(rad) * dist}px`);
    img.style.setProperty("--dy", `${Math.sin(rad) * dist}px`);
    img.style.setProperty("--dr", `${(Math.random() - 0.5) * 60}deg`);
    img.style.left = `${cx - 12}px`;
    img.style.top = `${cy - 12}px`;
    img.style.animationDelay = `${i * 35}ms`;
    document.body.appendChild(img);
    setTimeout(() => img.remove(), 1000);
  });
}
