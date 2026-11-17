import { createHash } from "node:crypto";
import { after, NextResponse } from "next/server";
import { requireFamilyContext } from "@/lib/family-context";
import { requireId } from "@/lib/validation";
import { listCalendars } from "@/lib/google/calendar";
import type { StoredGoogleCredentials } from "@/lib/google/oauth";
import { readAllRows } from "@/lib/pagination";
import { MAX_GOOGLE_CALENDARS_PER_ADD, type GoogleCalendarChoice } from "@/lib/types";
import { createServiceClient } from "@/lib/supabase/server";
import { syncGoogleConnections } from "@/lib/google/sync";

type Params = { params: Promise<{ id: string }> };
export const maxDuration = 60;

async function loadChoices(id: string) {
  const { supabase, familyId } = await requireFamilyContext();
  const { data: source, error } = await supabase.from("calendar_connections")
    .select("member_id,credentials").eq("id", requireId(id)).eq("family_id", familyId).eq("provider", "google").single();
  if (error || !source) throw new Error("Calendar unavailable");

  const credentials = source.credentials as StoredGoogleCredentials;
  const [{ items, updatedCreds }, connected] = await Promise.all([
    listCalendars(credentials),
    readAllRows<{ id: string; calendar_external_id: string | null; account_email: string | null }>((from, to) => supabase
      .from("calendar_connections").select("id,calendar_external_id,account_email:credentials->>account_email")
      .eq("family_id", familyId).eq("provider", "google").order("id").range(from, to)),
  ]);
  const existingIds = new Set(connected.map((row) => row.calendar_external_id && row.calendar_external_id !== "primary"
    ? row.calendar_external_id : row.account_email));
  // Older connections use Google's "primary" alias rather than the concrete calendar ID.
  const hasPrimary = connected.some((row) => (!row.calendar_external_id || row.calendar_external_id === "primary") &&
    (row.id === id || (row.account_email && row.account_email === credentials.account_email)));
  const calendars = new Map<string, GoogleCalendarChoice>(items.map((item) => [item.id, {
    id: item.id,
    name: item.summaryOverride || item.summary || item.id,
    primary: Boolean(item.primary),
    connected: existingIds.has(item.id) || (Boolean(item.primary) && hasPrimary),
  }]));

  return { supabase, familyId, source, credentials: updatedCreds ?? credentials, calendars };
}

// Use a deterministic UUID for additions so simultaneous requests can safely use
// the existing primary key to ignore duplicate inserts. Legacy IDs stay intact.
function connectionId(familyId: string, calendarId: string) {
  const hash = createHash("sha256").update(JSON.stringify(["chuppacal/google-calendar", familyId, calendarId])).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { calendars } = await loadChoices((await params).id);
    return NextResponse.json({ calendars: [...calendars.values()] }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Could not load calendars. You may need to reconnect Google." }, { status: 400 }); }
}

export async function POST(request: Request, { params }: Params) {
  const deadline = Date.now() + 48_000;
  try {
    const body = await request.json();
    const ids: unknown = body?.calendar_ids;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_GOOGLE_CALENDARS_PER_ADD ||
      ids.some((id: unknown) => typeof id !== "string" || !id.trim() || id.length > 1024)) {
      return NextResponse.json({ error: `Choose 1 to ${MAX_GOOGLE_CALENDARS_PER_ADD} calendars to add.` }, { status: 400 });
    }

    const { supabase, familyId, source, credentials, calendars } = await loadChoices((await params).id);
    const additions = [];
    for (const id of new Set<string>(ids)) {
      const calendar = calendars.get(id);
      if (!calendar) {
        return NextResponse.json({ error: "A selected calendar is no longer available. Reload the list and try again." }, { status: 400 });
      }
      if (calendar.connected) continue;
      additions.push({
        id: connectionId(familyId, id),
        family_id: familyId,
        member_id: source.member_id,
        provider: "google",
        credentials,
        calendar_external_id: calendar.id,
        calendar_name: calendar.name,
      });
    }
    if (!additions.length) return NextResponse.json({ added: [] });

    const { data, error } = await supabase.from("calendar_connections")
      .upsert(additions, { onConflict: "id", ignoreDuplicates: true }).select("id");
    if (error) throw error;
    const added = (data ?? []).map(({ id }) => id);
    if (added.length) after(async () => { await syncGoogleConnections(createServiceClient(), added, deadline); });
    return NextResponse.json({ added });
  } catch { return NextResponse.json({ error: "Could not add calendars. Reload the list or reconnect Google and try again." }, { status: 400 }); }
}
