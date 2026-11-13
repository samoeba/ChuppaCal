import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MealBoard from "@/components/meals/meal-board";
import type { MealPlan, MealSlot, FamilySettings } from "@/lib/types";
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
  const { week } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: selfMember } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .single();
  if (!selfMember) redirect("/onboarding");

  const familyId = selfMember.family_id;

  const { family } = await loadFamily();
  const weekStart = startOfWeek(parseDate(week, familyTimeZone(family.settings.time_zone)));
  const weekEnd = addDays(weekStart, 6);

  const { data: meals, error: mealsError } = await supabase
      .from("meal_plans")
      .select("*")
      .eq("family_id", familyId)
      .gte("date", localDateStr(weekStart))
      .lte("date", localDateStr(weekEnd));
  if (mealsError) throw new Error("Could not load meal plans");

  type FamilyRow = { settings: FamilySettings };
  const settings = (family as FamilyRow | null)?.settings;
  const mealSlots: Record<MealSlot, boolean> = settings?.meal_slots ?? {
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
      familyId={familyId}
      weekStartStr={localDateStr(weekStart)}
    />
  );
}
