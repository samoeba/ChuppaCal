"use client";

import { useState } from "react";
import Image from "next/image";
import PinGate from "@/components/pin-gate";
import { redeemReward } from "@/app/actions/chores";
import type { FamilyMember, StarRedemption, StarReward } from "@/lib/types";

interface RewardsViewProps {
  kid: FamilyMember;
  rewards: StarReward[];
  starBalance: number;
  familyId: string;
  familyPin: string;
  onRedeem: (r: StarRedemption) => void;
}

export default function RewardsView({ kid, rewards, starBalance, familyId, familyPin, onRedeem }: RewardsViewProps) {
  const [pendingReward, setPendingReward] = useState<StarReward | null>(null);

  async function handleRedeem() {
    if (!pendingReward) return;
    const r: StarRedemption = {
      id: crypto.randomUUID(),
      reward_id: pendingReward.id,
      member_id: kid.id,
      family_id: familyId,
      redeemed_at: new Date().toISOString(),
      stars_spent: pendingReward.star_cost,
    };
    onRedeem(r);
    try {
      await redeemReward(pendingReward.id, kid.id, familyId, pendingReward.star_cost);
    } finally {
      setPendingReward(null);
    }
  }

  return (
    <div className="p-4">
      <div className="text-center py-4 mb-4">
        <div className="flex items-center justify-center gap-2">
          <Image src="/star-small.png" alt="star" width={40} height={40} />
          <span className="text-5xl font-black text-[#1C1A14]">{starBalance}</span>
        </div>
        <p className="text-sm text-slate-400 mt-1">stars available</p>
      </div>

      {rewards.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-4">No rewards yet. Add some in Settings.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rewards.map((reward) => {
            const unlocked = starBalance >= reward.star_cost;
            const pct = Math.min(100, Math.round((starBalance / reward.star_cost) * 100));
            const barColor = unlocked ? "#52C17A" : pct >= 50 ? "#FDCB40" : "#4AB8E8";
            return (
              <div key={reward.id} className="bg-white rounded-[20px] p-4 flex items-center gap-3">
                <div className="text-3xl flex-shrink-0">{reward.emoji ?? "🎁"}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-[#1C1A14]">{reward.name}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Image src="/star-small.png" alt="" width={11} height={11} />
                    {reward.star_cost} stars
                    {unlocked && <span className="text-[#52C17A] font-semibold ml-1">— Unlocked!</span>}
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                  </div>
                </div>
                <button
                  onClick={() => unlocked && setPendingReward(reward)}
                  disabled={!unlocked}
                  className="px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0 touch-manipulation"
                  style={unlocked
                    ? { background: "#FDCB40", color: "#1C1A14" }
                    : { background: "#eee", color: "#aaa", cursor: "default" }}
                >
                  {unlocked ? "Redeem" : "Locked"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {pendingReward && (
        <PinGate
          familyPin={familyPin}
          message={`Redeem "${pendingReward.name}" for ${kid.name}?`}
          onVerified={handleRedeem}
          onCancel={() => setPendingReward(null)}
        >
          <div />
        </PinGate>
      )}
    </div>
  );
}
