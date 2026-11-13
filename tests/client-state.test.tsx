// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ListsBoard from "@/components/lists/lists-board";
import MealBoard from "@/components/meals/meal-board";
import StarRewardsSection from "@/components/settings/star-rewards-section";
import type { List, ListItem, MealPlan } from "@/lib/types";

const actions = vi.hoisted(() => ({ clear: vi.fn(), remove: vi.fn(), edit: vi.fn(), seed: vi.fn(), reward: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/actions/lists", () => ({ clearCompleted: actions.clear, deleteItem: actions.remove, seedDefaultsIfEmpty: actions.seed, toggleItem: vi.fn(), editItem: actions.edit, addItem: vi.fn() }));
vi.mock("@/app/actions/meals", () => ({ upsertMeal: vi.fn(), deleteMeal: vi.fn() }));
vi.mock("@/app/actions/chores", () => ({ createStarReward: actions.reward, updateStarReward: vi.fn(), deleteStarReward: vi.fn() }));
const list: List = { id: "list", family_id: "family", name: "Groceries", emoji: "🛒", color: "#112233", sort_order: 0, created_at: "" };
const item: ListItem = { id: "item", family_id: "family", list_id: "list", text: "Milk", checked: false, sort_order: 0, created_at: "" };
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
  const props = { familyId: "family", weekStartStr: "2026-09-21", mealSlots: { breakfast: false, lunch: false, dinner: true, snack: false } };
  const { rerender } = render(<MealBoard {...props} meals={[meal]} />);
  expect(screen.getAllByText("Pasta")).toHaveLength(2);
  rerender(<MealBoard {...props} meals={[{ ...meal, name: "Tacos" }]} />);
  expect(screen.queryByText("Pasta")).toBeNull();
  expect(screen.getAllByText("Tacos")).toHaveLength(2);
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
