"use client";
import { useEffect, useRef, useState } from "react";
import { useKioskMode } from "@/components/keyboard/use-kiosk-mode";
import { useFamilyRuntime } from "@/components/family-runtime";
import { isSleepTime } from "@/lib/kiosk-schedule";
import { zonedDate } from "@/lib/time-zone";
import { useDialog } from "@/lib/use-dialog";
import type { FamilySettings } from "@/lib/types";

type DisplaySettings = Pick<FamilySettings,"sleep_enabled"|"sleep_start"|"sleep_end"|"screensaver_enabled"|"screensaver_timeout_minutes">;
export default function KioskDisplay({ settings, photos }: { settings: DisplaySettings; photos: { name: string; avatar_url: string | null }[] }) {
  const kiosk = useKioskMode();
  const { timeZone } = useFamilyRuntime();
  const [mode, setMode] = useState<"sleep"|"idle"|null>(null);
  const [time, setTime] = useState("");
  const [photoIndex, setPhotoIndex] = useState(0);
  const lastInteraction = useRef(0);
  const wakeUntil = useRef(0);
  function wake() { lastInteraction.current = Date.now(); wakeUntil.current = Date.now() + 10*60_000; setMode(null); }
  const dialog = useDialog(mode !== null, wake);
  useEffect(() => {
    lastInteraction.current = Date.now();
    const interact = () => { lastInteraction.current = Date.now(); };
    const tick = () => {
      const now = zonedDate(Date.now(), timeZone);
      const clock = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
      setTime(now.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}));
      const editing = document.activeElement?.matches("input,textarea,select,[contenteditable=true]") || document.querySelector('[role="dialog"]:not([data-kiosk]),[aria-busy="true"]');
      if (!kiosk || editing || Date.now()<wakeUntil.current) { setMode(null); return; }
      if (settings.sleep_enabled && isSleepTime(clock,settings.sleep_start,settings.sleep_end)) setMode("sleep");
      else if (settings.screensaver_enabled && Date.now()-lastInteraction.current >= settings.screensaver_timeout_minutes*60_000) setMode("idle");
      else setMode(null);
    };
    tick();
    const timer = setInterval(tick,10_000);
    document.addEventListener("pointerdown",interact,{passive:true});
    document.addEventListener("keydown",interact);
    return () => { clearInterval(timer); document.removeEventListener("pointerdown",interact); document.removeEventListener("keydown",interact); };
  },[kiosk,timeZone,settings]);
  useEffect(() => {
    if (mode !== "idle" || !photos.length) return;
    const timer = setInterval(() => setPhotoIndex((index) => (index+1)%photos.length), 15_000);
    return () => clearInterval(timer);
  }, [mode, photos.length]);
  if (!mode) return null;
  const photo = mode === "idle" ? photos[photoIndex % Math.max(1,photos.length)] : null;
  return <div ref={dialog} role="dialog" aria-modal="true" aria-label={mode==="sleep" ? "Display sleeping" : "Idle clock"} data-kiosk tabIndex={-1} onKeyDown={wake} onPointerDown={(event) => { event.preventDefault(); wake(); }} className={`fixed inset-0 z-[100] flex flex-col items-center justify-center ${mode==="sleep" ? "bg-black text-neutral-500" : "bg-cc-ink text-cc-cream"}`}>
    {photo?.avatar_url && <div className="absolute inset-0 opacity-30 pointer-events-none overflow-hidden">
      {/* Family profile photos are already cropped to small JPEGs during upload. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.avatar_url} alt="" className="w-full h-full object-cover blur-xl scale-110" referrerPolicy="no-referrer" />
    </div>}
    {photo && <p className="relative text-lg mb-2">{photo.name}</p>}
    <p className="relative text-[clamp(4rem,14vw,12rem)] tabular-nums" style={{fontFamily:"var(--font-display)"}}>{time}</p>
    <button onClick={wake} className="min-h-11 px-5 rounded-full border border-current mt-6">Tap or press any key to wake</button>
    <p className="text-sm mt-3">{mode==="sleep" ? "Wakes for 10 minutes, then follows the sleep schedule." : "Ready when you are."}</p>
  </div>;
}
