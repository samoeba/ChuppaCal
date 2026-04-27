"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FamilySettings, MealPlan, MealSlot } from "@/lib/types";

export async function setMeal(
  familyId: string,
  date: string,
  slot: MealSlot,
  name: string,
  emoji: string | null
): Promise<MealPlan> {
  if (!name.trim()) throw new Error("name is required");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plans")
    .upsert(
      { family_id: familyId, date, slot, name, emoji },
      { onConflict: "family_id,date,slot" }
    )
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "upsert failed");
  revalidatePath("/meals");
  return data as MealPlan;
}

export async function deleteMeal(mealId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("meal_plans").delete().eq("id", mealId);
  if (error) throw new Error(error.message);
  revalidatePath("/meals");
}

export async function updateMealSlots(
  familyId: string,
  slots: Record<MealSlot, boolean>
): Promise<void> {
  const supabase = await createClient();
  const { data: family, error: fetchError } = await supabase
    .from("families")
    .select("settings")
    .eq("id", familyId)
    .single();
  if (fetchError || !family) throw new Error(fetchError?.message ?? "family not found");
  const nextSettings: FamilySettings = { ...(family.settings as FamilySettings), meal_slots: slots };
  const { error } = await supabase
    .from("families")
    .update({ settings: nextSettings })
    .eq("id", familyId);
  if (error) throw new Error(error.message);
  revalidatePath("/meals");
  revalidatePath("/settings");
}
