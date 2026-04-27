import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MealBoard from "@/components/meals/meal-board";
import type { MealPlan, MealSlot, FamilySettings } from "@/lib/types";

export const dynamic = "force-dynamic";

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
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

  const weekStart = week
    ? new Date(week + "T00:00:00")
    : getMondayOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const [{ data: family }, { data: meals }] = await Promise.all([
    supabase.from("families").select("settings").eq("id", familyId).single(),
    supabase
      .from("meal_plans")
      .select("*")
      .eq("family_id", familyId)
      .gte("date", localDateStr(weekStart))
      .lte("date", localDateStr(weekEnd)),
  ]);

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
      meals={(meals ?? []) as MealPlan[]}
      mealSlots={mealSlots}
      familyId={familyId}
      weekStartStr={localDateStr(weekStart)}
    />
  );
}
