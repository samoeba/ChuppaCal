"use client";

import { useEffect, useMemo, useState } from "react";
import DayView from "@/components/calendar/day-view";
import MemberLegend from "@/components/calendar/member-legend";
import MonthView from "@/components/calendar/month-view";
import WeekView from "@/components/calendar/week-view";
import type { EventWithMember } from "@/lib/calendar";
import type { FamilyMember } from "@/lib/types";

const STORAGE_KEY = "chuppacal_calendar_hidden_members";

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
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setHiddenIds(new Set(loadHidden()));
  }, []);

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
