"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DayView from "@/components/calendar/day-view";
import MemberLegend from "@/components/calendar/member-legend";
import MonthView from "@/components/calendar/month-view";
import WeekView from "@/components/calendar/week-view";
import type { EventWithMember } from "@/lib/calendar";
import type { FamilyMember } from "@/lib/types";

const STORAGE_KEY = "chuppacal_calendar_hidden_members";

// Throttle refetches so a flurry of focus/visibility events doesn't hammer
// the DB. Sync runs every ~5 min anyway, so 30s is plenty.
const REFRESH_COOLDOWN_MS = 30_000;

function loadHidden(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default function CalendarBody({
  view,
  date,
  members,
  events,
}: {
  view: "week" | "day" | "month";
  date: Date;
  members: FamilyMember[];
  events: EventWithMember[];
}) {
  const router = useRouter();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setHiddenIds(new Set(loadHidden()));
  }, []);

  // Refresh server data when the kiosk wakes up or someone returns to the tab.
  useEffect(() => {
    let lastRefresh = Date.now();

    function maybeRefresh() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh < REFRESH_COOLDOWN_MS) return;
      lastRefresh = now;
      router.refresh();
    }

    document.addEventListener("visibilitychange", maybeRefresh);
    window.addEventListener("focus", maybeRefresh);
    return () => {
      document.removeEventListener("visibilitychange", maybeRefresh);
      window.removeEventListener("focus", maybeRefresh);
    };
  }, [router]);

  function toggle(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // ignore quota / disabled storage
      }
      return next;
    });
  }

  const filtered = useMemo(
    () => events.filter((ev) => !ev.member_id || !hiddenIds.has(ev.member_id)),
    [events, hiddenIds]
  );

  return (
    <>
      {view === "week" && <WeekView date={date} events={filtered} />}
      {view === "day" && <DayView date={date} events={filtered} />}
      {view === "month" && <MonthView date={date} events={filtered} />}
      <MemberLegend members={members} hiddenIds={hiddenIds} onToggle={toggle} />
    </>
  );
}
