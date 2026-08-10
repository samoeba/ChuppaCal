"use client";

import { useState } from "react";
import { createChoreTemplate, updateChoreTemplate, deleteChoreTemplate } from "@/app/actions/chores";
import type { ChoreTemplate } from "@/lib/types";

type Form = { name: string; emoji: string; star_value: number; is_special: boolean };
const DEFAULT: Form = { name: "", emoji: "🧰", star_value: 1, is_special: false };

interface Props {
  jobs: ChoreTemplate[];
  familyId: string;
  onChanged: () => void;
}

export default function ExtraWorkSection({ jobs, familyId, onChanged }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ChoreTemplate | null>(null);
  const [form, setForm] = useState<Form>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setForm(DEFAULT);
    setError(null);
    setShowModal(true);
  }

  function openEdit(j: ChoreTemplate) {
    setEditing(j);
    setForm({ name: j.name, emoji: j.emoji, star_value: j.star_value, is_special: j.is_special });
    setError(null);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      emoji: form.emoji,
      star_value: form.star_value,
      recurrence: { type: "daily" as const },
      category: "extra_work" as const,
      is_special: form.is_special,
    };
    try {
      if (editing) await updateChoreTemplate(editing.id, payload, []);
      else await createChoreTemplate(familyId, payload, []);
      setError(null);
      setShowModal(false);
      onChanged();
    } catch (e) {
      // These actions throw on any DB error. Without this catch the rejection escapes
      // the click handler and the parent gets no signal at all.
      setError(e instanceof Error ? e.message : "Couldn't save that job — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteChoreTemplate(id);
      setShowModal(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that job — try again.");
    }
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-cc-ink">Extra Work</h2>
        <button onClick={openAdd} className="px-4 py-2 rounded-full bg-rose-500 text-white font-semibold touch-manipulation">
          + Add job
        </button>
      </div>
      <p className="text-sm text-slate-400 mb-3">
        Optional jobs anyone can claim. These are the only chores that earn stars.
      </p>

      <div className="flex flex-col gap-2">
        {jobs.map((j) => (
          <button
            key={j.id}
            onClick={() => openEdit(j)}
            className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 text-left touch-manipulation"
          >
            <span className="text-2xl">{j.emoji}</span>
            <span className="flex-1 font-semibold text-cc-ink">
              {j.is_special && <span style={{ color: "#6B3088" }}>✦ </span>}
              {j.name}
            </span>
            <span className="text-sm text-slate-400">{"★".repeat(j.star_value)}</span>
          </button>
        ))}
        {jobs.length === 0 && <p className="text-sm text-slate-400 py-3">No jobs posted yet.</p>}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "#1C1A14CC" }}>
          <div className="w-full max-w-md rounded-3xl p-6" style={{ background: "#FAF6E8" }}>
            <h3 className="text-lg font-bold mb-4">{editing ? "Edit job" : "New job"}</h3>

            <label className="text-xs font-semibold text-slate-500">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full mb-3 px-4 py-3 rounded-xl bg-white"
              placeholder="Wash the car"
            />

            <label className="text-xs font-semibold text-slate-500">Emoji</label>
            <input
              value={form.emoji}
              onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
              className="w-full mb-3 px-4 py-3 rounded-xl bg-white text-2xl"
            />

            <label className="text-xs font-semibold text-slate-500">Stars (1–10)</label>
            <div className="flex gap-1 mb-3 flex-wrap">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                <button
                  key={v}
                  onClick={() => setForm((f) => ({ ...f, star_value: v }))}
                  className={`w-10 py-2 rounded-xl text-sm font-semibold touch-manipulation ${
                    form.star_value === v ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            <button
              onClick={() => setForm((f) => ({ ...f, is_special: !f.is_special }))}
              className={`w-full mb-4 py-3 rounded-xl font-semibold touch-manipulation ${
                form.is_special ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              {form.is_special ? "✦ Marked as a one-off" : "Mark as a one-off"}
            </button>

            {error && (
              <p className="mb-3 text-sm font-semibold text-red-600" role="alert">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl bg-slate-100 font-semibold touch-manipulation">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl bg-rose-500 text-white font-semibold touch-manipulation disabled:opacity-50">
                Save
              </button>
            </div>

            {editing && (
              <button onClick={() => handleDelete(editing.id)} className="w-full mt-2 py-3 rounded-xl text-red-500 font-semibold touch-manipulation">
                Delete job
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
