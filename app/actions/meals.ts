"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/family-context";
import { requireBoolean, requireDate, requireId, requireMealSlot, requireText } from "@/lib/validation";
import type { MealPlan, MealSlot } from "@/lib/types";

export async function setMeal(
  familyId: string,
  date: string,
  slot: MealSlot,
  name: string,
  emoji: string | null,
  recipeUrl = "",
  ingredients: string[] = [],
): Promise<MealPlan> {
  const { supabase, familyId: verifiedFamilyId } = await requireFamilyContext(familyId);
  const recipe = recipeUrl.trim();
  if (recipe) {
    const url = new URL(recipe);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || recipe.length > 2048) throw new Error("Use a public http or https recipe link");
  }
  if (!Array.isArray(ingredients) || ingredients.length > 100) throw new Error("Use up to 100 ingredients");
  const items = ingredients.map((item) => requireText(item, "Ingredient", 500));
  const { data, error } = await supabase
    .from("meal_plans")
    .upsert(
      { family_id: verifiedFamilyId, date: requireDate(date), slot: requireMealSlot(slot), name: requireText(name, "Meal name"), emoji: emoji === null ? null : requireText(emoji, "Emoji", 32), recipe_url: recipe || null, ingredients: items },
      { onConflict: "family_id,date,slot" }
    )
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "upsert failed");
  revalidatePath("/meals");
  revalidatePath("/today");
  return data as MealPlan;
}

export async function deleteMeal(mealId: string): Promise<void> {
  const { supabase, familyId } = await requireFamilyContext();
  const { error } = await supabase.from("meal_plans").delete().eq("id", requireId(mealId)).eq("family_id", familyId);
  if (error) throw new Error(error.message);
  revalidatePath("/meals");
  revalidatePath("/today");
}

export async function mealToGrocery(mealId: string, listId: string, ingredients: string[], requestId: string): Promise<number> {
  const { supabase } = await requireFamilyContext();
  if (!Array.isArray(ingredients) || ingredients.length < 1 || ingredients.length > 100) throw new Error("Choose 1–100 ingredients");
  const { data, error } = await supabase.rpc("cc_meal_to_list", {
    p_meal_id: requireId(mealId), p_list_id: requireId(listId), p_request_id: requireId(requestId),
    p_items: ingredients.map((item) => requireText(item, "Ingredient", 500)),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/lists");
  return data as number;
}

export async function updateMealSlots(
  familyId: string,
  slots: Partial<Record<MealSlot, boolean>>
): Promise<void> {
  const { supabase } = await requireFamilyContext(familyId);
  if (!slots || typeof slots !== "object") throw new Error("Invalid meal slots");
  const validatedSlots = Object.fromEntries(Object.entries(slots).map(([slot, enabled]) => [requireMealSlot(slot), requireBoolean(enabled)]));
  const { error } = await supabase.rpc("cc_patch_settings", { p_patch: { meal_slots: validatedSlots } });
  if (error) throw new Error(error.message);
  revalidatePath("/meals");
  revalidatePath("/settings");
}
