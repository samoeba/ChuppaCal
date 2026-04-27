"use client";

import { useState } from "react";
import type { MealSlot } from "@/lib/types";
import { updateMealSlots } from "@/app/actions/meals";

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const ALL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

interface Props {
  familyId: string;
  initialSlots: Record<MealSlot, boolean>;
}

export default function MealSlotsSection({ familyId, initialSlots }: Props) {
  const [slots, setSlots] = useState<Record<MealSlot, boolean>>(initialSlots);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(slot: MealSlot) {
    const next = { ...slots, [slot]: !slots[slot] };
    setSlots(next);
    try {
      await updateMealSlots(familyId, next);
    } catch (e) {
      setSlots(slots);
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  }

  return (
    <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Meal Slots</h2>
      <p className="text-sm text-slate-400 mb-4">
        Choose which meals appear on the planning grid.
      </p>
      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
      <div className="space-y-3">
        {ALL_SLOTS.map((slot) => (
          <div key={slot} className="flex items-center justify-between">
            <span className="font-medium text-slate-700">{SLOT_LABELS[slot]}</span>
            <button
              role="switch"
              aria-checked={slots[slot]}
              onClick={() => handleToggle(slot)}
              className={`relative w-12 h-6 rounded-full transition-colors touch-manipulation ${
                slots[slot] ? "bg-[var(--clover)]" : "bg-slate-200"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  slots[slot] ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
