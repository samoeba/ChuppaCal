import { expect, it, vi, beforeEach } from "vitest";
import { recipeHtmlUpload, RECIPE_HTML_MAX_BYTES } from "@/lib/recipe-html";
import { query } from "./helpers/query";
import { GET } from "@/app/api/recipes/[source]/[id]/instructions/route";

const context = vi.hoisted(() => vi.fn());
vi.mock("@/lib/family-context", () => ({ requireFamilyContext: context }));
const id = "10000000-0000-0000-0000-000000000001";
beforeEach(() => vi.resetAllMocks());

it("reads an HTML upload and preserves fields when no replacement is supplied", async () => {
  const attachment = new FormData();
  attachment.set("html", new File(["<h1>Cook</h1>"], "dinner.html", { type: "text/html" }));
  expect(await recipeHtmlUpload(attachment)).toEqual({ instructions_html: "<h1>Cook</h1>", instructions_html_name: "dinner.html" });
  expect(await recipeHtmlUpload(new FormData())).toEqual({});
  attachment.delete("html");
  attachment.set("removeHtml", "true");
  expect(await recipeHtmlUpload(attachment)).toEqual({ instructions_html: null, instructions_html_name: null });
});

it("rejects oversized, non-HTML, blank, and invalid UTF-8 uploads", async () => {
  for (const file of [
    new File(["plain text"], "instructions.txt"),
    new File(["<p>" + "x".repeat(RECIPE_HTML_MAX_BYTES)], "big.html"),
    new File(["   "], "blank.html"),
    new File([], "empty.html"),
    new File([new Uint8Array([255, 254])], "bad.html"),
  ]) {
    const attachment = new FormData();
    attachment.set("html", file);
    await expect(recipeHtmlUpload(attachment)).rejects.toThrow();
  }
});

it("serves HTML on demand with family filtering and private cache headers", async () => {
  const result = query({ instructions_html: "<h1>Cook</h1>" });
  const from = vi.fn().mockReturnValue(result);
  context.mockResolvedValue({ supabase: { from }, familyId: "family" });
  const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ source: "recipe", id }) });
  expect(await response.json()).toEqual({ html: "<h1>Cook</h1>" });
  expect(from).toHaveBeenCalledWith("meal_recipes");
  expect(result.eq).toHaveBeenCalledWith("family_id", "family");
  expect(result.eq).toHaveBeenCalledWith("id", id);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});

it("rejects unauthenticated, unavailable, and invalid document requests", async () => {
  context.mockRejectedValue(new Error("Please sign in"));
  expect((await GET(new Request("http://localhost"), { params: Promise.resolve({ source: "meal", id }) })).status).toBe(401);
  context.mockResolvedValue({ supabase: { from: () => query(null) }, familyId: "family" });
  expect((await GET(new Request("http://localhost"), { params: Promise.resolve({ source: "meal", id }) })).status).toBe(404);
  expect((await GET(new Request("http://localhost"), { params: Promise.resolve({ source: "unknown", id }) })).status).toBe(404);
});
