"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/family-context";
import { requireBoolean, requireDate, requireId, requireInteger, requireRecurrence, requireText } from "@/lib/validation";
import type { ChoreCategory, ChoreCompletion, ChoreRecurrence } from "@/lib/types";

export async function completeChore(templateId: string, memberId: string, familyId: string, date: string) {
  const { supabase } = await requireFamilyContext(familyId);
  const { data, error } = await supabase.rpc("cc_complete_chore", {
    p_template_id: requireId(templateId), p_member_id: requireId(memberId), p_date: requireDate(date),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/chores");
  revalidatePath("/today");
  return data as ChoreCompletion;
}

export async function uncompleteChore(templateId: string, memberId: string, date: string) {
  const { supabase } = await requireFamilyContext();
  const { error } = await supabase.rpc("cc_uncomplete_chore", {
    p_template_id: requireId(templateId), p_member_id: requireId(memberId), p_date: requireDate(date),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/chores");
  revalidatePath("/today");
}

export type ClaimResult = { ok: true } | { ok: false; reason: "already_claimed" | "locked" | "unavailable" };

export async function claimJob(templateId: string, memberId: string, familyId: string, date: string): Promise<ClaimResult> {
  const { supabase } = await requireFamilyContext(familyId);
  const { data, error } = await supabase.rpc("cc_claim_job", {
    p_template_id: requireId(templateId), p_member_id: requireId(memberId), p_date: requireDate(date),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/chores");
  revalidatePath("/today");
  return data as ClaimResult;
}

export async function revokeJob(templateId: string, date: string) {
  const { supabase } = await requireFamilyContext();
  const { error } = await supabase.rpc("cc_revoke_job", {
    p_template_id: requireId(templateId), p_date: requireDate(date),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/chores");
  revalidatePath("/today");
}

export async function redeemReward(rewardId: string, memberId: string, familyId: string, requestId: string) {
  const { supabase } = await requireFamilyContext(familyId);
  // Cost, balance, ownership, locking and retry deduplication are enforced together in PostgreSQL.
  const { data, error } = await supabase.rpc("cc_redeem_reward", {
    p_reward_id: requireId(rewardId), p_member_id: requireId(memberId), p_request_id: requireId(requestId),
  });
  if (error || !data) throw new Error(error?.message ?? "Could not redeem this reward");
  revalidatePath("/chores");
  revalidatePath("/today");
  return data;
}

function validateTemplate(data: {
  name: string; emoji: string; star_value: number; recurrence: ChoreRecurrence;
  category: ChoreCategory; is_special: boolean;
}) {
  if (data.category !== "expectation" && data.category !== "extra_work") throw new Error("Invalid chore category");
  return {
    name: requireText(data.name, "Chore name"), emoji: requireText(data.emoji, "Emoji", 32),
    star_value: requireInteger(data.star_value, data.category === "expectation" ? 0 : 1, data.category === "expectation" ? 0 : 10),
    recurrence: requireRecurrence(data.recurrence), category: data.category,
    is_special: requireBoolean(data.is_special),
  };
}

type TemplateInput = { name: string; emoji: string; star_value: number; recurrence: ChoreRecurrence; category: ChoreCategory; is_special: boolean };

async function saveTemplate(templateId: string | null, data: TemplateInput, memberIds: string[], familyId?: string) {
  const { supabase } = await requireFamilyContext(familyId);
  if (!Array.isArray(memberIds)) throw new Error("Invalid members");
  const { error } = await supabase.rpc("cc_save_template", {
    p_template_id: templateId === null ? null : requireId(templateId),
    p_data: validateTemplate(data), p_member_ids: [...new Set(memberIds.map((id) => requireId(id)))],
  });
  if (error) throw new Error(error.message);
  revalidatePath("/chores");
  revalidatePath("/settings");
  revalidatePath("/today");
}

export async function createChoreTemplate(familyId: string, data: TemplateInput, memberIds: string[]) {
  await saveTemplate(null, data, memberIds, familyId);
}

export async function updateChoreTemplate(templateId: string, data: TemplateInput, memberIds: string[]) {
  await saveTemplate(templateId, data, memberIds);
}

export async function deleteChoreTemplate(templateId: string) {
  const { supabase } = await requireFamilyContext();
  const { error } = await supabase.rpc("cc_archive_template", { p_template_id: requireId(templateId) });
  if (error) throw new Error(error.message);
  revalidatePath("/chores");
  revalidatePath("/settings");
  revalidatePath("/today");
}

export async function createStarReward(
  familyId: string,
  data: { name: string; emoji: string; star_cost: number }
) {
  const { supabase, familyId: verifiedFamilyId } = await requireFamilyContext(familyId);
  const { error } = await supabase.from("star_rewards").insert({ ...validateReward(data), family_id: verifiedFamilyId });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/chores");
}

export async function updateStarReward(rewardId: string, data: { name: string; emoji: string; star_cost: number }) {
  const { supabase, familyId } = await requireFamilyContext();
  const { error } = await supabase.from("star_rewards").update(validateReward(data)).eq("id", requireId(rewardId)).eq("family_id", familyId);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/chores");
}

export async function deleteStarReward(rewardId: string) {
  const { supabase, familyId } = await requireFamilyContext();
  const { error } = await supabase.from("star_rewards").delete().eq("id", requireId(rewardId)).eq("family_id", familyId);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/chores");
}

export async function toggleChoresEnabled(memberId: string, enabled: boolean) {
  const { supabase, familyId } = await requireFamilyContext();
  const { error } = await supabase.from("family_members").update({ chores_enabled: requireBoolean(enabled) }).eq("id", requireId(memberId)).eq("family_id", familyId);
  if (error) throw new Error(error.message);
  revalidatePath("/chores");
  revalidatePath("/settings");
}

function validateReward(data: { name: string; emoji: string; star_cost: number }) {
  return { name: requireText(data.name, "Reward name"), emoji: requireText(data.emoji, "Emoji", 32), star_cost: requireInteger(data.star_cost, 1, 1_000_000) };
}
