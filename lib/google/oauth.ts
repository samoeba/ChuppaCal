const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly openid email profile";

export type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
};

export type StoredGoogleCredentials = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
  scope: string;
  account_email?: string;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function redirectUri(origin: string): string {
  return `${origin}/api/calendar/google/callback`;
}

export function buildAuthUrl(params: {
  origin: string;
  state: string;
}): string {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const qs = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(params.origin),
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent", // force refresh_token
    include_granted_scopes: "true",
    state: params.state,
  });
  return `${AUTH_URL}?${qs.toString()}`;
}

export async function exchangeCodeForTokens(params: {
  code: string;
  origin: string;
}): Promise<GoogleTokenResponse> {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");

  const body = new URLSearchParams({
    code: params.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri(params.origin),
    grant_type: "authorization_code",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<GoogleTokenResponse> {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function getUserInfo(accessToken: string): Promise<{ email?: string }> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return {};
  return res.json();
}

export async function getValidAccessToken(
  creds: StoredGoogleCredentials
): Promise<{ token: string; updated: StoredGoogleCredentials | null }> {
  const now = Date.now();
  // Refresh ~1 minute before actual expiry.
  if (creds.expires_at - 60_000 > now) {
    return { token: creds.access_token, updated: null };
  }
  const refreshed = await refreshAccessToken(creds.refresh_token);
  const updated: StoredGoogleCredentials = {
    ...creds,
    access_token: refreshed.access_token,
    expires_at: Date.now() + refreshed.expires_in * 1000,
    scope: refreshed.scope ?? creds.scope,
  };
  return { token: refreshed.access_token, updated };
}
