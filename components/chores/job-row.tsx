"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import MemberAvatar from "@/components/family/member-avatar";
import type { ChoreCompletion, ChoreTemplate, FamilyMember } from "@/lib/types";

interface JobRowProps {
  job: ChoreTemplate;
  kids: FamilyMember[];
  gateByKid: Record<string, boolean>;
  claim: ChoreCompletion | undefined;
  onOpen: () => void;
  onLongPress: () => void;
}

export default function JobRow({ job, kids, gateByKid, claim, onOpen, onLongPress }: JobRowProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const claimedBy = claim ? kids.find((k) => k.id === claim.member_id) : undefined;

  function startPress() {
    if (!claim) return;
    timer.current = setTimeout(onLongPress, 500);
  }
  function endPress() {
    if (timer.current) clearTimeout(timer.current);
  }

  // The board scrolls. On a touchscreen a scroll fires pointerdown then pointercancel,
  // and pointerup/pointerleave may never arrive -- without this the 500ms timer
  // completes and a PIN keypad appears mid-scroll.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <div
      onClick={claim ? undefined : onOpen}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
      className="flex items-center gap-4 rounded-[20px] px-5 py-4 touch-manipulation"
      style={{ background: claim ? "#A7EB98" : "#FFFFFF" }}
    >
      <div className="text-3xl shrink-0">{job.emoji}</div>

      <div className="flex-1 min-w-0">
        <div className="text-lg font-bold text-cc-ink truncate">
          {job.is_special && <span style={{ color: "#6B3088" }}>✦ </span>}
          {job.name}
        </div>
        {claimedBy && (
          <div className="text-sm font-semibold" style={{ color: "#005C00" }}>
            {claimedBy.name} claimed this
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 font-bold shrink-0" style={{ color: "#8A5E00" }}>
        <Image src="/star-small.png" alt="" width={18} height={18} />
        {job.star_value}
      </div>

      <div className="flex gap-1 shrink-0">
        {claimedBy ? (
          <MemberAvatar member={claimedBy} size={36} emojiClassName="text-lg" />
        ) : (
          kids.map((kid) => (
            <div key={kid.id} className="relative" style={{ opacity: gateByKid[kid.id] ? 1 : 0.35 }}>
              <MemberAvatar member={kid} size={36} emojiClassName="text-lg" />
              {!gateByKid[kid.id] && (
                <div className="absolute inset-0 rounded-full flex items-center justify-center text-xs"
                     style={{ background: "#1C1A1499" }}>
                  🔒
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
