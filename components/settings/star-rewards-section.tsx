"use client";

import { useState } from "react";
import { createStarReward, updateStarReward, deleteStarReward } from "@/app/actions/chores";
import type { StarReward } from "@/lib/types";

const REWARD_EMOJIS = ["🍦","🎮","🧸","🎠","🍕","🎬","🛝","🎨","📱","🎁","🚀","🌈"];
type Form = { name: string; emoji: string; star_cost: number };
const DEFAULT: Form = { name: "", emoji: "🎁", star_cost: 10 };

interface Props { rewards: StarReward[]; familyId: string; }

export default function StarRewardsSection({ rewards, familyId }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StarReward | null>(null);
  const [form, setForm] = useState<Form>(DEFAULT);
  const [saving, setSaving] = useState(false);

  function openAdd() { setEditing(null); setForm(DEFAULT); setShowModal(true); }
  function openEdit(r: StarReward) { setEditing(r); setForm({ name: r.name, emoji: r.emoji ?? "🎁", star_cost: r.star_cost }); setShowModal(true); }

  async function handleSave() {
    if (!form.name.trim() || form.star_cost < 1) return;
    setSaving(true);
    try {
      if (editing) { await updateStarReward(editing.id, form); }
      else { await createStarReward(familyId, form); }
      setShowModal(false);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this reward?")) return;
    await deleteStarReward(id);
  }

  return (
    <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Star Rewards</h2>
        <button onClick={openAdd} className="bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-semibold touch-manipulation">+ Add Reward</button>
      </div>

      {rewards.length === 0 ? (
        <p className="text-sm text-slate-400">No rewards yet. Add one to motivate the kids!</p>
      ) : (
        <div className="space-y-2">
          {rewards.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
              <div className="text-2xl">{r.emoji ?? "🎁"}</div>
              <div className="flex-1">
                <div className="font-semibold text-slate-900">{r.name}</div>
                <div className="text-xs text-slate-400">{r.star_cost} stars</div>
              </div>
              <button onClick={() => openEdit(r)} className="text-slate-400 hover:text-slate-600 p-2 touch-manipulation">✏️</button>
              <button onClick={() => handleDelete(r.id)} className="text-slate-400 hover:text-rose-500 p-2 touch-manipulation">🗑️</button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">{editing ? "Edit Reward" : "Add Reward"}</h3>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Reward name" className="w-full border border-slate-200 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-rose-500" autoFocus />
            <p className="text-sm text-slate-400 mb-2">Icon</p>
            <div className="flex gap-2 flex-wrap mb-4">
              {REWARD_EMOJIS.map((e) => (
                <button key={e} onClick={() => setForm((f) => ({ ...f, emoji: e }))} className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center touch-manipulation ${form.emoji === e ? "bg-slate-200 ring-2 ring-rose-500" : "bg-slate-50"}`}>{e}</button>
              ))}
            </div>
            <p className="text-sm text-slate-400 mb-2">Stars required</p>
            <input type="number" min={1} value={form.star_cost} onChange={(e) => setForm((f) => ({ ...f, star_cost: Math.max(1, parseInt(e.target.value) || 1) }))} className="w-full border border-slate-200 rounded-xl px-4 py-3 mb-6 focus:outline-none focus:ring-2 focus:ring-rose-500" />
            <div className="flex gap-2">
              <button onClick={() => setShowModal(false)} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold touch-manipulation">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 bg-rose-500 text-white py-3 rounded-xl font-semibold touch-manipulation disabled:opacity-50">{saving ? "Saving…" : editing ? "Save" : "Add"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
