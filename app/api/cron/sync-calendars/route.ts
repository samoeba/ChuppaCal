// Cron handler: pulls events from connected Google calendars into Supabase.
//
// Triggered every ~5 min by .github/workflows/sync-calendars.yml.
// (Vercel Hobby crons cap at 1×/day, hence the offload to GitHub Actions.)
//
// Behavior contract:
//   - Always returns HTTP 200 with `{ ok: true, results: [...] }`.
//   - Per-connection failures (expired refresh tokens, Google 4xx/5xx) appear
//     as `error` strings inside `results[i]`. Do NOT infer success from HTTP
//     status alone — read the JSON body.
//   - Returns 401 only when the bearer secret is wrong, 500 on a top-level
//     Supabase failure.
//
// Auth: requires `Authorization: Bearer ${CRON_SECRET}` in production.
// In local dev (no CRON_SECRET set), unauthenticated calls are allowed.
//
// See CLAUDE.md → "Calendar Sync Architecture" for the full chain + debugging
// order + known gotchas.

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { eventToDbRow, listEvents } from "@/lib/google/calendar";
import type { StoredGoogleCredentials } from "@/lib/google/oauth";
import type { CalendarConnection } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Sync a 60-day window centered on today. Keeps the event table manageable
// while covering the UI's reasonable navigation range.
const LOOKBACK_DAYS = 14;
const LOOKAHEAD_DAYS = 60;

type SyncResult = {
  connection_id: string;
  provider: string;
  events_upserted?: number;
  error?: string;
};

function isCronAuthorized(req: Request): boolean {
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // In local dev without a secret, allow.
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();
  const { data: connections, error: connError } = await svc
    .from("calendar_connections")
    .select("*")
    .returns<CalendarConnection[]>();

  if (connError) {
    return NextResponse.json({ error: connError.message }, { status: 500 });
  }

  const now = new Date();
  const timeMin = new Date(now.getTime() - LOOKBACK_DAYS * 86400_000);
  const timeMax = new Date(now.getTime() + LOOKAHEAD_DAYS * 86400_000);
  const results: SyncResult[] = [];

  for (const conn of connections ?? []) {
    if (conn.provider !== "google") {
      // CalDAV handled separately in a follow-up.
      continue;
    }
    try {
      const count = await syncGoogleConnection({ svc, conn, timeMin, timeMax });
      results.push({
        connection_id: conn.id,
        provider: conn.provider,
        events_upserted: count,
      });
    } catch (err) {
      results.push({
        connection_id: conn.id,
        provider: conn.provider,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ ok: true, synced_at: now.toISOString(), results });
}

async function syncGoogleConnection(args: {
  svc: ReturnType<typeof createServiceClient>;
  conn: CalendarConnection;
  timeMin: Date;
  timeMax: Date;
}): Promise<number> {
  const { svc, conn, timeMin, timeMax } = args;
  const creds = conn.credentials as unknown as StoredGoogleCredentials;
  if (!creds?.refresh_token) throw new Error("missing refresh_token");

  const calendarId = conn.calendar_external_id || "primary";
  const updatedMin = conn.last_synced_at
    ? new Date(new Date(conn.last_synced_at).getTime() - 60_000)
    : undefined;

  const { events, updatedCreds } = await listEvents({
    creds,
    calendarId,
    timeMin,
    timeMax,
    updatedMin,
  });

  if (updatedCreds) {
    await svc
      .from("calendar_connections")
      .update({ credentials: updatedCreds as unknown as Record<string, unknown> })
      .eq("id", conn.id);
  }

  const rows = events
    .map((ev) =>
      eventToDbRow(ev, {
        familyId: conn.family_id,
        connectionId: conn.id,
        memberId: conn.member_id,
      })
    )
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length > 0) {
    const { error } = await svc
      .from("calendar_events")
      .upsert(rows, { onConflict: "connection_id,external_id" });
    if (error) throw new Error(`upsert failed: ${error.message}`);
  }

  // Track cancelled IDs for deletion.
  const cancelledIds = events.filter((ev) => ev.status === "cancelled").map((ev) => ev.id);
  if (cancelledIds.length > 0) {
    await svc
      .from("calendar_events")
      .delete()
      .eq("connection_id", conn.id)
      .in("external_id", cancelledIds);
  }

  await svc
    .from("calendar_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", conn.id);

  return rows.length;
}
