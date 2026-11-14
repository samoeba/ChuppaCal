import MealBoard from "@/components/meals/meal-board";
import type { MealPlan, MealSlot } from "@/lib/types";
import { loadFamily } from "@/lib/load-family";
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

  const { data: meals, error: mealsError } = await supabase
      .from("meal_plans")
      .select("*")
      .eq("family_id", family.id)
      .gte("date", localDateStr(weekStart))
      .lte("date", localDateStr(weekEnd));
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
      mealSlots={mealSlots}
      familyId={family.id}
      weekStartStr={localDateStr(weekStart)}
    />
  );
}
