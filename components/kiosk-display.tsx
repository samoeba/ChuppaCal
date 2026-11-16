"use client";

import { useEffect, useRef, useState } from "react";
import { useKioskMode } from "@/components/keyboard/use-kiosk-mode";
import { useFamilyRuntime } from "@/components/family-runtime";
import { isSleepTime } from "@/lib/kiosk-schedule";
import { zonedDate } from "@/lib/time-zone";
import { useDialog } from "@/lib/use-dialog";
import type { FamilySettings } from "@/lib/types";

type DisplaySettings = Pick<FamilySettings, "sleep_enabled" | "sleep_start" | "sleep_end" | "screensaver_enabled" | "screensaver_timeout_minutes">;

export default function KioskDisplay({ settings, photos }: { settings: DisplaySettings; photos: string[] }) {
  const kiosk = useKioskMode();
  const { timeZone } = useFamilyRuntime();
  const { sleep_enabled: sleepEnabled, sleep_start: sleepStart, sleep_end: sleepEnd,
    screensaver_enabled: screensaverEnabled, screensaver_timeout_minutes: idleMinutes } = settings;
  const [mode, setMode] = useState<"sleep" | "idle" | null>(null);
  const [time, setTime] = useState("");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const lastInteraction = useRef(0);
  const sleepWakeUntil = useRef(0);

  function wake() {
    lastInteraction.current = Date.now();
    if (mode === "sleep") sleepWakeUntil.current = Date.now() + 10 * 60_000;
    setMode(null);
  }
  const sleeping = kiosk && sleepEnabled && mode === "sleep";
  const idle = kiosk && screensaverEnabled && mode === "idle";
  const open = Boolean(sleeping || idle);
  const dialog = useDialog(open, wake);

  useEffect(() => {
    lastInteraction.current = Date.now();
    const interact = () => { lastInteraction.current = Date.now(); };
    document.addEventListener("pointerdown", interact, { passive: true });
    document.addEventListener("pointermove", interact, { passive: true });
    document.addEventListener("wheel", interact, { passive: true });
    document.addEventListener("keydown", interact);
    return () => {
      document.removeEventListener("pointerdown", interact);
      document.removeEventListener("pointermove", interact);
      document.removeEventListener("wheel", interact);
      document.removeEventListener("keydown", interact);
    };
  }, []);

  useEffect(() => {
    if (!kiosk || (!sleepEnabled && !screensaverEnabled)) return;
    const tick = () => {
      const timestamp = Date.now();
      const now = zonedDate(timestamp, timeZone);
      const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      setTime(now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
      const editing = document.activeElement?.matches("input,textarea,select,[contenteditable=true]") ||
        document.querySelector('[role="dialog"]:not([data-kiosk]),[aria-busy="true"],[data-unsaved="true"]');
      if (editing) { setMode(null); return; }
      if (sleepEnabled && isSleepTime(clock, sleepStart, sleepEnd)) {
        setMode(timestamp >= sleepWakeUntil.current ? "sleep" : null);
      } else {
        setMode(screensaverEnabled && timestamp - lastInteraction.current >= (idleMinutes ?? 5) * 60_000 ? "idle" : null);
      }
    };
    const timer = setInterval(tick, 1_000);
    return () => clearInterval(timer);
  }, [kiosk, timeZone, sleepEnabled, sleepStart, sleepEnd, screensaverEnabled, idleMinutes]);

  useEffect(() => {
    if (!idle || photos.length < 2) return;
    const timer = setInterval(() => setPhotoIndex((index) => (index + 1) % photos.length), 15_000);
    return () => clearInterval(timer);
  }, [idle, photos.length]);

  if (!open) return null;
  const photo = idle && photos.length ? photos[photoIndex % photos.length] : null;
  const showPhoto = photo && photo !== failedPhoto;
  return (
    <div ref={dialog} role="dialog" aria-modal="true" aria-label={sleeping ? "Display sleeping" : "Family photo screensaver"}
      data-kiosk tabIndex={-1} onKeyDown={(event) => { event.preventDefault(); event.stopPropagation(); wake(); }}
      onClick={wake}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center select-none ${sleeping ? "bg-black text-neutral-500" : "bg-cc-ink text-cc-cream"}`}>
      {showPhoto && (
        <div key={photo} className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" draggable={false}
            className="absolute -inset-24 size-[calc(100%+12rem)] max-w-none object-cover blur-[32px]" />
          <div aria-hidden="true" className="absolute inset-0 bg-black/20" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" draggable={false} onError={() => setFailedPhoto(photo)}
            className="absolute top-0 left-1/2 h-full w-auto max-w-none -translate-x-1/2" />
        </div>
      )}
      <p className={`tabular-nums ${showPhoto ? "absolute right-4 bottom-4 text-[min(7.5rem,12vw,20vh)] leading-none whitespace-nowrap [text-shadow:0_2px_6px_#000c,0_6px_24px_#0009] sm:right-6 sm:bottom-5" : "text-[clamp(4rem,14vw,12rem)]"}`}
        style={{ fontFamily: "var(--font-display)" }}>{time}</p>
      {sleeping && (
        <>
          <button type="button" className="mt-6 min-h-11 rounded-full border border-current px-5">
            Tap or press any key to return
          </button>
          <p className="text-sm mt-3">Wakes for 10 minutes, then follows the sleep schedule.</p>
        </>
      )}
    </div>
  );
}
