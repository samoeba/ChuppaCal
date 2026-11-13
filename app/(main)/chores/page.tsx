import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChoresBoard from "@/components/chores/chores-board";
import { toDateString, startOfWeek } from "@/lib/chores";
import { readAllRows } from "@/lib/pagination";
import { loadFamily } from "@/lib/load-family";
import { familyTimeZone, zonedDate } from "@/lib/time-zone";
import { addDays } from "@/lib/calendar";
import type {
  ChoreCompletion,
  ChoreTemplate,
  ChoreTemplateMember,
  FamilyMember,
  StarRedemption,
  StarReward,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ChoresPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: selfMember } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .single();
  if (!selfMember) redirect("/onboarding");

  const familyId = selfMember.family_id;
  const { family } = await loadFamily();
  const today = zonedDate(new Date(), familyTimeZone(family.settings.time_zone));
  const todayStr = toDateString(today);
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);

  const [
    members,
    templates,
    templateMembers,
    completionsToday,
    completionsWeek,
    allCompletions,
    rewards,
    redemptions,
  ] = await Promise.all([
    readAllRows<FamilyMember>((from, to) => supabase
      .from("family_members")
      .select("*")
      .eq("family_id", familyId)
      .eq("role", "child")
      .eq("chores_enabled", true)
      .order("created_at").order("id").range(from, to)),
    readAllRows<ChoreTemplate>((from, to) => supabase
      .from("chore_templates")
      .select("*")
      .eq("family_id", familyId)
      .eq("active", true).order("id").range(from, to)),
    readAllRows<ChoreTemplateMember>((from, to) => supabase.from("chore_template_members").select("*").order("template_id").order("member_id").range(from, to)),
    readAllRows<ChoreCompletion>((from, to) => supabase
      .from("chore_completions")
      .select("*")
      .eq("family_id", familyId)
      .eq("date", todayStr).order("id").range(from, to)),
    readAllRows<ChoreCompletion>((from, to) => supabase
      .from("chore_completions")
      .select("*")
      .eq("family_id", familyId)
      .gte("date", toDateString(weekStart))
      .lte("date", toDateString(weekEnd)).order("id").range(from, to)),
    readAllRows<ChoreCompletion>((from, to) => supabase
      .from("chore_completions")
      .select("*")
      .eq("family_id", familyId).order("id").range(from, to)),
    readAllRows<StarReward>((from, to) => supabase.from("star_rewards").select("*").eq("family_id", familyId).order("star_cost").order("id").range(from, to)),
    readAllRows<StarRedemption>((from, to) => supabase.from("star_redemptions").select("*").eq("family_id", familyId).order("id").range(from, to)),
  ]);

  const allTemplates = (templates ?? []) as ChoreTemplate[];
  const expectations = allTemplates.filter((t) => t.category === "expectation");
  const jobs = allTemplates.filter((t) => t.category === "extra_work");

  const familyTemplateIds = new Set(allTemplates.map((t) => t.id));
  const allTMs = ((templateMembers ?? []) as ChoreTemplateMember[]).filter(
    (tm) => familyTemplateIds.has(tm.template_id)
  );

  const todayCompletions = (completionsToday ?? []) as ChoreCompletion[];

  // Expectations only. Extra work has no chore_template_members rows by design,
  // so this filter is belt-and-braces against a stray assignment.
  const templatesByMember: Record<string, ChoreTemplate[]> = {};
  for (const kid of members ?? []) {
    const ids = allTMs.filter((tm) => tm.member_id === kid.id).map((tm) => tm.template_id);
    templatesByMember[kid.id] = expectations.filter((t) => ids.includes(t.id));
  }

  const claimsToday = todayCompletions.filter((c) => c.category === "extra_work");

  type FamilyRow = { settings: { pin_hash: string | null } };
  const pinHash = ((family as FamilyRow | null)?.settings?.pin_hash) ?? "";

  return (
    <ChoresBoard
      kids={(members ?? []) as FamilyMember[]}
      templatesByMember={templatesByMember}
      completionsToday={todayCompletions.filter((c) => c.category === "expectation")}
      completionsWeek={(completionsWeek ?? []) as ChoreCompletion[]}
      allCompletions={(allCompletions ?? []) as ChoreCompletion[]}
      rewards={(rewards ?? []) as StarReward[]}
      redemptions={(redemptions ?? []) as StarRedemption[]}
      jobs={jobs}
      claimsToday={claimsToday}
      familyId={familyId}
      familyPin={pinHash}
      today={todayStr}
      weekStartStr={toDateString(weekStart)}
    />
  );
}
