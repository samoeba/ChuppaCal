"use client";

import { useMemo, useSyncExternalStore } from "react";
import DayView from "@/components/calendar/day-view";
import MemberLegend from "@/components/calendar/member-legend";
import MonthView from "@/components/calendar/month-view";
import WeekView from "@/components/calendar/week-view";
import AgendaView from "@/components/calendar/agenda-view";
import type { EventWithMember } from "@/lib/calendar";
import type { FamilyMember } from "@/lib/types";
import { useFamilyRuntime } from "@/components/family-runtime";
import { zonedDate } from "@/lib/time-zone";

const STORAGE_KEY = "chuppacal_calendar_hidden_members";
let fallbackHidden = "[]";

function loadHidden(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return fallbackHidden;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("chuppacal-filter-changed", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("chuppacal-filter-changed", callback);
  };
}

function parseHidden(raw: string): Set<string> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch { return new Set(); }
}

export default function CalendarBody({
  view,
  date: instant,
  members,
  events,
}: {
  view: "week" | "day" | "month";
  date: Date;
  members: FamilyMember[];
  events: EventWithMember[];
}) {
  const { timeZone } = useFamilyRuntime();
  const date = zonedDate(instant, timeZone);
  const hiddenRaw = useSyncExternalStore(subscribe, loadHidden, () => "[]");
  const hiddenIds = useMemo(() => parseHidden(hiddenRaw), [hiddenRaw]);

  function toggle(id: string) {
      const next = new Set(hiddenIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      fallbackHidden = JSON.stringify([...next]);
      try {
        window.localStorage.setItem(STORAGE_KEY, fallbackHidden);
      } catch {
        // ignore quota / disabled storage
      }
      window.dispatchEvent(new Event("chuppacal-filter-changed"));
  }

  const filtered = useMemo(
    () => events.filter((ev) => !ev.member_id || !hiddenIds.has(ev.member_id)),
    [events, hiddenIds]
  );

  return (
    <>
      {view === "week" && <><div className="md:hidden"><AgendaView date={date} events={filtered} /></div><div className="hidden md:block"><WeekView date={date} events={filtered} /></div></>}
      {view === "day" && <DayView date={date} events={filtered} />}
      {view === "month" && <MonthView date={date} events={filtered} />}
      <MemberLegend members={members} hiddenIds={hiddenIds} onToggle={toggle} />
    </>
  );
}
