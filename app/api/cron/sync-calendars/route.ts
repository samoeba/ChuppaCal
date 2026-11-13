import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { syncGoogleConnection, type SyncResult } from "@/lib/google/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const svc = createServiceClient();
  // Oldest attempts first prevents a failing connection or a large family from starving others.
  const { data: connections, error } = await svc.from("calendar_connections").select("id")
    .eq("provider", "google").order("last_sync_attempt_at", { ascending: true, nullsFirst: true }).order("id").limit(10);
  if (error) return NextResponse.json({ error: "Could not load calendar connections" }, { status: 500 });
  const queue = [...(connections ?? [])];
  const results: SyncResult[] = [];
  const deadline = Date.now() + 48_000;
  async function worker() {
    while (queue.length && deadline - Date.now() > 5_000) {
      const connection = queue.shift();
      if (connection) results.push(await syncGoogleConnection(svc, connection.id, AbortSignal.timeout(Math.max(1, deadline - Date.now()))));
    }
  }
  await Promise.all([worker(), worker()]);
  const ok = results.every((result) => !result.error);
  return NextResponse.json({ ok, synced_at: new Date().toISOString(), deferred: queue.length, results }, { status: ok ? 200 : 502 });
}
