// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ListsBoard from "@/components/lists/lists-board";
import MealBoard from "@/components/meals/meal-board";
import StarRewardsSection from "@/components/settings/star-rewards-section";
import type { List, ListItem, MealPlan, MealRecipe } from "@/lib/types";

const actions = vi.hoisted(() => ({ clear: vi.fn(), remove: vi.fn(), edit: vi.fn(), seed: vi.fn(), reward: vi.fn() }));
const { setMeal, planSavedRecipe, saveMealRecipe } = vi.hoisted(() => ({ setMeal: vi.fn(), planSavedRecipe: vi.fn(), saveMealRecipe: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/actions/lists", () => ({ clearCompleted: actions.clear, deleteItem: actions.remove, seedDefaultsIfEmpty: actions.seed, toggleItem: vi.fn(), editItem: actions.edit, addItem: vi.fn() }));
vi.mock("@/app/actions/meals", () => ({ setMeal, planSavedRecipe, saveMealRecipe, deleteMeal: vi.fn(), mealToGrocery: vi.fn() }));
vi.mock("@/app/actions/chores", () => ({ createStarReward: actions.reward, updateStarReward: vi.fn(), deleteStarReward: vi.fn() }));
const list: List = { id: "list", family_id: "family", name: "Groceries", emoji: "🛒", color: "#112233", sort_order: 0, created_at: "" };
const item: ListItem = { id: "item", family_id: "family", list_id: "list", text: "Milk", checked: false, sort_order: 0, created_at: "" };
const mealBoardProps = { familyId: "family", weekStartStr: "2026-09-21", mealSlots: { breakfast: false, lunch: false, dinner: true, snack: false } };
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(window, "confirm").mockReturnValue(true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("adopts fresh list snapshots after a server refresh", () => {
  const { rerender } = render(<ListsBoard lists={[list]} items={[item]} familyId="family" />);
  expect(screen.getByText("Milk")).toBeTruthy();
  rerender(<ListsBoard lists={[list]} items={[{ ...item, text: "Bread" }]} familyId="family" />);
  expect(screen.queryByText("Milk")).toBeNull();
  expect(screen.getByText("Bread")).toBeTruthy();
});
it("does not seed lists merely by rendering an empty board", async () => {
  render(<ListsBoard lists={[]} items={[]} familyId="family" />);
  expect(actions.seed).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Create Grocery/ }));
  await waitFor(() => expect(actions.seed).toHaveBeenCalledOnce());
});
it("restores a deleted item when the server rejects deletion", async () => {
  actions.remove.mockRejectedValue(new Error("Delete failed"));
  render(<ListsBoard lists={[list]} items={[item]} familyId="family" />);
  fireEvent.click(screen.getByRole("button", { name: "Delete Milk" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Delete failed"));
  expect(screen.getByText("Milk")).toBeTruthy();
});
it("restores completed items when bulk clearing fails", async () => {
  actions.clear.mockRejectedValue(new Error("Clear failed"));
  render(<ListsBoard lists={[list]} items={[{ ...item, checked: true }]} familyId="family" />);
  fireEvent.click(screen.getByRole("button", { name: "Clear completed (1)" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Clear failed"));
  expect(screen.getByText("Milk")).toBeTruthy();
});
it("cancels inline edits with Escape without saving", () => {
  render(<ListsBoard lists={[list]} items={[item]} familyId="family" />);
  fireEvent.click(screen.getByRole("button", { name: "Edit Milk" }));
  const input = screen.getByRole("textbox", { name: "Item text" });
  fireEvent.change(input, { target: { value: "Discard this" } });
  fireEvent.keyDown(input, { key: "Escape" });
  expect(actions.edit).not.toHaveBeenCalled();
  expect(screen.getByText("Milk")).toBeTruthy();
});
it("prevents actions on unsaved temporary items", () => {
  render(<ListsBoard lists={[list]} items={[{ ...item, id: "temp-local" }]} familyId="family" />);
  expect((screen.getByRole("button", { name: "Check Milk" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Delete Milk" }) as HTMLButtonElement).disabled).toBe(true);
});
it("adopts refreshed meals instead of retaining the previous server snapshot", () => {
  const meal: MealPlan = { id: "meal", family_id: "family", date: "2026-09-21", slot: "dinner", name: "Pasta", emoji: null, created_at: "" };
  const { rerender } = render(<MealBoard {...mealBoardProps} meals={[meal]} recipes={[]} />);
  expect(screen.getAllByText("Pasta")).toHaveLength(2);
  rerender(<MealBoard {...mealBoardProps} meals={[{ ...meal, name: "Tacos" }]} recipes={[]} />);
  expect(screen.queryByText("Pasta")).toBeNull();
  expect(screen.getAllByText("Tacos")).toHaveLength(2);
});
it("defaults to saved recipes and schedules the selected recipe with its ingredients, link, and instructions", async () => {
  const recipes: MealRecipe[] = [
    { id: "recipe", name: "Pasta", emoji: "🍝", recipe_url: "https://example.com/pasta", ingredients: ["Pasta", "Tomatoes"], instructions: "Boil pasta.\nAdd tomatoes." },
    { id: "tacos", name: "Tacos", emoji: null, recipe_url: null, ingredients: [] },
  ];
  planSavedRecipe.mockResolvedValue({ ...recipes[0], id: "meal", date: "2026-09-21", slot: "dinner" });
  render(<MealBoard {...mealBoardProps} meals={[]} recipes={recipes} />);
  fireEvent.click(screen.getAllByRole("button", { name: /plan meal/i })[0]);
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByRole("button", { name: "Saved recipes" }).getAttribute("aria-pressed")).toBe("true");
  expect((dialog.getByRole("button", { name: "Add to plan" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(dialog.getByRole("searchbox"), { target: { value: "pas" } });
  expect(dialog.queryByRole("radio", { name: "Tacos" })).toBeNull();
  fireEvent.click(dialog.getByRole("radio", { name: "Pasta" }));
  expect(dialog.getByText("Tomatoes")).toBeTruthy();
  expect(dialog.getByText(/Boil pasta/)).toBeTruthy();
  fireEvent.click(dialog.getByRole("button", { name: "Add to plan" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(planSavedRecipe).toHaveBeenCalledWith("family", "recipe", "2026-09-21", "dinner");

  fireEvent.click(screen.getAllByRole("button", { name: /pasta/i })[0]);
  const editor = within(screen.getByRole("dialog"));
  expect((editor.getByRole("textbox", { name: /ingredients/i }) as HTMLTextAreaElement).value).toBe("Pasta\nTomatoes");
  expect((editor.getByRole("textbox", { name: /instructions/i }) as HTMLTextAreaElement).value).toBe("Boil pasta.\nAdd tomatoes.");
  expect(editor.getByRole("button", { name: /add ingredients to a list/i })).toBeTruthy();
});
it.each([false, true])("supports a custom meal with recipe saving set to %s", async (saveRecipe) => {
  setMeal.mockResolvedValue({ id: "meal", date: "2026-09-21", slot: "dinner", name: "Soup" });
  render(<MealBoard {...mealBoardProps} meals={[]} recipes={[]} />);
  fireEvent.click(screen.getAllByRole("button", { name: /plan meal/i })[0]);
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText(/your recipe library is empty/i)).toBeTruthy();
  fireEvent.click(dialog.getByRole("button", { name: "Custom meal" }));
  fireEvent.change(dialog.getByRole("textbox", { name: "Meal name" }), { target: { value: "Soup" } });
  fireEvent.change(dialog.getByRole("textbox", { name: /ingredients/i }), { target: { value: "Broth\nBeans" } });
  if (saveRecipe) fireEvent.click(dialog.getByRole("checkbox", { name: "Save to recipe library" }));
  fireEvent.click(dialog.getByRole("button", { name: "Save meal" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(setMeal).toHaveBeenCalledWith("family", "2026-09-21", "dinner", "Soup", null, "", ["Broth", "Beans"], saveRecipe, "");
});
it("keeps custom meal planning available while the recipe migration is pending", async () => {
  setMeal.mockResolvedValue({ id: "meal", date: "2026-09-21", slot: "dinner", name: "Soup" });
  render(<MealBoard {...mealBoardProps} meals={[]} recipes={null} />);
  fireEvent.click(screen.getAllByRole("button", { name: /plan meal/i })[0]);
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.change(dialog.getByRole("textbox", { name: "Meal name" }), { target: { value: "Soup" } });
  expect(dialog.queryByRole("checkbox", { name: "Save to recipe library" })).toBeNull();
  fireEvent.click(dialog.getByRole("button", { name: "Save meal" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(setMeal).toHaveBeenCalledWith("family", "2026-09-21", "dinner", "Soup", null, "", [], false, undefined);
});
it("keeps reward form data and displays server failures", async () => {
  actions.reward.mockRejectedValue(new Error("Save failed"));
  render(<StarRewardsSection rewards={[]} familyId="family" />);
  fireEvent.click(screen.getByRole("button", { name: "+ Add Reward" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Reward name" }), { target: { value: "Ice cream" } });
  fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Save failed"));
  expect((screen.getByRole("textbox", { name: "Reward name" }) as HTMLInputElement).value).toBe("Ice cream");
});

it("creates, views, and edits an unscheduled recipe in the library", async () => {
  const recipe = {
    id: "recipe", name: "Soup", emoji: null, recipe_url: "https://example.com/soup",
    ingredients: ["Broth", "Beans"], instructions: null,
  };
  saveMealRecipe.mockResolvedValueOnce(recipe).mockResolvedValueOnce({ ...recipe, instructions: "Heat broth.\nAdd beans." });
  render(<MealBoard {...mealBoardProps} meals={[]} recipes={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "Recipe library" }));
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.click(dialog.getByRole("button", { name: "Add recipe" }));
  fireEvent.change(dialog.getByLabelText("Recipe name"), { target: { value: recipe.name } });
  fireEvent.change(dialog.getByLabelText(/Recipe link/), { target: { value: recipe.recipe_url } });
  fireEvent.change(dialog.getByLabelText(/Ingredients/), { target: { value: "Broth\nBeans" } });
  const htmlFile = new File(["<h1>Soup</h1>"], "soup.html", { type: "text/html" });
  fireEvent.change(dialog.getByLabelText("Visual instructions (HTML file)"), { target: { files: [htmlFile] } });
  fireEvent.click(dialog.getByRole("button", { name: "Save recipe" }));
  expect(await dialog.findByText("No instructions saved yet.")).toBeTruthy();
  expect(dialog.getByRole("link", { name: /Open recipe/ }).getAttribute("href")).toBe(recipe.recipe_url);
  expect(dialog.getByText("Beans")).toBeTruthy();
  expect(saveMealRecipe).toHaveBeenNthCalledWith(1, "family", null, {
    name: recipe.name, emoji: null, recipe_url: recipe.recipe_url, ingredients: recipe.ingredients, instructions: "",
  }, expect.any(FormData));

  expect(saveMealRecipe.mock.calls[0][3].get("html")).toBe(htmlFile);
  fireEvent.click(dialog.getByRole("button", { name: "Edit recipe" }));
  fireEvent.change(dialog.getByLabelText(/Instructions/), { target: { value: "Heat broth.\nAdd beans." } });
  fireEvent.click(dialog.getByRole("button", { name: "Save recipe" }));
  expect(await dialog.findByText(/Heat broth/)).toBeTruthy();
  expect(saveMealRecipe).toHaveBeenNthCalledWith(2, "family", recipe.id, {
    name: recipe.name, emoji: null, recipe_url: recipe.recipe_url, ingredients: recipe.ingredients, instructions: "Heat broth.\nAdd beans.",
  }, expect.any(FormData));
  expect(setMeal).not.toHaveBeenCalled();
  fireEvent.click(dialog.getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getAllByRole("button", { name: /plan meal/i })[0]);
  fireEvent.click(dialog.getByRole("radio", { name: "Soup" }));
  expect(dialog.getByText(/Heat broth/)).toBeTruthy();
});
