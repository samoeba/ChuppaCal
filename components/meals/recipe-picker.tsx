import RecipeHtmlInstructions from "./recipe-html-instructions";
import { useState } from "react";
import type { MealRecipe } from "@/lib/types";

interface Props {
  recipes: MealRecipe[];
  selectedRecipe?: MealRecipe;
  onSelect: (id: string) => void;
  disabled: boolean;
  library?: boolean;
}

export default function RecipePicker({ recipes, selectedRecipe, onSelect, disabled, library = false }: Props) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const matches = recipes.filter((recipe) => recipe.name.toLowerCase().includes(query));

  if (!recipes.length) {
    return (
      <p className="mb-4 rounded-xl bg-cc-cream p-4 text-sm text-cc-ink-dim">
        {library ? "No saved recipes yet. Add a recipe to get started." : "Your recipe library is empty. Add a recipe from Meals or save a custom meal to the library."}
      </p>
    );
  }

  return (
    <fieldset disabled={disabled} className="mb-4 min-w-0">
      <legend className="sr-only">{library ? "Browse saved recipes" : "Choose a saved recipe"}</legend>
      <input
        type="search"
        aria-label="Search recipes"
        placeholder="Search recipes"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="mb-2 min-h-11 w-full rounded-xl border border-cc-line px-3"
      />
      <div className="max-h-56 space-y-1 overflow-y-auto p-1">
        {matches.map((recipe) => (
          <label key={recipe.id} className="relative block cursor-pointer">
            <input
              type="radio"
              name="saved-recipe"
              checked={recipe.id === selectedRecipe?.id}
              onChange={() => onSelect(recipe.id)}
              className="peer sr-only"
            />
            <span className="flex min-h-11 items-center gap-2 rounded-xl bg-cc-cream px-3 py-2 font-semibold peer-checked:bg-sky-soft peer-checked:text-sky-deep peer-focus-visible:outline-2 peer-focus-visible:outline-sky">
              {recipe.emoji && <span aria-hidden="true">{recipe.emoji}</span>}
              <span className="min-w-0 wrap-break-word">{recipe.name}</span>
            </span>
          </label>
        ))}
        {!matches.length && <p className="px-2 py-3 text-sm text-cc-ink-dim">No recipes match your search.</p>}
      </div>
      {selectedRecipe && (
        <div className="mt-3 rounded-xl border border-cc-line p-3 text-sm">
          <p className="wrap-break-word font-semibold">{selectedRecipe.name}</p>
          {selectedRecipe.ingredients.length > 0 && (
            <ul className="mt-1 max-h-28 list-disc overflow-y-auto pl-5 text-cc-ink-dim">
              {selectedRecipe.ingredients.map((ingredient, index) => <li key={index} className="wrap-break-word">{ingredient}</li>)}
            </ul>
          )}
          {selectedRecipe.recipe_url && /^https?:\/\//.test(selectedRecipe.recipe_url) && (
            <a href={selectedRecipe.recipe_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">
              Open recipe ↗
            </a>
          )}
          {selectedRecipe.instructions_html_name && <RecipeHtmlInstructions id={selectedRecipe.id} source="recipe" name={selectedRecipe.instructions_html_name} />}
          <h3 className="mt-3 font-semibold">Instructions</h3>
          <p className="mt-1 whitespace-pre-wrap wrap-break-word text-cc-ink-dim">
            {selectedRecipe.instructions || "No instructions saved yet."}
          </p>
        </div>
      )}
    </fieldset>
  );
}
