import { NextResponse } from "next/server";
import { requireFamilyContext, requireFamilyRecord } from "@/lib/family-context";
import { requireId } from "@/lib/validation";

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
    const memberId = requireId(body?.member_id, "family member");
    const { data: connection, error } = await supabase.from("calendar_connections")
      .select("calendar_external_id,calendar_name").eq("id", requireId(id)).eq("family_id", familyId).single();
    if (error || !connection) throw new Error("Connection not found");
    const { error: updateError } = await supabase.rpc("cc_update_calendar", {
      p_id: id, p_member_id: memberId,
      p_calendar_id: connection.calendar_external_id || "primary", p_calendar_name: connection.calendar_name || "Google Calendar",
    });
    if (updateError) throw new Error("Could not update this calendar");
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Could not update this calendar. Check your selection and try again." }, { status: 400 }); }
}
