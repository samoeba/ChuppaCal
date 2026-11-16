import MealBoard from "@/components/meals/meal-board";
import type { MealPlan, MealRecipe, MealSlot } from "@/lib/types";
import { loadFamily } from "@/lib/load-family";
import { readAllRows } from "@/lib/pagination";
import { familyTimeZone } from "@/lib/time-zone";
import { addDays, parseDate, toDateParam } from "@/lib/calendar";
import { startOfWeek } from "@/lib/chores";

export const dynamic = "force-dynamic";

function localDateStr(d: Date): string {
  return toDateParam(d);
}

export default async function MealsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const [{ week }, { supabase, family }] = await Promise.all([searchParams, loadFamily()]);
  const weekStart = startOfWeek(parseDate(week, familyTimeZone(family.settings.time_zone)));
  const weekEnd = addDays(weekStart, 6);

  const [{ data: meals, error: mealsError }, recipes] = await Promise.all([
    supabase
      .from("meal_plans")
      .select("*")
      .eq("family_id", family.id)
      .gte("date", localDateStr(weekStart))
      .lte("date", localDateStr(weekEnd)),
    readAllRows<MealRecipe>((from, to) => supabase.from("meal_recipes")
      .select("id,name,emoji,recipe_url,ingredients")
      .eq("family_id", family.id)
      .order("name")
      .order("id")
      .range(from, to)),
  ]);
  if (mealsError) throw new Error("Could not load meal plans");

  const mealSlots: Record<MealSlot, boolean> = family.settings.meal_slots ?? {
    breakfast: true,
    lunch: true,
    dinner: true,
    snack: false,
  };

  return (
    <MealBoard
      key={localDateStr(weekStart)}
      meals={(meals ?? []) as MealPlan[]}
      recipes={recipes}
      mealSlots={mealSlots}
      familyId={family.id}
      weekStartStr={localDateStr(weekStart)}
    />
  );
}
