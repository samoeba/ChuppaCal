"use client";
import { useState } from "react";
import type { CalendarConnectionSummary } from "@/lib/types";

export default function CalendarConnectionControls({ connection, onChanged }: { connection: CalendarConnectionSummary; onChanged: () => void }) {
  const [calendars, setCalendars] = useState<{ id: string; name: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const path = `/api/calendar/connections/${connection.id}`;
  async function request(action: "load" | "sync" | "select", calendarId?: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(path + (action === "load" ? "/calendars" : action === "sync" ? "/sync" : ""), {
        method: action === "load" ? "GET" : action === "sync" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        ...(action === "select" ? { body: JSON.stringify({ calendar_external_id: calendarId }) } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 429 ? "Sync is running or was just attempted. Wait 30 seconds and retry." : data.error || "Could not update calendar");
      if (action === "load") setCalendars(data.calendars);
      else { setMessage(action === "sync" ? "Calendar is up to date." : "Calendar selected. Sync now to load its events."); onChanged(); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again"); }
    finally { setBusy(false); }
  }
  if (connection.provider !== "google") return null;
  const button = "min-h-11 px-3 rounded-lg border border-cc-line bg-cc-cream text-sm disabled:opacity-50";
  return <div className="w-full space-y-2" aria-busy={busy}>
    {connection.last_sync_error && <p role="status" className="text-sm text-red-800">{connection.last_sync_error}</p>}
    <div className="flex flex-wrap gap-2">
      <button className={button} disabled={busy} onClick={() => request("sync")}>Sync now</button>
      <button className={button} disabled={busy} onClick={() => request("load")}>Choose calendar</button>
      <a className={`${button} inline-flex items-center`} href={`/api/calendar/google/connect?connection_id=${connection.id}&member_id=${connection.member_id}`}>Reconnect</a>
    </div>
    {calendars && <label className="block text-sm">Google calendar<select aria-label={`Google calendar for ${connection.calendar_name}`} disabled={busy} className="block w-full min-h-11 border border-cc-line rounded-lg px-2 mt-1" value={connection.calendar_external_id ?? "primary"} onChange={(e) => request("select", e.target.value)}>
      {!calendars.some((calendar) => calendar.id === connection.calendar_external_id) && <option value={connection.calendar_external_id ?? "primary"}>{connection.calendar_name || "Current calendar"}</option>}
      {calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}
    </select></label>}
    <p role="status" className="text-sm">{message}</p>
  </div>;
}
