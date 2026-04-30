// components/keyboard/use-kiosk-mode.ts
"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "chuppacal_kiosk";

function readFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeFlag(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable (private mode, etc) — silently ignore
  }
}

/**
 * Computes the initial kiosk-mode state at mount, processing any
 * `?kiosk=1` / `?kiosk=0` URL param (which also writes to localStorage).
 * Runs once via `useState` lazy initializer; returns false during SSR.
 */
function getInitialActive(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  const param = url.searchParams.get("kiosk");
  if (param === "1") {
    writeFlag(true);
    return true;
  }
  if (param === "0") {
    writeFlag(false);
    return false;
  }
  return readFlag();
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
  const [active, setActive] = useState<boolean>(getInitialActive);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setActive(readFlag());
    };
    const onCustom = () => setActive(readFlag());

    window.addEventListener("storage", onStorage);
    window.addEventListener("chuppacal-kiosk-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("chuppacal-kiosk-changed", onCustom);
    };
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
