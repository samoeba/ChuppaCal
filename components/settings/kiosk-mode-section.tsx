// components/settings/kiosk-mode-section.tsx
"use client";

import { useState } from "react";
import { setKioskMode } from "@/components/keyboard/use-kiosk-mode";

function getInitialEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("chuppacal_kiosk") === "1";
  } catch {
    return false;
  }
}

export default function KioskModeSection() {
  const [enabled, setEnabled] = useState<boolean>(getInitialEnabled);

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    setKioskMode(next);
  }

  return (
    <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Kiosk Mode</h2>
      <p className="text-sm text-slate-400 mb-4">
        Enables the on-screen keyboard for touchscreen-only devices like the wall display.
        Phones using the same URL keep their native keyboard.
      </p>
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-700">On-screen keyboard</span>
        <button
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          className={`relative w-12 h-6 rounded-full transition-colors touch-manipulation ${
            enabled ? "bg-clover" : "bg-slate-200"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </section>
  );
}
