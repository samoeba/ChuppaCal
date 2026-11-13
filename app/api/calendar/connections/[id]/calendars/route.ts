import { NextResponse } from "next/server";
import { requireFamilyContext } from "@/lib/family-context";
import { requireId } from "@/lib/validation";
import { listCalendars } from "@/lib/google/calendar";
import type { StoredGoogleCredentials } from "@/lib/google/oauth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, familyId } = await requireFamilyContext();
    const { id } = await params;
    const { data, error } = await supabase.from("calendar_connections").select("credentials,provider").eq("id", requireId(id)).eq("family_id", familyId).single();
    if (error || !data || data.provider !== "google") throw new Error("Calendar unavailable");
    const { items } = await listCalendars(data.credentials as StoredGoogleCredentials);
    return NextResponse.json({ calendars: items.map(({ id, summary, primary }) => ({ id, name: summary, primary })) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Could not load calendars. You may need to reconnect Google." }, { status: 400 }); }
}
