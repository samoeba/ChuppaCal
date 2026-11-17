// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import RecipeHtmlInstructions from "@/components/meals/recipe-html-instructions";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("opens HTML within an isolated, script-free iframe and returns to the recipe", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ html: "<h1>Cook dinner</h1>" }) });
  vi.stubGlobal("fetch", fetch);
  render(<RecipeHtmlInstructions id="recipe" source="recipe" name="dinner.html" />);
  fireEvent.click(screen.getByRole("button", { name: "Open visual instructions" }));
  const iframe = await screen.findByTitle("Recipe instruction document");
  expect(iframe.getAttribute("sandbox")).toBe("");
  expect(iframe.getAttribute("srcdoc")).toContain("script-src 'none'");
  expect(iframe.getAttribute("srcdoc")).toContain("<h1>Cook dinner</h1>");
  expect(fetch).toHaveBeenCalledWith("/api/recipes/recipe/recipe/instructions", expect.objectContaining({ cache: "no-store" }));
  fireEvent.click(screen.getByRole("button", { name: "Close instructions" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("lets the cook retry a failed document load", async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ html: "<p>Ready</p>" }) });
  vi.stubGlobal("fetch", fetch);
  render(<RecipeHtmlInstructions id="meal" source="meal" name="dinner.html" />);
  fireEvent.click(screen.getByRole("button", { name: "Open visual instructions" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(screen.getByTitle("Recipe instruction document")).toBeTruthy());
});
