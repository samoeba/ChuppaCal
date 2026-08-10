"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

interface UnlockCelebrationProps {
  kidName: string;
  onDone: () => void;
}

export default function UnlockCelebration({ kidName, onDone }: UnlockCelebrationProps) {
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const t = setTimeout(() => onDoneRef.current(), 2600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      onClick={onDone}
      className="fixed inset-0 z-9998 flex items-center justify-center touch-manipulation"
      style={{ background: "#1C1A14CC", animation: "unlockIn 0.3s ease-out" }}
    >
      <div
        className="flex flex-col items-center gap-3 px-12 py-10 rounded-cc-lg text-center"
        style={{ background: "#FAF6E8", animation: "unlockPop 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        <Image src="/star-small.png" alt="" width={56} height={56} />
        <div className="text-3xl font-bold text-cc-ink">All done, {kidName}!</div>
        <div className="text-lg font-semibold" style={{ color: "#8A5E00" }}>
          Extra Work unlocked
        </div>
      </div>
      <style>{`
        @keyframes unlockIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes unlockPop {
          0%   { transform: scale(0.7); opacity: 0 }
          60%  { transform: scale(1.06) }
          100% { transform: scale(1); opacity: 1 }
        }
      `}</style>
    </div>
  );
}
