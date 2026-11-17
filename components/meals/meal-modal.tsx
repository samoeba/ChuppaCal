"use client";

import { useRef, useState } from "react";
import type { List, MealPlan, MealRecipe, MealSlot } from "@/lib/types";
import { setMeal, planSavedRecipe, deleteMeal, mealToGrocery } from "@/app/actions/meals";
import { createClient } from "@/lib/supabase/client";
import { useDialog } from "@/lib/use-dialog";
import RecipeHtmlInstructions from "./recipe-html-instructions";
import RecipePicker from "./recipe-picker";

const FOOD_EMOJIS = [
  "🍳", "🥞", "🥗", "🍕", "🍔", "🌮",
  "🍝", "🍜", "🥘", "🍲", "🍣", "🍱",
  "🥙", "🌯", "🧇", "🥣",
];

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

interface Props {
  date: string;
  slot: MealSlot;
  meal?: MealPlan;
  recipes: MealRecipe[] | null;
  familyId: string;
  onSave: (meal: MealPlan) => void;
  onDelete: (mealId: string) => void;
  onClose: () => void;
}

export default function MealModal({ date, slot, meal, recipes, familyId, onSave, onDelete, onClose }: Props) {
  const [recipeMode, setRecipeMode] = useState(!meal && recipes !== null);
  const [recipeId, setRecipeId] = useState("");
  const [saveRecipe, setSaveRecipe] = useState(false);
  const [name, setName] = useState(meal?.name ?? "");
  const [emoji, setEmoji] = useState<string | null>(meal?.emoji ?? null);
  const [saving, setSaving] = useState(false);
  const [recipeUrl, setRecipeUrl] = useState(meal?.recipe_url ?? "");
  const [instructions, setInstructions] = useState(meal?.instructions ?? "");
  const [ingredients, setIngredients] = useState((meal?.ingredients ?? []).join("\n"));
  const [lists, setLists] = useState<List[] | null>(null);
  const [listId, setListId] = useState("");
  const [notice, setNotice] = useState("");
  const transfer = useRef<{ key: string; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialog = useDialog(true, saving ? undefined : onClose);
  const useSavedRecipe = recipeMode && recipes !== null;
  const selectedRecipe = recipes?.find((recipe) => recipe.id === recipeId);
  const canSave = useSavedRecipe ? !!selectedRecipe : !!name.trim();
  const recipeName = name.trim().toLowerCase();
  const matchesRecipeName = recipes?.some((recipe) => recipe.name.trim().toLowerCase() === recipeName);

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = useSavedRecipe && selectedRecipe
        ? await planSavedRecipe(familyId, selectedRecipe.id, date, slot)
        : await setMeal(familyId, date, slot, name.trim(), emoji, recipeUrl, ingredientLines(), recipes !== null && saveRecipe, recipes === null ? undefined : instructions);
      onSave(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  }

  function switchMode(saved: boolean) {
    setRecipeMode(saved);
    setError(null);
  }

  function ingredientLines() { return ingredients.split("\n").map((line) => line.trim()).filter(Boolean); }
  async function chooseList() {
    setSaving(true); setError(null);
    try {
      const { data, error } = await createClient().from("lists").select("*").eq("family_id", familyId).order("sort_order");
      if (error) throw new Error("Could not load your lists");
      setLists(data ?? []); setListId(data?.[0]?.id ?? "");
    } catch (error) { setError(error instanceof Error ? error.message : "Please retry"); }
    finally { setSaving(false); }
  }
  async function addIngredients() {
    if (!meal || !listId || saving) return;
    setSaving(true); setError(null);
    try {
      const items = ingredientLines();
      const key = JSON.stringify([meal.id,listId,items]);
      if (transfer.current?.key !== key) transfer.current = { key, id: crypto.randomUUID() };
      const count = await mealToGrocery(meal.id,listId,items,transfer.current.id);
      setNotice(`${count} ingredient${count===1 ? "" : "s"} added. Existing unchecked items were skipped.`);
      setLists(null);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not add ingredients"); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!meal || saving) return;
    setSaving(true);
    setError(null);
    try {
      await deleteMeal(meal.id);
      onDelete(meal.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
      setSaving(false);
    }
  }

  return (
    <div
      onClick={saving ? undefined : onClose}
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
    >
      <div
        ref={dialog} role="dialog" aria-modal="true" aria-label={`${SLOT_LABELS[slot]} · ${dateLabel}`} tabIndex={-1} aria-busy={saving}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90dvh] overflow-y-auto"
      >
        <p className="text-sm font-semibold text-cc-ink/50 mb-2">
          {SLOT_LABELS[slot]} · {dateLabel}
        </p>

        {!meal && recipes !== null && (
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-cc-cream p-1" aria-label="Meal source" role="group">
            <button
              aria-pressed={useSavedRecipe}
              onClick={() => switchMode(true)}
              disabled={saving}
              className="min-h-11 rounded-lg px-2 text-sm font-semibold aria-pressed:bg-sky aria-pressed:text-white"
            >
              Saved recipes
            </button>
            <button
              aria-pressed={!useSavedRecipe}
              onClick={() => switchMode(false)}
              disabled={saving}
              className="min-h-11 rounded-lg px-2 text-sm font-semibold aria-pressed:bg-sky aria-pressed:text-white"
            >
              Custom meal
            </button>
          </div>
        )}

        {useSavedRecipe ? (
          <RecipePicker recipes={recipes} selectedRecipe={selectedRecipe} onSelect={setRecipeId} disabled={saving} />
        ) : (
          <fieldset disabled={saving} className="min-w-0">
            <input
              type="text"
              aria-label="Meal name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="What's cooking?"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg mb-4 focus:outline-none focus:ring-2 focus:ring-sky"
            />

            <p className="text-sm text-cc-ink/50 mb-2">Emoji (optional)</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {FOOD_EMOJIS.map((e) => (
                <button
                  key={e}
                  aria-label={`Use ${e} emoji`}
                  aria-pressed={emoji === e}
                  onClick={() => setEmoji(emoji === e ? null : e)}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center touch-manipulation ${
                    emoji === e
                      ? "bg-slate-200 ring-2 ring-sky"
                      : "bg-slate-50 active:bg-slate-100"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>

            <label className="block text-sm mb-3">Recipe link (optional)<input type="url" value={recipeUrl} onChange={(e) => setRecipeUrl(e.target.value)} placeholder="https://…" className="w-full min-h-11 rounded-xl border border-cc-line px-3 mt-1" /></label>
            {/^https?:\/\//.test(recipeUrl) && <a href={recipeUrl} target="_blank" rel="noopener noreferrer" className="inline-block underline text-sm mb-3 min-h-11">Open recipe ↗</a>}
            <label className="block text-sm mb-3">Ingredients · one per line<textarea rows={4} value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder={"1 box pasta\n2 tomatoes"} className="w-full rounded-xl border border-cc-line px-3 py-2 mt-1" /></label>
            {recipes !== null && <label className="block text-sm mb-3">Instructions (optional)
              <textarea rows={4} maxLength={20000} value={instructions} onChange={(e) => setInstructions(e.target.value)} className="w-full rounded-xl border border-cc-line px-3 py-2 mt-1" />
            </label>}
            {meal?.instructions_html_name && <RecipeHtmlInstructions id={meal.id} source="meal" name={meal.instructions_html_name} />}
            {meal && ingredientLines().length > 0 && JSON.stringify(ingredientLines()) === JSON.stringify(meal.ingredients ?? []) && <button disabled={saving} onClick={chooseList} className="min-h-11 px-3 bg-cc-cream rounded-xl mb-3">Add ingredients to a list…</button>}
            {meal && JSON.stringify(ingredientLines()) !== JSON.stringify(meal.ingredients ?? []) && ingredientLines().length > 0 && <p className="text-sm mb-3">Save ingredient changes before adding them to a list.</p>}
            {!meal && ingredientLines().length > 0 && <p className="text-sm mb-3">Save this meal first, then reopen it to add ingredients to a list.</p>}
            {lists && <div className="rounded-xl border border-cc-line p-3 mb-3">
              <p className="text-sm mb-2">Add these {ingredientLines().length} ingredients. Exact duplicates already unchecked on the list will be skipped.</p>
              {lists.length ? <><select aria-label="Destination grocery list" value={listId} onChange={(e) => setListId(e.target.value)} className="w-full min-h-11 border rounded-lg px-2">{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select><button disabled={saving} onClick={addIngredients} className="min-h-11 px-3 underline">Confirm add</button></> : <p>Create a list on the Lists page first.</p>}
            </div>}
            {recipes !== null && <label className="mb-3 flex min-h-11 items-center gap-3 rounded-xl bg-cc-cream px-3 py-2 text-sm font-semibold">
              <input type="checkbox" checked={saveRecipe} onChange={(event) => setSaveRecipe(event.target.checked)} className="size-5 shrink-0 accent-sky" />
              {matchesRecipeName ? "Update recipe in the library" : "Save to recipe library"}
            </label>}
          </fieldset>
        )}
        <p role="status" className="text-sm mb-3">{notice}</p>
        {error && <p role="alert" className="text-red-700 text-sm mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold touch-manipulation"
          >
            Cancel
          </button>
          {meal && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="bg-rose-100 text-rose-600 px-4 py-3 rounded-xl font-semibold touch-manipulation"
            >
              Delete
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex-1 bg-sky text-white py-3 rounded-xl font-semibold touch-manipulation disabled:opacity-50"
          >
            {saving ? "Saving…" : useSavedRecipe ? "Add to plan" : "Save meal"}
          </button>
        </div>
      </div>
    </div>
  );
}
