import Link from "next/link";
import { loadFamily } from "@/lib/load-family";
import { familyTimeZone, zonedDate } from "@/lib/time-zone";
import { addDays, dayLabel, eventOccursOnDay, formatTimeLong, startOfDay, toDateParam, type EventWithMember } from "@/lib/calendar";
import { expectationsForDay } from "@/lib/chores";
import { readAllRows } from "@/lib/pagination";
import type { CalendarEvent, ChoreCompletion, ChoreTemplate, ChoreTemplateMember, FamilyMember, MealPlan } from "@/lib/types";
import TodayClock from "@/components/today-clock";
import OfflineSnapshot from "@/components/offline-snapshot";

export default async function TodayPage() {
  const { supabase, family, userId } = await loadFamily();
  const timeZone = familyTimeZone(family.settings.time_zone);
  const now = zonedDate(new Date(), timeZone);
  const today = toDateParam(now);
  const start = startOfDay(now);
  const end = addDays(start, 1);
  const [members, events, templates, assignments, completions, meals, connections] = await Promise.all([
    readAllRows<FamilyMember>((a,b) => supabase.from("family_members").select("*").eq("family_id",family.id).order("id").range(a,b)),
    readAllRows<CalendarEvent>((a,b) => supabase.from("calendar_events").select("*").eq("family_id",family.id).gte("end_time",new Date(+start-86400000).toISOString()).lt("start_time",new Date(+end+86400000).toISOString()).order("start_time").order("id").range(a,b)),
    readAllRows<ChoreTemplate>((a,b) => supabase.from("chore_templates").select("*").eq("family_id",family.id).eq("active",true).order("id").range(a,b)),
    readAllRows<ChoreTemplateMember>((a,b) => supabase.from("chore_template_members").select("*").order("template_id").order("member_id").range(a,b)),
    readAllRows<ChoreCompletion>((a,b) => supabase.from("chore_completions").select("*").eq("family_id",family.id).eq("date",today).order("id").range(a,b)),
    readAllRows<MealPlan>((a,b) => supabase.from("meal_plans").select("*").eq("family_id",family.id).eq("date",today).order("id").range(a,b)),
    supabase.from("calendar_connections").select("last_synced_at,last_sync_error").eq("family_id",family.id),
  ]);
  if (connections.error) throw new Error("Could not load calendar status");
  const todayEvents = events.map((event) => ({ ...event, member: members.find((m) => m.id===event.member_id) ?? null } as EventWithMember)).filter((event) => eventOccursOnDay(event, now));
  const next = todayEvents.filter((event) => !event.all_day && +new Date(event.end_time) >= +now).slice(0,4);
  const allDay = todayEvents.filter((event) => event.all_day);
  const dinner = meals.find((meal) => meal.slot === "dinner");
  const stale = connections.data?.some((connection) => connection.last_sync_error || !connection.last_synced_at || +now-new Date(connection.last_synced_at).getTime()>20*60_000);
  return <div className="max-w-6xl mx-auto space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="text-sm uppercase tracking-widest text-cc-ink-dim">{dayLabel(now)}</p>
        <h1 className="text-display-xl text-sky mt-2 wrap-anywhere" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(3rem,7vw,6rem)", lineHeight: 1 }}>
          Hello, {family.name.trim() || "today"}.
        </h1>
      </div>
      <div className="text-right"><p className="text-4xl font-bold"><TodayClock /></p><p className="text-sm text-cc-ink-dim mt-2">{timeZone.replaceAll("_", " ")}</p></div>
    </header>
    {stale && <p role="status" className="rounded-xl bg-sun/30 px-4 py-3">Calendar updates are delayed. <Link className="underline font-bold" href="/settings">Check sync status</Link></p>}
    <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5">
      <section className="rounded-3xl bg-white border border-cc-line p-6"><div className="flex justify-between gap-3"><h2 className="text-2xl font-bold">Coming up</h2><Link className="underline min-h-11" href="/calendar">Calendar →</Link></div>
        {allDay.map((event) => <p key={event.id} className="rounded-xl bg-sun/25 p-3 mb-2">All day · {event.title}</p>)}
        {next.length ? <ol className="divide-y divide-cc-line">{next.map((event) => <li key={event.id} className="py-4 flex gap-4">
          <p className="text-sm font-bold min-w-20">{formatTimeLong(zonedDate(event.start_time,timeZone))}</p><div className="min-w-0"><h3 className="text-xl font-bold break-words">{event.title}</h3><p className="text-sm text-cc-ink-dim mt-1">{[event.member?.name,event.location].filter(Boolean).join(" · ")}</p></div>
        </li>)}</ol> : <p className="text-cc-ink-dim py-8">{todayEvents.length ? "Nothing else timed today." : "Room for a little spontaneity."}</p>}
      </section>
      <section className="rounded-3xl bg-cc-cream border border-cc-line p-6 flex flex-col"><h2 className="text-2xl font-bold">What’s for dinner?</h2><p className="text-5xl mt-8 mb-3" aria-hidden="true">{dinner?.emoji ?? "🍽️"}</p><p className="text-3xl font-bold mb-8">{dinner?.name ?? "Make a plan together."}</p><Link className="underline mt-auto min-h-11" href="/meals">{dinner ? "See the meal plan" : "Plan dinner"} →</Link></section>
    </div>
    <section><div className="flex justify-between gap-3 mb-3"><h2 className="text-2xl font-bold">A little teamwork</h2><Link className="underline min-h-11" href="/chores">Chores & stars →</Link></div><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {members.filter((member) => member.role==="child" && member.chores_enabled).map((kid) => {
        const ids = new Set(assignments.filter((assignment) => assignment.member_id===kid.id).map((assignment) => assignment.template_id));
        const due = expectationsForDay(templates.filter((template) => ids.has(template.id)),now);
        const remaining = due.filter((template) => !completions.some((completion) => completion.template_id===template.id && completion.member_id===kid.id));
        return <Link key={kid.id} href="/chores" className="rounded-2xl bg-white border border-cc-line p-5" style={{ borderTop: `6px solid ${kid.color}` }}><h3 className="text-xl font-bold">{kid.avatar_emoji} {kid.name}</h3><p className="mt-2 font-bold">{remaining.length ? `${remaining.length} of ${due.length} to go` : "All set!"}</p><p className="text-sm text-cc-ink-dim mt-2">{remaining.slice(0,3).map((template) => template.name).join(" · ") || "Expectations complete. Extra work is ready."}</p></Link>;
      })}
    </div></section>
    <OfflineSnapshot snapshot={{ userId, familyId: family.id, date: today, dinner: dinner?.name ?? null,
      events: todayEvents.map((event) => `${event.all_day ? "All day" : formatTimeLong(zonedDate(event.start_time,timeZone))} · ${event.title}`),
      chores: members.filter((member) => member.role==="child").map((kid) => {
        const ids = new Set(assignments.filter((assignment) => assignment.member_id===kid.id).map((assignment) => assignment.template_id));
        const due = expectationsForDay(templates.filter((template) => ids.has(template.id)),now);
        const remaining = due.filter((template) => !completions.some((completion) => completion.template_id===template.id && completion.member_id===kid.id));
        return `${kid.name}: ${remaining.length} remaining${remaining.length ? ` · ${remaining.map((template) => template.name).join(", ")}` : ""}`;
      }) }} />
  </div>;
}
