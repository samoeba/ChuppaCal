"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ChoreRecurrence } from "@/lib/types";

export async function completeChore(
  templateId: string,
  memberId: string,
  familyId: string,
  date: string,
  starsEarned: number
) {
  const supabase = await createClient();
  const { error } = await supabase.from("chore_completions").insert({
    template_id: templateId,
    member_id: memberId,
    family_id: familyId,
    date,
    stars_earned: starsEarned,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/chores");
}

export async function uncompleteChore(templateId: string, memberId: string, date: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("chore_completions")
    .delete()
    .eq("template_id", templateId)
    .eq("member_id", memberId)
    .eq("date", date);
  if (error) throw new Error(error.message);
  revalidatePath("/chores");
}

export async function redeemReward(
  rewardId: string,
  memberId: string,
  familyId: string,
  starCost: number
) {
  const supabase = await createClient();
  const { error } = await supabase.from("star_redemptions").insert({
    reward_id: rewardId,
    member_id: memberId,
    family_id: familyId,
    stars_spent: starCost,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/chores");
}

export async function createChoreTemplate(
  familyId: string,
  data: { name: string; emoji: string; star_value: number; recurrence: ChoreRecurrence },
  memberIds: string[]
) {
  const supabase = await createClient();
  const { data: template, error } = await supabase
    .from("chore_templates")
    .insert({ ...data, family_id: familyId, active: true })
    .select("id")
    .single();
  if (error || !template) throw new Error(error?.message ?? "insert failed");
  if (memberIds.length > 0) {
    const { error: membersError } = await supabase.from("chore_template_members").insert(
      memberIds.map((mid) => ({ template_id: template.id, member_id: mid }))
    );
    if (membersError) throw new Error(membersError.message);
  }
  revalidatePath("/chores");
  revalidatePath("/settings");
}

export async function updateChoreTemplate(
  templateId: string,
  data: { name: string; emoji: string; star_value: number; recurrence: ChoreRecurrence },
  memberIds: string[]
) {
  const supabase = await createClient();
  const { error: updateError } = await supabase.from("chore_templates").update(data).eq("id", templateId);
  if (updateError) throw new Error(updateError.message);
  const { error: deleteError } = await supabase.from("chore_template_members").delete().eq("template_id", templateId);
  if (deleteError) throw new Error(deleteError.message);
  if (memberIds.length > 0) {
    const { error: insertError } = await supabase.from("chore_template_members").insert(
      memberIds.map((mid) => ({ template_id: templateId, member_id: mid }))
    );
    if (insertError) throw new Error(insertError.message);
  }
  revalidatePath("/chores");
  revalidatePath("/settings");
}

export async function deleteChoreTemplate(templateId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("chore_templates").update({ active: false }).eq("id", templateId);
  if (error) throw new Error(error.message);
  revalidatePath("/chores");
  revalidatePath("/settings");
}

export async function createStarReward(
  familyId: string,
  data: { name: string; emoji: string; star_cost: number }
) {
  const supabase = await createClient();
  const { error } = await supabase.from("star_rewards").insert({ ...data, family_id: familyId });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function updateStarReward(rewardId: string, data: { name: string; emoji: string; star_cost: number }) {
  const supabase = await createClient();
  const { error } = await supabase.from("star_rewards").update(data).eq("id", rewardId);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function deleteStarReward(rewardId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("star_rewards").delete().eq("id", rewardId);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function toggleChoresEnabled(memberId: string, enabled: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("family_members").update({ chores_enabled: enabled }).eq("id", memberId);
  if (error) throw new Error(error.message);
  revalidatePath("/chores");
  revalidatePath("/settings");
}
