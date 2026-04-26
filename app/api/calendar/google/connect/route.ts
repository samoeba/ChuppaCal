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

  const state = `${randomBytes(16).toString("hex")}.${memberId}`;
  const authUrl = buildAuthUrl({ origin, state });

  const res = NextResponse.redirect(authUrl);
  // Short-lived signed state cookie so the callback can verify.
  res.cookies.set("gcal_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
