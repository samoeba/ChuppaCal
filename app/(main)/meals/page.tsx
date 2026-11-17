import { MEAL_PLAN_FIELDS, MEAL_RECIPE_FIELDS } from "@/lib/recipe-html";
import MealBoard from "@/components/meals/meal-board";
import type { MealPlan, MealRecipe, MealSlot } from "@/lib/types";
import { loadFamily } from "@/lib/load-family";
import { readAllRows } from "@/lib/pagination";
import { familyTimeZone } from "@/lib/time-zone";
import { addDays, parseDate, toDateParam } from "@/lib/calendar";
import { startOfWeek } from "@/lib/chores";

export const dynamic = "force-dynamic";

const recipeLibraryPending = new Error("Recipe library migration is pending");

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
      .select(MEAL_PLAN_FIELDS)
      .eq("family_id", family.id)
      .gte("date", localDateStr(weekStart))
      .lte("date", localDateStr(weekEnd)),
    readAllRows<MealRecipe>(async (from, to) => {
      const result = await supabase.from("meal_recipes")
        .select(MEAL_RECIPE_FIELDS)
        .eq("family_id", family.id)
        .order("name")
        .order("id")
        .range(from, to);
      // An automatic Vercel deployment can become active while Supabase is being migrated.
      if (["PGRST205", "42P01", "42703"].includes(result.error?.code ?? "")) throw recipeLibraryPending;
      return result;
    }).catch((error: unknown) => {
      if (error === recipeLibraryPending) return null;
      throw error;
    }),
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
