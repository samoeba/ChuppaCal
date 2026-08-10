"use client";

import { useState } from "react";
import Image from "next/image";
import PinGate from "@/components/pin-gate";
import { createStarReward, redeemReward } from "@/app/actions/chores";
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
  const [adding, setAdding] = useState(false);
  const [pinOk, setPinOk] = useState(false);
  const [form, setForm] = useState({ name: "", emoji: "🎁", star_cost: 10 });
  const [saving, setSaving] = useState(false);

  async function handleRedeem() {
    if (!pendingReward) return;
    try {
      await redeemReward(pendingReward.id, kid.id, familyId, pendingReward.star_cost);
      const r: StarRedemption = {
        id: crypto.randomUUID(),
        reward_id: pendingReward.id,
        member_id: kid.id,
        family_id: familyId,
        redeemed_at: new Date().toISOString(),
        stars_spent: pendingReward.star_cost,
      };
      onRedeem(r);
    } finally {
      setPendingReward(null);
    }
  }

  async function saveReward() {
    if (!form.name.trim() || form.star_cost < 1 || saving) return;
    setSaving(true);
    try {
      await createStarReward(familyId, form);
      setAdding(false);
      setPinOk(false);
      setForm({ name: "", emoji: "🎁", star_cost: 10 });
    } finally {
      setSaving(false);
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

      <button
        onClick={() => setAdding(true)}
        className="mt-3 w-full py-3 rounded-2xl font-bold touch-manipulation"
        style={{ background: "#F3EFE0", color: "#1C1A14B3" }}
      >
        + Add reward
      </button>

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

      {adding && !pinOk && (
        <PinGate
          familyPin={familyPin}
          message="Add a reward"
          onVerified={() => setPinOk(true)}
          onCancel={() => setAdding(false)}
        >
          <div />
        </PinGate>
      )}

      {adding && pinOk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "#1C1A14CC" }}>
          <div className="w-full max-w-sm rounded-3xl p-6" style={{ background: "#FAF6E8" }}>
            <h3 className="text-lg font-bold mb-4">New reward</h3>
            <input
              value={form.emoji}
              onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
              className="w-full mb-3 px-4 py-3 rounded-xl bg-white text-2xl"
            />
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Movie ticket"
              className="w-full mb-3 px-4 py-3 rounded-xl bg-white"
            />
            <input
              type="number"
              min={1}
              value={form.star_cost}
              onChange={(e) => setForm((f) => ({ ...f, star_cost: Number(e.target.value) }))}
              className="w-full mb-4 px-4 py-3 rounded-xl bg-white"
            />
            <div className="flex gap-2">
              <button onClick={() => { setAdding(false); setPinOk(false); }} className="flex-1 py-3 rounded-xl bg-slate-100 font-semibold touch-manipulation">
                Cancel
              </button>
              <button onClick={saveReward} disabled={saving} className="flex-1 py-3 rounded-xl bg-rose-500 text-white font-semibold touch-manipulation disabled:opacity-50">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
