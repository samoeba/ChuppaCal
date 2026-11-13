"use client";

import { useState } from "react";
import { useDialog } from "@/lib/use-dialog";
import { createStarReward, updateStarReward, deleteStarReward } from "@/app/actions/chores";
import type { StarReward } from "@/lib/types";

const REWARD_EMOJIS = ["🍦","🎮","🧸","🎠","🍕","🎬","🛝","🎨","📱","🎁","🚀","🌈"];
type Form = { name: string; emoji: string; star_cost: number };
const DEFAULT: Form = { name: "", emoji: "🎁", star_cost: 10 };

interface Props { rewards: StarReward[]; familyId: string; onChanged?: () => void; }

export default function StarRewardsSection({ rewards, familyId, onChanged }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StarReward | null>(null);
  const [form, setForm] = useState<Form>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useDialog(showModal, saving ? undefined : () => setShowModal(false));

  function openAdd() { setError(null); setEditing(null); setForm(DEFAULT); setShowModal(true); }
  function openEdit(r: StarReward) { setError(null); setEditing(r); setForm({ name: r.name, emoji: r.emoji ?? "🎁", star_cost: r.star_cost }); setShowModal(true); }

  async function handleSave() {
    if (!form.name.trim() || form.star_cost < 1 || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) { await updateStarReward(editing.id, form); }
      else { await createStarReward(familyId, form); }
      setShowModal(false);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this reward. Please try again.");
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (saving || !confirm("Delete this reward? Existing redemptions for this reward will also be removed, changing star balances. This cannot be undone.")) return;
    setSaving(true);
    setError(null);
    try {
      await deleteStarReward(id);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete this reward. Please try again.");
    } finally { setSaving(false); }
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
              <button aria-label={`Edit ${r.name}`} disabled={saving} onClick={() => openEdit(r)} className="text-slate-400 hover:text-slate-600 min-w-11 min-h-11 p-2 touch-manipulation">✏️</button>
              <button aria-label={`Delete ${r.name}`} disabled={saving} onClick={() => handleDelete(r.id)} className="text-slate-400 hover:text-rose-500 min-w-11 min-h-11 p-2 touch-manipulation">🗑️</button>
            </div>
          ))}
        </div>
      )}

      {error && !showModal && <p role="alert" className="mt-3 text-red-700">{error}</p>}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div ref={dialog} role="dialog" aria-modal="true" aria-label={editing ? "Edit reward" : "Add reward"} aria-busy={saving} tabIndex={-1} className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90dvh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">{editing ? "Edit Reward" : "Add Reward"}</h3>
            <input aria-label="Reward name" maxLength={200} type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Reward name" className="w-full border border-slate-200 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-rose-500" />
            <p className="text-sm text-slate-400 mb-2">Icon</p>
            <div className="flex gap-2 flex-wrap mb-4">
              {REWARD_EMOJIS.map((e) => (
                <button key={e} aria-label={`Use ${e} icon`} aria-pressed={form.emoji === e} onClick={() => setForm((f) => ({ ...f, emoji: e }))} className={`w-11 h-11 rounded-lg text-xl flex items-center justify-center touch-manipulation ${form.emoji === e ? "bg-slate-200 ring-2 ring-rose-500" : "bg-slate-50"}`}>{e}</button>
              ))}
            </div>
            <p className="text-sm text-slate-400 mb-2">Stars required</p>
            <input aria-label="Stars required" type="number" min={1} value={form.star_cost} onChange={(e) => setForm((f) => ({ ...f, star_cost: Math.max(1, parseInt(e.target.value) || 1) }))} className="w-full border border-slate-200 rounded-xl px-4 py-3 mb-6 focus:outline-none focus:ring-2 focus:ring-rose-500" />
            {error && <p role="alert" className="mb-3 text-red-700">{error}</p>}
            <div className="flex gap-2">
              <button disabled={saving} onClick={() => setShowModal(false)} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold touch-manipulation">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 bg-rose-500 text-white py-3 rounded-xl font-semibold touch-manipulation disabled:opacity-50">{saving ? "Saving…" : editing ? "Save" : "Add"}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
