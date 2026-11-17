"use client";

import { useState } from "react";
import { MAX_GOOGLE_CALENDARS_PER_ADD, type CalendarConnectionSummary, type GoogleCalendarChoice } from "@/lib/types";

export default function CalendarConnectionControls({ connection, onChanged }: { connection: CalendarConnectionSummary; onChanged: () => void }) {
  const [calendars, setCalendars] = useState<GoogleCalendarChoice[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const path = `/api/calendar/connections/${connection.id}`;
  const available = calendars?.filter((calendar) => !calendar.connected) ?? [];

  async function request(action: "load" | "sync" | "add") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${path}/${action === "sync" ? "sync" : "calendars"}`, action === "load" ? undefined : {
        method: "POST",
        ...(action === "add" ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendar_ids: selected }),
        } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 429 ? "Sync is running or was just attempted. Wait 30 seconds and retry." : data.error || "Could not update calendars.");

      if (action === "load") {
        setCalendars(data.calendars);
        setSelected([]);
      } else {
        if (action === "add") {
          const count = data.added.length;
          setMessage(count === 0 ? "The selected calendars are already connected." :
            count === 1 ? "1 calendar added. Its events will appear after it syncs." :
              `${count} calendars added. Their events will appear after they sync.`);
          setCalendars(null);
          setSelected([]);
        } else {
          setMessage("Calendar is up to date.");
        }
        onChanged();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (connection.provider !== "google") return null;
  const button = "min-h-11 px-3 rounded-lg border border-cc-line bg-cc-cream text-sm disabled:opacity-50";
  return <div className="w-full space-y-2" aria-busy={busy}>
    {connection.last_sync_error && <p role="status" className="text-sm text-red-800">{connection.last_sync_error}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className={button} disabled={busy} onClick={() => request("sync")}>Sync now</button>
      <button type="button" className={button} disabled={busy} aria-expanded={calendars !== null} onClick={() => {
        if (calendars) { setCalendars(null); setMessage(""); setSelected([]); }
        else void request("load");
      }}>{calendars ? "Close calendar list" : "Add calendars"}</button>
      <a className={`${button} inline-flex items-center`} href={`/api/calendar/google/connect?connection_id=${connection.id}&member_id=${connection.member_id}`}>Reconnect</a>
    </div>
    {calendars && <fieldset disabled={busy} className="space-y-2 rounded-lg border border-cc-line p-3">
      <legend className="px-1 text-sm font-semibold">Calendars in this Google account</legend>
      {calendars.length === 0 ? <p className="text-sm">Google returned no calendars with event access.</p> : <>
        <p className="text-sm">{available.length ? "Choose which calendars to show on your family calendar." : "All available calendars are already connected."}</p>
        {available.length > 1 && available.length <= MAX_GOOGLE_CALENDARS_PER_ADD &&
          <button type="button" className={button} onClick={() => setSelected(selected.length === available.length ? [] : available.map(({ id }) => id))}>
            {selected.length === available.length ? "Clear selection" : "Select all available"}
          </button>}
        {available.length > MAX_GOOGLE_CALENDARS_PER_ADD && <p className="text-sm">Add up to {MAX_GOOGLE_CALENDARS_PER_ADD} calendars at a time.</p>}
        <div className="max-h-64 overflow-y-auto divide-y divide-cc-line">
          {calendars.map(({ id, name, primary, connected }) => {
            const checked = selected.includes(id);
            return <label key={id} className="flex min-h-11 items-center gap-2 py-1 text-sm">
              <input type="checkbox" className="size-4 shrink-0" checked={connected || checked}
                disabled={connected || (!checked && selected.length >= MAX_GOOGLE_CALENDARS_PER_ADD)}
                onChange={(event) => {
                  const isChecked = event.target.checked;
                  setSelected((previous) => isChecked ? [...previous, id] : previous.filter((value) => value !== id));
                }} />
              <span className="min-w-0 break-words">{name}{primary ? " · Primary" : ""}{connected ? " · Already connected" : ""}</span>
            </label>;
          })}
        </div>
        {available.length > 0 && <button type="button" className={button} disabled={!selected.length} onClick={() => request("add")}>
          {selected.length ? `Add ${selected.length} ${selected.length === 1 ? "calendar" : "calendars"}` : "Add selected calendars"}
        </button>}
      </>}
    </fieldset>}
    <p role="status" className="text-sm">{message}</p>
  </div>;
}
