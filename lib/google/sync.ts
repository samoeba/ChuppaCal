import type { createServiceClient } from "@/lib/supabase/server";
import { eventToDbRow, listEvents } from "@/lib/google/calendar";
import type { StoredGoogleCredentials } from "@/lib/google/oauth";
import type { CalendarConnection } from "@/lib/types";

export type SyncResult = { connection_id: string; events_upserted?: number; skipped?: boolean; error?: string };

export async function syncGoogleConnections(svc: ReturnType<typeof createServiceClient>, ids: string[], deadline: number) {
  let next = 0;
  const results: SyncResult[] = [];
  async function worker() {
    while (next < ids.length && deadline - Date.now() > 5_000) {
      const id = ids[next++];
      results.push(await syncGoogleConnection(svc, id, AbortSignal.timeout(Math.max(1, deadline - Date.now()))));
    }
  }
  await Promise.all([worker(), worker()]);
  return { results, deferred: ids.length - next };
}

export async function syncGoogleConnection(svc: ReturnType<typeof createServiceClient>, id: string, signal = AbortSignal.timeout(45_000)): Promise<SyncResult> {
  const { data, error } = await svc.rpc("cc_claim_calendar_sync", { p_id: id });
  if (error) return { connection_id: id, error: "Could not start calendar sync" };
  if (!data) return { connection_id: id, skipped: true };
  const conn = data as CalendarConnection;
  try {
    if (conn.provider !== "google") throw new Error("Unsupported provider");
    const creds = conn.credentials as unknown as StoredGoogleCredentials;
    if (!creds?.refresh_token) throw new Error("Reconnect this calendar");
    const day = Math.floor(Date.now() / 86400_000) * 86400_000;
    const timeMin = new Date(day - 14 * 86400_000);
    const timeMax = new Date(day + 61 * 86400_000);
    const full = await listEvents({ creds, calendarId: conn.calendar_external_id || "primary", timeMin, timeMax, signal });
    // Only a fully fetched, validated snapshot may replace the local mirror.
    const rows = [...new Map(full.events.map((event) => [event.id, event])).values()]
      .map((event) => eventToDbRow(event, { familyId: conn.family_id, connectionId: conn.id, memberId: conn.member_id }))
      .filter((row) => row !== null);
    signal.throwIfAborted();
    const { data: count, error: applyError } = await svc.rpc("cc_apply_calendar_snapshot", {
      p_id: conn.id, p_token: conn.sync_lock_token, p_version: conn.sync_version,
      p_start: timeMin.toISOString(), p_end: timeMax.toISOString(), p_events: rows,
      p_credentials: full.updatedCreds,
    });
    if (applyError) throw new Error("Could not apply calendar snapshot; please retry");
    return { connection_id: id, events_upserted: count as number };
  } catch (cause) {
    // Never persist provider response bodies or credentials in user-visible status.
    const message = cause instanceof Error && /(?:401|403|Reconnect|token refresh failed: 400)/.test(cause.message)
      ? "Reconnect this calendar in Settings."
      : cause instanceof Error && /(?:Timeout|Abort)/.test(cause.name)
      ? "Sync timed out. Your last successful calendar is still available."
      : "Sync failed. Your last successful calendar is still available; try again.";
    const { error: statusError } = await svc.rpc("cc_calendar_sync_error", { p_id: id, p_token: conn.sync_lock_token, p_error: message });
    return { connection_id: id, error: statusError ? `${message} Status could not be saved.` : message };
  }
}
