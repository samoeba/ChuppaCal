"use client";
import { useEffect, useState } from "react";

const KEY = "chuppacal-offline-today-v1";
type Snapshot = { userId: string; familyId: string; date: string; dinner: string | null; events: string[]; chores: string[] };
export function clearOfflineSnapshot() { try { localStorage.removeItem(KEY); } catch {} }
export default function OfflineSnapshot({ snapshot }: { snapshot: Snapshot }) {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    try {
      const old = JSON.parse(localStorage.getItem(KEY) || "null");
      if (old && (old.userId !== snapshot.userId || old.familyId !== snapshot.familyId)) { clearOfflineSnapshot(); return; }
      if (old) {
        localStorage.setItem(KEY, JSON.stringify({ ...snapshot, savedAt: Date.now() }));
        setEnabled(true);
      }
    } catch { /* storage disabled */ }
  }, [snapshot]);
  async function toggle() {
    if (enabled) { clearOfflineSnapshot(); setEnabled(false); setMessage("Saved data removed from this device."); return; }
    if (!confirm("Save a read-only Today snapshot on this device? Anyone using this browser while offline can see event titles, dinner and chore names.")) return;
    try {
      if (!("serviceWorker" in navigator)) throw new Error("This browser does not support offline pages.");
      await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      localStorage.setItem(KEY, JSON.stringify({ ...snapshot, savedAt: Date.now() }));
      setEnabled(true); setMessage("Today is saved on this device for read-only offline use.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Offline saving is unavailable."); }
  }
  return <div className="rounded-2xl border border-cc-line p-4 text-sm"><button onClick={toggle} className="min-h-11 px-3 rounded-full bg-cc-cream font-bold">{enabled ? "Remove offline copy" : "Save a read-only offline copy"}</button><p role="status" className="mt-2 text-cc-ink-dim">{message || (enabled ? "Saved on this browser; updates when Today loads online. Anyone using this browser offline can view it." : "Optional · saves event, meal and chore names on this browser for up to seven days. No edits offline.")}</p></div>;
}
