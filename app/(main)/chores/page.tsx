import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChoresBoard from "@/components/chores/chores-board";
import { toDateString, startOfWeek } from "@/lib/chores";
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
  const today = new Date();
  const todayStr = toDateString(today);
  const weekStart = startOfWeek(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const [
    { data: members },
    { data: templates },
    { data: templateMembers },
    { data: completionsToday },
    { data: completionsWeek },
    { data: allCompletions },
    { data: rewards },
    { data: redemptions },
    { data: family },
  ] = await Promise.all([
    supabase
      .from("family_members")
      .select("*")
      .eq("family_id", familyId)
      .eq("role", "child")
      .eq("chores_enabled", true)
      .order("created_at"),
    supabase
      .from("chore_templates")
      .select("*")
      .eq("family_id", familyId)
      .eq("active", true),
    supabase.from("chore_template_members").select("*"),
    supabase
      .from("chore_completions")
      .select("*")
      .eq("family_id", familyId)
      .eq("date", todayStr),
    supabase
      .from("chore_completions")
      .select("*")
      .eq("family_id", familyId)
      .gte("date", toDateString(weekStart))
      .lte("date", toDateString(weekEnd)),
    supabase
      .from("chore_completions")
      .select("id,member_id,stars_earned,template_id,date,family_id,completed_at")
      .eq("family_id", familyId),
    supabase.from("star_rewards").select("*").eq("family_id", familyId).order("star_cost"),
    supabase.from("star_redemptions").select("*").eq("family_id", familyId),
    supabase.from("families").select("settings").eq("id", familyId).single(),
  ]);

  const allTMs = (templateMembers ?? []) as ChoreTemplateMember[];
  const allTemplates = (templates ?? []) as ChoreTemplate[];
  const templatesByMember: Record<string, ChoreTemplate[]> = {};
  for (const kid of members ?? []) {
    const ids = allTMs.filter((tm) => tm.member_id === kid.id).map((tm) => tm.template_id);
    templatesByMember[kid.id] = allTemplates.filter((t) => ids.includes(t.id));
  }

  const pinHash = (family as any)?.settings?.pin_hash ?? "0000";

  return (
    <ChoresBoard
      kids={(members ?? []) as FamilyMember[]}
      templatesByMember={templatesByMember}
      completionsToday={(completionsToday ?? []) as ChoreCompletion[]}
      completionsWeek={(completionsWeek ?? []) as ChoreCompletion[]}
      allCompletions={(allCompletions ?? []) as ChoreCompletion[]}
      rewards={(rewards ?? []) as StarReward[]}
      redemptions={(redemptions ?? []) as StarRedemption[]}
      familyId={familyId}
      familyPin={pinHash}
      today={todayStr}
      weekStartStr={toDateString(weekStart)}
    />
  );
}
