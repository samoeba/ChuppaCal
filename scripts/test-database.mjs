// Isolated local PostgreSQL test: never reads .env.local or contacts Supabase.
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync, spawn } from "node:child_process";

const pgConfig = spawnSync("pg_config", ["--bindir"], { encoding: "utf8" });
const bin = process.env.PG_BIN ?? (pgConfig.status === 0 ? pgConfig.stdout.trim() : "/opt/homebrew/opt/postgresql@14/bin");
const directory = await mkdtemp(join(tmpdir(), "chuppacal-db-test-"));
const data = join(directory, "data");
const env = { ...process.env, PGHOST: directory, PGPORT: "55439", PGDATABASE: "postgres", PGUSER: "postgres", PGPASSWORD: "", PGOPTIONS: "" };
function run(command, args, input) {
  const result = spawnSync(join(bin, command), args, { env, input, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.error?.message || result.stdout}`);
  return result.stdout;
}
function sql(input) { return run("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1"], input); }
function file(path) { return run("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", resolve(path)]); }
let started = false;
try {
  run("initdb", ["-D", data, "-U", "postgres", "--auth=trust", "--no-locale", "--encoding=UTF8"]);
  run("pg_ctl", ["-D", data, "-l", join(directory,"postgres.log"), "-o", `-k ${directory} -p 55439 -c listen_addresses=''`, "-w", "start"]);
  started = true;
  sql(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    alter default privileges in schema public grant select,insert,update,delete on tables to anon,authenticated,service_role;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    create schema realtime;
    create table realtime.messages(id bigint,extension text,topic text);
    alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
    create function realtime.send(jsonb,text,text,boolean default true) returns void language sql as $$ select $$;
  `);
  for (const migration of (await readdir("supabase/migrations")).filter((name) => name.endsWith(".sql")).sort()) {
    file(`supabase/migrations/${migration}`);
    if (migration.startsWith("004_")) file("tests/database/legacy-fixture.sql");
    console.log(`Applied ${migration} to isolated test database`);
  }
  file("tests/database/workflows.sql");
  file("tests/database/calendar-meals.sql");
  const redemption = (requestId) => new Promise((resolveResult, reject) => {
    const child = spawn(join(bin, "psql"), ["-X", "-q", "-v", "ON_ERROR_STOP=1"], { env, stdio: ["pipe","pipe","pipe"] });
    let error = "";
    child.stderr.on("data", (chunk) => { error += chunk; });
    child.on("error", reject);
    child.on("exit", (status) => resolveResult({ status, error }));
    child.stdin.end(`set role authenticated; set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001'; select public.cc_redeem_reward('60000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','${requestId}');`);
  });
  const race = await Promise.all([redemption("70000000-0000-0000-0000-000000000001"), redemption("70000000-0000-0000-0000-000000000002")]);
  if (race.filter((result) => result.status === 0).length !== 1 || !race.some((result) => result.error.includes("Not enough stars"))) throw new Error("Concurrent redemption guard failed");
  sql("select public.cc_test_assert((select count(*)=1 from public.star_redemptions),'one concurrent redemption');");
  // Test an actual dump/restore of this disposable database, not a claimed production backup.
  run("pg_dump", ["--format=custom", "--file", join(directory,"test.dump")]);
  sql("create database restored;");
  run("pg_restore", ["--exit-on-error", "--dbname=restored", join(directory,"test.dump")]);
  console.log("PASS: migrations, RLS/RPC invariants, atomic rollback, concurrent spending, and local dump/restore");
} finally {
  if (started) run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  // Only the fresh, validated per-run temporary directory contains these disposable fixtures.
  await rm(directory, { recursive: true, force: true });
}
