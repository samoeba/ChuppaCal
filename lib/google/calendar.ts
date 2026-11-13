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
  creds: StoredGoogleCredentials, signal?: AbortSignal
): Promise<{ data: T; updatedCreds: StoredGoogleCredentials | null }> {
  const { token, updated } = await getValidAccessToken(creds, signal);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Google API error ${res.status}`);
  }
  return { data: (await res.json()) as T, updatedCreds: updated };
}

export async function listCalendars(
  creds: StoredGoogleCredentials
): Promise<{ items: GoogleCalendarListItem[]; updatedCreds: StoredGoogleCredentials | null }> {
  const { items, updatedCreds } = await googlePages<GoogleCalendarListItem>(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList", creds,
  );
  return { items, updatedCreds };
}

async function googlePages<T>(url: string, creds: StoredGoogleCredentials, signal = AbortSignal.timeout(40_000)) {
  const items: T[] = [];
  let updatedCreds: StoredGoogleCredentials | null = null;
  const next = new URL(url);
  const seen = new Set<string>();
  while (true) {
    signal.throwIfAborted();
    if (seen.size >= 100 || items.length > 100000) throw new Error("Calendar exceeds sync size limit");
    const result: { data: { items?: T[]; nextPageToken?: string }; updatedCreds: StoredGoogleCredentials | null } = await googleFetch(next.toString(), updatedCreds ?? creds, signal);
    updatedCreds = result.updatedCreds ?? updatedCreds;
    items.push(...(result.data.items ?? []));
    const token = result.data.nextPageToken;
    if (!token) return { items, updatedCreds };
    if (seen.has(token)) throw new Error("Google returned a repeated page token");
    seen.add(token);
    next.searchParams.set("pageToken", token);
  }
}

export async function listEvents(params: {
  creds: StoredGoogleCredentials;
  calendarId: string;
  timeMin: Date;
  timeMax: Date;
  updatedMin?: Date;
  signal?: AbortSignal;
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
    showDeleted: "true",
  });
  if (params.updatedMin) qs.set("updatedMin", params.updatedMin.toISOString());

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    params.calendarId
  )}/events?${qs.toString()}`;

  const { items, updatedCreds } = await googlePages<GoogleEvent>(url, params.creds, params.signal);
  return { events: items, updatedCreds };
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

  // All-day values are civil dates, encoded at UTC midnight consistently on every host.
  const start = allDay ? new Date(startRaw + "T00:00:00Z") : new Date(startRaw);
  const end = allDay ? new Date(endRaw + "T00:00:00Z") : new Date(endRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new Error("Google returned an invalid event time");
  }

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
