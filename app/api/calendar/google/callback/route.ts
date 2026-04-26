import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, getUserInfo } from "@/lib/google/oauth";
import type { StoredGoogleCredentials } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/settings?gcal_error=${error}`, req.url));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings?gcal_error=missing_params", req.url));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const cookieState = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("gcal_oauth_state="))
    ?.split("=")[1];

  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(new URL("/settings?gcal_error=state_mismatch", req.url));
  }

  const memberId = state.split(".")[1] || "";

  const { data: viewer } = await supabase
    .from("family_members")
    .select("id, family_id")
    .eq("user_id", user.id)
    .single();
  if (!viewer) return NextResponse.redirect(new URL("/onboarding", req.url));

  const resolvedMemberId = memberId || (viewer.id as string);

  let tokens;
  try {
    tokens = await exchangeCodeForTokens({ code, origin: url.origin });
  } catch {
    return NextResponse.redirect(new URL("/settings?gcal_error=exchange_failed", req.url));
  }

  if (!tokens.refresh_token) {
    return NextResponse.redirect(
      new URL("/settings?gcal_error=no_refresh_token", req.url)
    );
  }

  const userInfo = await getUserInfo(tokens.access_token);

  const credentials: StoredGoogleCredentials = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
    scope: tokens.scope,
    account_email: userInfo.email,
  };

  // Service-role insert so the credentials jsonb gets stored regardless of RLS.
  const svc = createServiceClient();
  await svc.from("calendar_connections").insert({
    family_id: viewer.family_id,
    member_id: resolvedMemberId,
    provider: "google",
    credentials: credentials as unknown as Record<string, unknown>,
    calendar_external_id: "primary",
    calendar_name: userInfo.email ?? "Google Calendar",
  });

  const res = NextResponse.redirect(new URL("/settings?gcal_connected=1", req.url));
  res.cookies.delete("gcal_oauth_state");
  return res;
}
