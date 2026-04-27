"use client";

import { useState } from "react";
import type { MealPlan, MealSlot } from "@/lib/types";
import { setMeal, deleteMeal } from "@/app/actions/meals";

const FOOD_EMOJIS = [
  "🍳", "🥞", "🥗", "🍕", "🍔", "🌮",
  "🍝", "🍜", "🥘", "🍲", "🍣", "🍱",
  "🥙", "🌯", "🧇", "🥣",
];

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

interface Props {
  date: string;
  slot: MealSlot;
  meal?: MealPlan;
  familyId: string;
  onSave: (meal: MealPlan) => void;
  onDelete: (mealId: string) => void;
  onClose: () => void;
}

export default function MealModal({ date, slot, meal, familyId, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(meal?.name ?? "");
  const [emoji, setEmoji] = useState<string | null>(meal?.emoji ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await setMeal(familyId, date, slot, trimmed, emoji);
      onSave(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!meal) return;
    setSaving(true);
    setError(null);
    try {
      await deleteMeal(meal.id);
      onDelete(meal.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl p-6 w-full max-w-sm"
      >
        <p className="text-sm font-semibold text-cc-ink/50 mb-2">
          {SLOT_LABELS[slot]} · {dateLabel}
        </p>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="What's cooking?"
          autoFocus
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg mb-4 focus:outline-none focus:ring-2 focus:ring-sky"
        />

        <p className="text-sm text-cc-ink/50 mb-2">Emoji (optional)</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {FOOD_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(emoji === e ? null : e)}
              className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center touch-manipulation ${
                emoji === e
                  ? "bg-slate-200 ring-2 ring-sky"
                  : "bg-slate-50 active:bg-slate-100"
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold touch-manipulation"
          >
            Cancel
          </button>
          {meal && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="bg-rose-100 text-rose-600 px-4 py-3 rounded-xl font-semibold touch-manipulation"
            >
              Delete
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="flex-1 bg-sky text-white py-3 rounded-xl font-semibold touch-manipulation disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
