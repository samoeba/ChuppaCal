// Operator-supplied direct Postgres URL. Never reads it from command arguments or prints it.
import nextEnv from "@next/env";
import { mkdir, chmod, stat, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const database = process.env.SUPABASE_DB_URL;
if (!database) throw new Error("Add SUPABASE_DB_URL to .env.local (or environment) before backing up the live database.");
const target = new URL(database);
if (!/^postgres(?:ql)?:$/.test(target.protocol) || !target.hostname || target.hostname === "localhost") throw new Error("Expected a remote PostgreSQL URL.");
const pgDump = process.env.PG_DUMP_BIN || "pg_dump";
const pgRestore = process.env.PG_RESTORE_BIN || "pg_restore";
const env = { ...process.env, PGDATABASE: database, PGCONNECT_TIMEOUT: "10" };
const server = spawnSync("psql", ["-X", "-Atq", "-c", "show server_version_num"], { env, encoding: "utf8", timeout: 15000 });
const dumpVersion = spawnSync(pgDump, ["--version"], { encoding: "utf8", timeout: 5000 });
const serverMajor = Math.floor(Number(server.stdout.trim()) / 10000);
const dumpMajor = Number(dumpVersion.stdout.match(/PostgreSQL\) (\d+)/)?.[1]);
if (server.status !== 0 || !serverMajor) throw new Error("Could not connect to the database to check its PostgreSQL version. No backup was started.");
if (dumpVersion.status !== 0 || !dumpMajor || dumpMajor < serverMajor) {
  throw new Error(`pg_dump ${serverMajor} or newer is required for this database. Set PG_DUMP_BIN to a compatible binary; no backup was started.`);
}
const backupDir = resolve("backups");
await mkdir(backupDir, { recursive: true, mode: 0o700 });
await chmod(backupDir, 0o700);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const path = join(backupDir, `pre-migration-${stamp}.dump`);
const dump = spawnSync(pgDump, ["--format=custom", "--no-owner", "--no-acl", "--file", path], { env, encoding: "utf8", timeout: 120000 });
if (dump.status !== 0) {
  await unlink(path).catch(() => {});
  throw new Error("Database backup failed; no migration should be applied.");
}
await chmod(path, 0o600);
const inspect = spawnSync(pgRestore, ["--list", path], { encoding: "utf8", timeout: 30000 });
if (inspect.status !== 0 || !inspect.stdout.includes("TABLE DATA")) throw new Error("Backup archive could not be inspected. Restore it on a separate project before migrating.");
const size = (await stat(path)).size;
console.log(JSON.stringify({ archive: path, bytes: size, sourceHost: target.hostname,
  note: "Archive created and inspected. A separate-project restore remains mandatory before live migration." }));
