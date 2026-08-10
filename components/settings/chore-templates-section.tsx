"use client";

import { useState } from "react";
import { createChoreTemplate, updateChoreTemplate, deleteChoreTemplate } from "@/app/actions/chores";
import MemberAvatar from "@/components/family/member-avatar";
import type { ChoreRecurrence, ChoreTemplate, FamilyMember, RecurrenceType } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EMOJIS = ["✅","🛏","🧹","🪥","🐕","🍽","👕","📚","🚿","🗑","🌱","🧺","💧","🧼"];

type TemplateWithMembers = ChoreTemplate & { memberIds: string[] };
type Form = { name: string; emoji: string; recurrence: ChoreRecurrence; memberIds: string[] };
const DEFAULT: Form = { name: "", emoji: "✅", recurrence: { type: "daily" }, memberIds: [] };

interface Props { templates: TemplateWithMembers[]; kids: FamilyMember[]; familyId: string; onChanged?: () => void; }

export default function ChoreTemplatesSection({ templates, kids, familyId, onChanged }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TemplateWithMembers | null>(null);
  const [form, setForm] = useState<Form>(DEFAULT);
  const [saving, setSaving] = useState(false);

  function openAdd() {
    setEditing(null);
    setForm({ ...DEFAULT, memberIds: kids.map((k) => k.id) });
    setShowModal(true);
  }

  function openEdit(t: TemplateWithMembers) {
    setEditing(t);
    setForm({ name: t.name, emoji: t.emoji, recurrence: t.recurrence, memberIds: t.memberIds });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateChoreTemplate(editing.id, {
          name: form.name, emoji: form.emoji, star_value: 0,
          recurrence: form.recurrence, category: "expectation", is_special: false,
        }, form.memberIds);
      } else {
        await createChoreTemplate(familyId, {
          name: form.name, emoji: form.emoji, star_value: 0,
          recurrence: form.recurrence, category: "expectation", is_special: false,
        }, form.memberIds);
      }
      setShowModal(false);
      onChanged?.();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this chore?")) return;
    await deleteChoreTemplate(id);
    onChanged?.();
  }

  function toggleDay(day: number) {
    setForm((f) => {
      const days = f.recurrence.days ?? [];
      return { ...f, recurrence: { type: "custom", days: days.includes(day) ? days.filter((d) => d !== day) : [...days, day] } };
    });
  }

  function toggleMember(id: string) {
    setForm((f) => ({ ...f, memberIds: f.memberIds.includes(id) ? f.memberIds.filter((m) => m !== id) : [...f.memberIds, id] }));
  }

  return (
    <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-slate-900">Expectations</h2>
        <button onClick={openAdd} className="bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-semibold touch-manipulation">+ Add Chore</button>
      </div>
      <p className="text-sm text-slate-400 mb-4">Everyday jobs. These don&apos;t earn stars.</p>

      {templates.length === 0 ? (
        <p className="text-sm text-slate-400">No chores yet. Add one to get started.</p>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
              <div className="text-2xl">{t.emoji}</div>
              <div className="flex-1">
                <div className="font-semibold text-slate-900">{t.name}</div>
                <div className="text-xs text-slate-400">
                  {t.recurrence.type === "daily" ? "Every day" : t.recurrence.type === "weekdays" ? "Weekdays" : "Custom"}
                  {t.memberIds.length > 0 && <> · {t.memberIds.map((id) => kids.find((k) => k.id === id)?.name).filter(Boolean).join(", ")}</>}
                </div>
              </div>
              <button onClick={() => openEdit(t)} className="text-slate-400 hover:text-slate-600 p-2 touch-manipulation">✏️</button>
              <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-rose-500 p-2 touch-manipulation">🗑️</button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">{editing ? "Edit Chore" : "Add Chore"}</h3>

            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Chore name" className="w-full border border-slate-200 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-rose-500" autoFocus />

            <p className="text-sm text-slate-400 mb-2">Icon</p>
            <div className="flex gap-2 flex-wrap mb-4">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => setForm((f) => ({ ...f, emoji: e }))} className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center touch-manipulation ${form.emoji === e ? "bg-slate-200 ring-2 ring-rose-500" : "bg-slate-50"}`}>{e}</button>
              ))}
            </div>

            <p className="text-sm text-slate-400 mb-2">Schedule</p>
            <div className="flex gap-2 mb-3">
              {(["daily", "weekdays", "custom"] as RecurrenceType[]).map((type) => (
                <button key={type} onClick={() => setForm((f) => ({ ...f, recurrence: { type, days: f.recurrence.days } }))} className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize touch-manipulation ${form.recurrence.type === type ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600"}`}>{type}</button>
              ))}
            </div>
            {form.recurrence.type === "custom" && (
              <div className="flex gap-1 mb-4">
                {DAYS.map((label, day) => (
                  <button key={day} onClick={() => toggleDay(day)} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold touch-manipulation ${(form.recurrence.days ?? []).includes(day) ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-500"}`}>{label}</button>
                ))}
              </div>
            )}

            {kids.length > 0 && (
              <>
                <p className="text-sm text-slate-400 mb-2">Assign to</p>
                <div className="flex gap-2 flex-wrap mb-4">
                  {kids.map((kid) => (
                    <button key={kid.id} onClick={() => toggleMember(kid.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold touch-manipulation ${form.memberIds.includes(kid.id) ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                      <MemberAvatar member={kid} size={20} emojiClassName="text-xs" />
                      {kid.name}
                    </button>
                  ))}
                </div>
              </>
            )}

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
