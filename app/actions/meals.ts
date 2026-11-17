"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/family-context";
import { requireBoolean, requireDate, requireId, requireMealSlot, requireText } from "@/lib/validation";
import type { MealPlan, MealRecipe, MealSlot } from "@/lib/types";

function recipeDetails(name: string, emoji: string | null, recipeUrl: string, ingredients: string[], instructions: string) {
  const recipe = recipeUrl.trim();
  if (recipe) {
    const url = new URL(recipe);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || recipe.length > 2048) throw new Error("Use a public http or https recipe link");
  }
  if (!Array.isArray(ingredients) || ingredients.length > 100) throw new Error("Use up to 100 ingredients");
  if (typeof instructions !== "string" || instructions.trim().length > 20000) {
    throw new Error("Use up to 20,000 characters for instructions");
  }
  return {
    name: requireText(name, "Name"),
    emoji: emoji === null ? null : requireText(emoji, "Emoji", 32),
    recipe_url: recipe || null,
    ingredients: ingredients.map((item) => requireText(item, "Ingredient", 500)),
    instructions: instructions.trim() || null,
  };
}

export async function saveMealRecipe(
  familyId: string,
  recipeId: string | null,
  details: Omit<MealRecipe, "id">,
): Promise<MealRecipe> {
  const { supabase, familyId: verifiedFamilyId } = await requireFamilyContext(familyId);
  const recipe = recipeDetails(details.name, details.emoji, details.recipe_url ?? "", details.ingredients, details.instructions ?? "");
  const table = supabase.from("meal_recipes");
  const query = recipeId === null
    ? table.insert({ ...recipe, family_id: verifiedFamilyId })
    : table.update(recipe).eq("id", requireId(recipeId)).eq("family_id", verifiedFamilyId);
  const { data, error } = await query.select("id,name,emoji,recipe_url,ingredients,instructions").single();
  if (error?.code === "23505") throw new Error("A recipe with that name already exists");
  if (error || !data) throw new Error(error?.message ?? "Could not save recipe");
  revalidatePath("/meals");
  return data as MealRecipe;
}

export async function setMeal(
  familyId: string,
  date: string,
  slot: MealSlot,
  name: string,
  emoji: string | null,
  recipeUrl = "",
  ingredients: string[] = [],
  saveRecipe = false,
  instructions?: string,
): Promise<MealPlan> {
  const { supabase, familyId: verifiedFamilyId } = await requireFamilyContext(familyId);
  const { instructions: validatedInstructions, ...details } = recipeDetails(name, emoji, recipeUrl, ingredients, instructions ?? "");
  const meal = {
    ...details,
    family_id: verifiedFamilyId,
    date: requireDate(date),
    slot: requireMealSlot(slot),
  };
  const { data, error } = requireBoolean(saveRecipe)
    ? await supabase.rpc("cc_set_meal_and_recipe", {
      p_date: meal.date,
      p_slot: meal.slot,
      p_name: meal.name,
      p_emoji: meal.emoji,
      p_recipe_url: meal.recipe_url,
      p_ingredients: meal.ingredients,
      ...(instructions !== undefined && { p_instructions: validatedInstructions }),
    }).single()
    : await supabase.from("meal_plans")
      .upsert({ ...meal, ...(instructions !== undefined && { instructions: validatedInstructions }) }, { onConflict: "family_id,date,slot" })
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
