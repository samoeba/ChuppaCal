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
} from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";
import type { CalendarEvent, Family, FamilyMember } from "@/lib/types";

type SearchParams = Promise<{ view?: string; date?: string }>;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const view = parseView(params.view);
  const date = parseDate(params.date);

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

  const [familyRes, membersRes, eventsRes] = await Promise.all([
    supabase.from("families").select("*").eq("id", familyId).single(),
    supabase
      .from("family_members")
      .select("*")
      .eq("family_id", familyId)
      .order("created_at"),
    supabase
      .from("calendar_events")
      .select("*")
      .eq("family_id", familyId)
      .gte("start_time", start.toISOString())
      .lt("start_time", end.toISOString())
      .order("start_time"),
  ]);

  const family = familyRes.data as Family | null;
  const members = (membersRes.data ?? []) as FamilyMember[];
  const events = (eventsRes.data ?? []) as CalendarEvent[];

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

      <CalendarHeader view={view} date={date} />

      <CalendarBody view={view} date={date} members={members} events={enriched} />
    </div>
  );
}
