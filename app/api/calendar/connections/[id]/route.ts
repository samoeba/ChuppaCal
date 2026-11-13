import { NextResponse } from "next/server";
import { requireFamilyContext, requireFamilyRecord } from "@/lib/family-context";
import { requireId } from "@/lib/validation";
import { listCalendars } from "@/lib/google/calendar";
import type { StoredGoogleCredentials } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireFamilyContext();
    await requireFamilyRecord(context, "calendar_connections", id);
    const { error } = await context.supabase.from("calendar_connections").delete().eq("id", id).eq("family_id", context.familyId);
    if (error) throw new Error("Could not disconnect calendar");
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Could not disconnect this calendar. Sign in and try again." }, { status: 400 }); }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, familyId } = await requireFamilyContext();
    const body = await req.json();
    const { data: connection, error } = await supabase.from("calendar_connections").select("*").eq("id", requireId(id)).eq("family_id", familyId).single();
    if (error || !connection) throw new Error("Connection not found");
    let calendarId = connection.calendar_external_id || "primary";
    let calendarName = connection.calendar_name || "Google Calendar";
    if (body.calendar_external_id && body.calendar_external_id !== calendarId) {
      const available = await listCalendars(connection.credentials as StoredGoogleCredentials);
      const choice = available.items.find((calendar) => calendar.id === body.calendar_external_id);
      if (!choice) throw new Error("Choose a calendar from the connected Google account");
      calendarId = choice.id; calendarName = choice.summary;
    }
    const { error: updateError } = await supabase.rpc("cc_update_calendar", {
      p_id: id, p_member_id: body.member_id ? requireId(body.member_id) : connection.member_id,
      p_calendar_id: calendarId, p_calendar_name: calendarName,
    });
    if (updateError) throw new Error("Could not update this calendar");
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Could not update this calendar. Check your selection and try again." }, { status: 400 }); }
}
