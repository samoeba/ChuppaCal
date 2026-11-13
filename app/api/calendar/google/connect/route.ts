import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { buildAuthUrl } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams, origin } = new URL(req.url);
  const memberId = searchParams.get("member_id") ?? "";
  const { data: viewer, error: viewerError } = await supabase.from("family_members")
    .select("id,family_id").eq("user_id", user.id).single();
  if (viewerError || !viewer) return NextResponse.redirect(new URL("/onboarding", req.url));
  const resolvedMemberId = memberId || viewer.id;
  const { data: target, error: targetError } = await supabase.from("family_members")
    .select("id").eq("id", resolvedMemberId).eq("family_id", viewer.family_id).single();
  if (targetError || !target) return NextResponse.redirect(new URL("/settings?gcal_error=invalid_member", req.url));

  const reconnectId = searchParams.get("connection_id") ?? "";
  if (reconnectId) {
    const { data: existing } = await supabase.from("calendar_connections").select("id").eq("id", reconnectId).eq("family_id", viewer.family_id).eq("provider", "google").single();
    if (!existing) return NextResponse.redirect(new URL("/settings?gcal_error=invalid_connection", req.url));
  }
  const state = `${randomBytes(16).toString("hex")}.${resolvedMemberId}.${reconnectId}`;
  const authUrl = buildAuthUrl({ origin, state });

  const res = NextResponse.redirect(authUrl);
  // Short-lived HttpOnly state cookie binds this random nonce to the initiating browser.
  res.cookies.set("gcal_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
