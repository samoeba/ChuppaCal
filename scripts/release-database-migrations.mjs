import { readFile } from "node:fs/promises";

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("Missing Production secret SUPABASE_ACCESS_TOKEN");

async function runSql(query, readOnly) {
  const response = await fetch("https://api.supabase.com/v1/projects/skkxvyebvcjvhcbdzqhc/database/query", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, read_only: readOnly }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = typeof body?.message === "string" ? body.message.replaceAll(token, "[redacted]") : "";
    throw new Error(`Supabase SQL returned HTTP ${response.status}. ${message}`);
  }
  return response.json();
}

const albumStatusSql = `
  select
    exists(select from storage.buckets where id = 'screensaver-photos') as bucket_exists,
    exists(
      select from storage.buckets
      where id = 'screensaver-photos' and not public and file_size_limit = 5242880
        and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']
    ) as bucket_ready,
    count(*) = 3 as policies_ready
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and roles = array['authenticated']::name[]
    and (policyname, cmd) in (
      ('Family can read screensaver photos', 'SELECT'),
      ('Family can add screensaver photos', 'INSERT'),
      ('Family can remove screensaver photos', 'DELETE')
    );
`;

async function albumStatus() {
  const rows = await runSql(albumStatusSql, true);
  if (!Array.isArray(rows) || typeof rows[0]?.bucket_exists !== "boolean") {
    throw new Error("Supabase returned an unexpected response for the album check");
  }
  return rows[0];
}

let status = await albumStatus();
if (!status.bucket_exists && process.env.APPLY_SCREENSAVER_MIGRATION === "true") {
  const migration = new URL("../supabase/migrations/010_screensaver_album.sql", import.meta.url);
  await runSql(await readFile(migration, "utf8"), false);
  status = await albumStatus();
}
if (!status.bucket_ready || !status.policies_ready) {
  throw new Error("The private screensaver bucket or its family access policies are missing or incomplete");
}
console.log("Verified the private screensaver bucket and all three family access policies.");

const recipeStatusSql = `
  select
    to_regclass('public.meal_recipes') is not null as table_exists,
    to_regprocedure('public.cc_set_meal_and_recipe(date,text,text,text,text,text[])') is not null as function_exists,
    exists (
      select from pg_class
      where oid = to_regclass('public.meal_recipes') and relrowsecurity
    ) and exists (
      select from pg_policies
      where schemaname = 'public' and tablename = 'meal_recipes'
        and policyname = 'Family access' and roles = array['authenticated']::name[]
    ) as family_access_ready;
`;

async function recipeStatus() {
  const rows = await runSql(recipeStatusSql, true);
  if (!Array.isArray(rows) || typeof rows[0]?.table_exists !== "boolean") {
    throw new Error("Supabase returned an unexpected response for the recipe bank check");
  }
  return rows[0];
}

let recipes = await recipeStatus();
if (!recipes.table_exists && !recipes.function_exists && process.env.APPLY_RECIPE_MIGRATION === "true") {
  const migration = new URL("../supabase/migrations/011_meal_recipes.sql", import.meta.url);
  await runSql(await readFile(migration, "utf8"), false);
  recipes = await recipeStatus();
}
if (!recipes.table_exists || !recipes.function_exists || !recipes.family_access_ready) {
  throw new Error("Migration 011 is required before deploying the recipe bank");
}
console.log("Verified the recipe bank, family access policy, and atomic meal save function.");

const instructionsStatusSql = `
  select
    count(*) as columns_present,
    count(*) filter (where data_type = 'text' and is_nullable = 'YES') = 2 as columns_ready,
    to_regprocedure('public.cc_set_meal_and_recipe(date,text,text,text,text,text[],text)') is not null as function_exists
  from information_schema.columns
  where table_schema = 'public' and table_name in ('meal_recipes', 'meal_plans')
    and column_name = 'instructions';
`;

async function instructionsStatus() {
  const [row] = await runSql(instructionsStatusSql, true);
  if (typeof row?.columns_ready !== "boolean") {
    throw new Error("Supabase returned an unexpected response for the recipe instructions check");
  }
  return row;
}

let instructions = await instructionsStatus();
if (Number(instructions.columns_present) === 0 && !instructions.function_exists && process.env.APPLY_RECIPE_INSTRUCTIONS === "true") {
  const migration = new URL("../supabase/migrations/012_recipe_instructions.sql", import.meta.url);
  await runSql(await readFile(migration, "utf8"), false);
  instructions = await instructionsStatus();
}
if (!instructions.columns_ready || !instructions.function_exists) {
  throw new Error("Migration 012 is required before deploying recipe instructions");
}
console.log("Verified instructions on saved recipes and planned meals, and the instruction-aware atomic meal save function.");
