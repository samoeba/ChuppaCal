"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Keep a continuously visible wall current without interrupting an active edit. */
export default function RefreshData() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    let lastRefresh = Date.now();
    let lastInteraction = 0;
    let invalidated = false;
    const interact = () => { lastInteraction = Date.now(); };
    function refresh() {
      const now = Date.now();
      if (pathname === "/settings" && !invalidated) return;
      if (document.visibilityState !== "visible" || now - lastRefresh < (invalidated ? 1_000 : 60_000) || now - lastInteraction < (invalidated ? 2_000 : 30_000)) return;
      if (document.activeElement?.matches("input,textarea,select,[contenteditable=true]") || document.querySelector('[role="dialog"],[aria-busy="true"],[data-unsaved="true"]')) return;
      lastRefresh = now;
      invalidated = false;
      if (pathname === "/settings") window.dispatchEvent(new Event("chuppacal-refresh-settings"));
      router.refresh();
    }
    const changed = () => { invalidated = true; };
    const interval = window.setInterval(refresh, 5_000);
    window.addEventListener("chuppacal-data-changed", changed);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    document.addEventListener("pointerdown", interact, { passive: true });
    document.addEventListener("keydown", interact);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("chuppacal-data-changed", changed);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
      document.removeEventListener("pointerdown", interact);
      document.removeEventListener("keydown", interact);
    };
  }, [router, pathname]);
  return null;
}
