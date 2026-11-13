import { redirect } from "next/navigation";
import { Suspense } from "react";
import CalendarBody from "@/components/calendar/calendar-body";
import CalendarHeader from "@/components/calendar/calendar-header";
import WeatherBar from "@/components/calendar/weather-bar";
import {
  type EventWithMember,
  parseDate,
  parseView,
  rangeForView,
  toDateParam,
} from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";
import { readAllRows } from "@/lib/pagination";
import type { CalendarEvent, FamilyMember } from "@/lib/types";
import { loadFamily } from "@/lib/load-family";
import { familyTimeZone } from "@/lib/time-zone";

type SearchParams = Promise<{ view?: string; date?: string }>;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const view = parseView(params.view);
  const { family } = await loadFamily();
  const timeZone = familyTimeZone(family.settings.time_zone);
  const date = parseDate(params.date, timeZone);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: viewer } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .single();

  if (!viewer) redirect("/onboarding");

  const familyId = viewer.family_id as string;

  const { start, end } = rangeForView(view, date);
  // All-day values encode civil dates at UTC midnight, while timed events are instants.
  // Query their union and let the day buckets apply precise, exclusive boundaries.
  const queryStart = new Date(Math.min(+start, +new Date(toDateParam(start) + "T00:00:00Z")));
  const queryEnd = new Date(Math.max(+end, +new Date(toDateParam(end) + "T00:00:00Z")));

  const [membersRes, events] = await Promise.all([
    supabase
      .from("family_members")
      .select("*")
      .eq("family_id", familyId)
      .order("created_at"),
    readAllRows<CalendarEvent>((from, to) => supabase
      .from("calendar_events")
      .select("*")
      .eq("family_id", familyId)
      .gte("end_time", queryStart.toISOString())
      .lt("start_time", queryEnd.toISOString())
      .order("start_time").order("id").range(from, to)),
  ]);
  if (membersRes.error) throw new Error("Could not load the family calendar");
  const members = (membersRes.data ?? []) as FamilyMember[];

  const membersById = new Map(members.map((m) => [m.id, m]));
  const enriched: EventWithMember[] = events.map((ev) => ({
    ...ev,
    member: ev.member_id ? membersById.get(ev.member_id) ?? null : null,
  }));

  const weatherLocation = family?.settings?.weather_location ?? "";

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Suspense fallback={<div className="text-caption">Loading weather…</div>}>
          <WeatherBar location={weatherLocation} />
        </Suspense>
      </div>

      <CalendarHeader view={view} date={new Date(+date)} />

      <CalendarBody view={view} date={new Date(+date)} members={members} events={enriched} />
    </div>
  );
}
