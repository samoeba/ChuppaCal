// components/keyboard/use-kiosk-mode.ts
"use client";

import { useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "chuppacal_kiosk";
let fallbackFlag = false;

function readFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return fallbackFlag;
  }
}

function writeFlag(on: boolean): void {
  fallbackFlag = on;
  try {
    if (on) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable (private mode, etc) — silently ignore
  }
}

// Storage subscriptions keep render pure and the server snapshot hydration-safe.
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("chuppacal-kiosk-changed", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("chuppacal-kiosk-changed", callback);
  };
}

/**
 * Returns true when kiosk mode is active.
 *
 * Activation rules (in order, evaluated once at mount):
 * 1. URL has `?kiosk=1` -> set flag and return true (kiosk URL is master switch).
 * 2. URL has `?kiosk=0` -> clear flag and return false (recovery URL).
 * 3. Otherwise read `localStorage.chuppacal_kiosk`.
 *
 * Returns false during SSR. Subscribes to the `storage` event so cross-tab
 * toggles propagate, plus a custom event for same-tab toggles triggered by
 * the settings switch — both fire setState only from event handlers.
 */
export function useKioskMode(): boolean {
  const active = useSyncExternalStore(subscribe, readFlag, () => false);
  useEffect(() => {
    const param = new URL(window.location.href).searchParams.get("kiosk");
    if (param === "1" || param === "0") setKioskMode(param === "1");
  }, []);

  return active;
}

/**
 * Imperative setter used by the settings toggle.
 * Writes localStorage AND fires a custom event so other tabs / providers
 * pick up the change without waiting for a re-mount.
 */
export function setKioskMode(on: boolean): void {
  writeFlag(on);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("chuppacal-kiosk-changed"));
  }
}
