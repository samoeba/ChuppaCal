"use client";

import { useState, type FormEvent } from "react";
import { saveMealRecipe } from "@/app/actions/meals";
import type { MealRecipe } from "@/lib/types";
import { useDialog } from "@/lib/use-dialog";
import RecipePicker from "./recipe-picker";

const fieldClass = "mt-1 min-h-11 w-full rounded-xl border border-cc-line px-3 py-2";
const primaryClass = "min-h-11 rounded-xl bg-sky px-4 py-2 font-semibold text-white disabled:opacity-50";
const secondaryClass = "min-h-11 rounded-xl bg-cc-cream px-4 py-2 font-semibold";

export default function RecipeLibrary({ recipes, familyId, onSave, onClose }: {
  recipes: MealRecipe[];
  familyId: string;
  onSave: (recipe: MealRecipe) => void;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<MealRecipe | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialog = useDialog(true, saving ? undefined : onClose);
  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedId);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving) return;
    const fields = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const recipe = await saveMealRecipe(familyId, draft.id || null, {
        name: String(fields.get("name")),
        emoji: String(fields.get("emoji")).trim() || null,
        recipe_url: String(fields.get("link")),
        ingredients: String(fields.get("ingredients")).split("\n").map((line) => line.trim()).filter(Boolean),
        instructions: String(fields.get("instructions")),
      });
      onSave(recipe);
      setSelectedId(recipe.id);
      setDraft(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save recipe");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={saving ? undefined : onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-library-title"
        aria-busy={saving}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6"
      >
        <h2 id="recipe-library-title" className="mb-4 text-xl font-bold">
          {draft ? (draft.id ? "Edit recipe" : "Add recipe") : "Recipe library"}
        </h2>
        {draft ? (
          <form onSubmit={handleSave}>
            <fieldset disabled={saving} className="min-w-0 space-y-3 text-sm">
              <label className="block">Recipe name
                <input name="name" required maxLength={200} defaultValue={draft.name} className={fieldClass} />
              </label>
              <label className="block">Emoji (optional)
                <input name="emoji" maxLength={32} defaultValue={draft.emoji ?? ""} className={fieldClass} />
              </label>
              <label className="block">Recipe link (optional)
                <input name="link" type="url" maxLength={2048} defaultValue={draft.recipe_url ?? ""} className={fieldClass} />
              </label>
              <label className="block">Ingredients · one per line
                <textarea name="ingredients" rows={4} defaultValue={draft.ingredients.join("\n")} className={fieldClass} />
              </label>
              <label className="block">Instructions (optional)
                <textarea name="instructions" rows={5} maxLength={20000} defaultValue={draft.instructions ?? ""} className={fieldClass} />
              </label>
              {error && <p role="alert" className="text-red-700">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={secondaryClass} onClick={() => { setDraft(null); setError(""); }}>Cancel</button>
                <button type="submit" className={primaryClass}>{saving ? "Saving…" : "Save recipe"}</button>
              </div>
            </fieldset>
          </form>
        ) : (
          <>
            <RecipePicker recipes={recipes} selectedRecipe={selectedRecipe} onSelect={setSelectedId} disabled={false} library />
            <div className="flex flex-wrap gap-2">
              <button className={secondaryClass} onClick={onClose}>Close</button>
              {selectedRecipe && <button className={secondaryClass} onClick={() => setDraft(selectedRecipe)}>Edit recipe</button>}
              <button className={primaryClass} onClick={() => setDraft({ id: "", name: "", emoji: null, recipe_url: null, ingredients: [] })}>Add recipe</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
