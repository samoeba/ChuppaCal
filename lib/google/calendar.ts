import {
  type StoredGoogleCredentials,
  getValidAccessToken,
} from "@/lib/google/oauth";

export type GoogleCalendarListItem = {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
};

export type GoogleEvent = {
  id: string;
  status: string;
  summary?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
};

async function googleFetch<T>(
  url: string,
  creds: StoredGoogleCredentials
): Promise<{ data: T; updatedCreds: StoredGoogleCredentials | null }> {
  const { token, updated } = await getValidAccessToken(creds);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Google API error ${res.status}: ${await res.text()}`);
  }
  return { data: (await res.json()) as T, updatedCreds: updated };
}

export async function listCalendars(
  creds: StoredGoogleCredentials
): Promise<{ items: GoogleCalendarListItem[]; updatedCreds: StoredGoogleCredentials | null }> {
  type Response = { items?: GoogleCalendarListItem[] };
  const { data, updatedCreds } = await googleFetch<Response>(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    creds
  );
  return { items: data.items ?? [], updatedCreds };
}

export async function listEvents(params: {
  creds: StoredGoogleCredentials;
  calendarId: string;
  timeMin: Date;
  timeMax: Date;
  updatedMin?: Date;
}): Promise<{
  events: GoogleEvent[];
  updatedCreds: StoredGoogleCredentials | null;
}> {
  const qs = new URLSearchParams({
    timeMin: params.timeMin.toISOString(),
    timeMax: params.timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "2500",
  });
  if (params.updatedMin) qs.set("updatedMin", params.updatedMin.toISOString());

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    params.calendarId
  )}/events?${qs.toString()}`;

  type Response = { items?: GoogleEvent[] };
  const { data, updatedCreds } = await googleFetch<Response>(url, params.creds);
  return { events: data.items ?? [], updatedCreds };
}

export function eventToDbRow(
  ev: GoogleEvent,
  opts: { familyId: string; connectionId: string; memberId: string | null }
): {
  family_id: string;
  connection_id: string;
  member_id: string | null;
  external_id: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  all_day: boolean;
  synced_at: string;
} | null {
  if (ev.status === "cancelled") return null;

  const allDay = Boolean(ev.start.date);
  const startRaw = ev.start.dateTime ?? ev.start.date;
  const endRaw = ev.end.dateTime ?? ev.end.date;
  if (!startRaw || !endRaw) return null;

  // Google returns all-day as YYYY-MM-DD; normalize to an ISO at midnight local.
  const start = allDay ? new Date(startRaw + "T00:00:00") : new Date(startRaw);
  const end = allDay ? new Date(endRaw + "T00:00:00") : new Date(endRaw);

  return {
    family_id: opts.familyId,
    connection_id: opts.connectionId,
    member_id: opts.memberId,
    external_id: ev.id,
    title: ev.summary ?? "(untitled)",
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    location: ev.location ?? null,
    all_day: allDay,
    synced_at: new Date().toISOString(),
  };
}
