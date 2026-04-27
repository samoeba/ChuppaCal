"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MealPlan, MealSlot } from "@/lib/types";
import WeekNav from "./week-nav";
import MealGrid from "./meal-grid";
import MealModal from "./meal-modal";

interface Props {
  meals: MealPlan[];
  mealSlots: Record<MealSlot, boolean>;
  familyId: string;
  weekStartStr: string;
}

type SelectedCell = { date: string; slot: MealSlot; meal?: MealPlan };

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekDays(weekStartStr: string): string[] {
  const start = new Date(weekStartStr + "T00:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return localDateStr(d);
  });
}

export default function MealBoard({ meals, mealSlots, familyId, weekStartStr }: Props) {
  const router = useRouter();
  const [optMeals, setOptMeals] = useState<MealPlan[]>(meals);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);

  const weekDays = getWeekDays(weekStartStr);
  const todayStr = localDateStr(new Date());

  function navigate(offsetWeeks: number) {
    const start = new Date(weekStartStr + "T00:00:00");
    start.setDate(start.getDate() + offsetWeeks * 7);
    router.push(`/meals?week=${localDateStr(start)}`);
  }

  function handleCellTap(date: string, slot: MealSlot, meal?: MealPlan) {
    setSelectedCell({ date, slot, meal });
  }

  function handleSave(meal: MealPlan) {
    setOptMeals((prev) => {
      const idx = prev.findIndex((m) => m.date === meal.date && m.slot === meal.slot);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = meal;
        return next;
      }
      return [...prev, meal];
    });
    setSelectedCell(null);
  }

  function handleDelete(mealId: string) {
    setOptMeals((prev) => prev.filter((m) => m.id !== mealId));
    setSelectedCell(null);
  }

  return (
    <div className="flex flex-col h-full">
      <WeekNav
        weekStartStr={weekStartStr}
        onPrev={() => navigate(-1)}
        onNext={() => navigate(1)}
        onCurrentWeek={() => router.push("/meals")}
      />
      <MealGrid
        meals={optMeals}
        mealSlots={mealSlots}
        weekDays={weekDays}
        todayStr={todayStr}
        onCellTap={handleCellTap}
      />
      {selectedCell && (
        <MealModal
          date={selectedCell.date}
          slot={selectedCell.slot}
          meal={selectedCell.meal}
          familyId={familyId}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setSelectedCell(null)}
        />
      )}
    </div>
  );
}
