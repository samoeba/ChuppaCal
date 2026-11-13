import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireColor, requireId, requireText } from "@/lib/validation";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  let input;
  try {
    const body = await request.json();
    const invite = body.invite ? requireId(body.invite, "invite") : null;
    if (!invite && (typeof body.pin !== "string" || !/^\d{4}$/.test(body.pin))) throw new Error("PIN must be 4 digits");
    input = {
      p_name: requireText(body.parentName, "Your name", 100), p_color: requireColor(body.color),
      p_avatar: requireText(body.avatarEmoji, "Avatar", 32), p_invite: invite,
      p_family_name: invite ? "" : requireText(body.familyName, "Family name", 100), p_pin: invite ? "" : body.pin,
    };
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid setup details" }, { status: 400 });
  }
  // Membership, family and starter lists commit together. Retries return the same family.
  // Identity is derived from the session, never the request body.
  const { data, error } = await supabase.rpc("cc_onboard", input);
  if (error || !data) return NextResponse.json({ error: "Could not complete setup. Check your invite and try again." }, { status: 503 });
  return NextResponse.json({ familyId: data });
}
