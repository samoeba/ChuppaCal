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
