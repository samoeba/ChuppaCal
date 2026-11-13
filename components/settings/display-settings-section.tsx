"use client";

import { useState } from "react";
import { updateDisplaySettings, type DisplaySettingsPatch } from "@/app/actions/settings";
import { DEFAULT_TIME_ZONE } from "@/lib/time-zone";
import type { FamilySettings } from "@/lib/types";
import { useServerState } from "@/lib/use-server-state";

export default function DisplaySettingsSection({ settings }: { settings: FamilySettings }) {
  const [saved, setSaved] = useServerState(settings);
  const [patch, setPatch] = useState<DisplaySettingsPatch>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const current = { ...saved, ...patch };
  async function save() {
    setBusy(true); setMessage("");
    try { setSaved(await updateDisplaySettings(patch)); setPatch({}); setMessage("Display settings saved."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save settings"); }
    finally { setBusy(false); }
  }
  const field = "block w-full min-h-11 rounded-xl border border-cc-line bg-cc-cream px-3 mt-1";
  return <section className="rounded-2xl bg-white p-6 mb-6" aria-busy={busy} data-unsaved={Object.keys(patch).length > 0}>
    <h2 className="text-lg font-bold mb-2">Family time & wall display</h2>
    <p className="text-sm text-cc-ink-dim mb-4">One timezone for calendars, meals and chore resets on every device. Sleep dims this app; it does not power off the screen. The idle clock cycles existing family profile photos when available.</p>
    <div className="grid sm:grid-cols-2 gap-4">
      <label className="sm:col-span-2">Family timezone
        <input list="family-timezones" className={field} value={current.time_zone ?? DEFAULT_TIME_ZONE} onChange={(e) => setPatch({ ...patch, time_zone: e.target.value })} />
        <datalist id="family-timezones">{["America/Chicago", "America/New_York", "America/Denver", "America/Los_Angeles", "America/Phoenix", "Pacific/Honolulu", "Europe/London", "UTC"].map((zone) => <option key={zone} value={zone} />)}</datalist>
      </label>
      <label className="flex items-center gap-3 min-h-11"><input type="checkbox" checked={current.sleep_enabled ?? false} onChange={(e) => setPatch({ ...patch, sleep_enabled: e.target.checked })} />Enable scheduled sleep</label>
      <label className="flex items-center gap-3 min-h-11"><input type="checkbox" checked={current.screensaver_enabled ?? false} onChange={(e) => setPatch({ ...patch, screensaver_enabled: e.target.checked })} />Enable idle clock</label>
      <label>Sleep starts<input type="time" className={field} value={current.sleep_start} onChange={(e) => setPatch({ ...patch, sleep_start: e.target.value })} /></label>
      <label>Wake time<input type="time" className={field} value={current.sleep_end} onChange={(e) => setPatch({ ...patch, sleep_end: e.target.value })} /></label>
      <label>Idle minutes<input type="number" min={1} max={60} className={field} value={current.screensaver_timeout_minutes} onChange={(e) => setPatch({ ...patch, screensaver_timeout_minutes: Number(e.target.value) })} /></label>
    </div>
    <button disabled={busy || Object.keys(patch).length === 0} onClick={save} className="mt-4 min-h-11 px-5 rounded-full bg-cc-ink text-white disabled:opacity-50">{busy ? "Saving…" : "Save display settings"}</button>
    <p role="status" className="mt-2 text-sm">{message}</p>
  </section>;
}
