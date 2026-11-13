import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, getUserInfo } from "@/lib/google/oauth";
import type { StoredGoogleCredentials } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  function finish(path: string) {
    const response = NextResponse.redirect(new URL(path, req.url));
    response.cookies.delete("gcal_oauth_state");
    return response;
  }
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return finish(`/settings?gcal_error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return finish("/settings?gcal_error=missing_params");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return finish("/login");

  const cookieState = req.cookies.get("gcal_oauth_state")?.value;

  if (!cookieState || cookieState !== state) {
    return finish("/settings?gcal_error=state_mismatch");
  }

  const memberId = state.split(".")[1] || "";
  const reconnectId = state.split(".")[2] || "";

  const { data: viewer } = await supabase
    .from("family_members")
    .select("id, family_id")
    .eq("user_id", user.id)
    .single();
  if (!viewer) return finish("/onboarding");

  const resolvedMemberId = memberId || (viewer.id as string);
  const { data: target, error: targetError } = await supabase.from("family_members")
    .select("id").eq("id", resolvedMemberId).eq("family_id", viewer.family_id).single();
  if (targetError || !target) return finish("/settings?gcal_error=invalid_member");

  let tokens;
  try {
    tokens = await exchangeCodeForTokens({ code, origin: url.origin });
  } catch {
    return finish("/settings?gcal_error=exchange_failed");
  }

  if (!tokens.refresh_token) {
    return finish("/settings?gcal_error=no_refresh_token");
  }

  const userInfo = await getUserInfo(tokens.access_token).catch(() => ({} as { email?: string }));

  const credentials: StoredGoogleCredentials = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
    scope: tokens.scope,
    account_email: userInfo.email,
  };

  // Service-role insert so the credentials jsonb gets stored regardless of RLS.
  const svc = createServiceClient();
  if (reconnectId) {
    const { error } = await svc.rpc("cc_reconnect_google", { p_id: reconnectId, p_family_id: viewer.family_id, p_credentials: credentials });
    if (error) return finish("/settings?gcal_error=save_failed");
    return finish("/settings?gcal_connected=1");
  }
  const { error: insertError } = await svc.from("calendar_connections").insert({
    family_id: viewer.family_id,
    member_id: resolvedMemberId,
    provider: "google",
    credentials: credentials as unknown as Record<string, unknown>,
    calendar_external_id: "primary",
    calendar_name: userInfo.email ?? "Google Calendar",
  });
  if (insertError) return finish("/settings?gcal_error=save_failed");

  return finish("/settings?gcal_connected=1");
}
