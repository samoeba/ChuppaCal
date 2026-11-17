"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MealPlan, MealRecipe, MealSlot } from "@/lib/types";
import WeekNav from "./week-nav";
import MealGrid from "./meal-grid";
import MealModal from "./meal-modal";
import RecipeLibrary from "./recipe-library";
import { useServerState } from "@/lib/use-server-state";
import { useFamilyRuntime } from "@/components/family-runtime";
import { civilDate } from "@/lib/time-zone";
import { addDays, toDateParam } from "@/lib/calendar";

interface Props {
  meals: MealPlan[];
  recipes: MealRecipe[] | null;
  mealSlots: Record<MealSlot, boolean>;
  familyId: string;
  weekStartStr: string;
}

type SelectedCell = { date: string; slot: MealSlot; meal?: MealPlan };

function localDateStr(d: Date): string {
  return toDateParam(d);
}

function getWeekDays(weekStartStr: string): string[] {
  const start = civilDate(weekStartStr);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    return localDateStr(d);
  });
}

export default function MealBoard({ meals, recipes, mealSlots, familyId, weekStartStr }: Props) {
  const { timeZone } = useFamilyRuntime();
  const router = useRouter();
  const [optMeals, setOptMeals] = useServerState(meals);
  const [savedRecipes, setSavedRecipes] = useServerState(recipes);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);

  const weekDays = getWeekDays(weekStartStr);
  const todayStr = toDateParam(new Date(), timeZone);

  function navigate(offsetWeeks: number) {
    const start = addDays(civilDate(weekStartStr), offsetWeeks * 7);
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
      {savedRecipes !== null && <div className="flex justify-end px-4 pt-3">
        <button onClick={() => setLibraryOpen(true)} className="min-h-11 rounded-xl bg-cc-cream px-4 font-semibold text-cc-ink">
          Recipe library
        </button>
      </div>}
      {libraryOpen && savedRecipes !== null && (
        <RecipeLibrary
          recipes={savedRecipes}
          familyId={familyId}
          onSave={(recipe) => setSavedRecipes((current) =>
            [...(current ?? []).filter(({ id }) => id !== recipe.id), recipe].sort((a, b) => a.name.localeCompare(b.name))
          )}
          onClose={() => setLibraryOpen(false)}
        />
      )}
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
          recipes={savedRecipes}
          familyId={familyId}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setSelectedCell(null)}
        />
      )}
    </div>
  );
}
