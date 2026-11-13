import { createClient } from "@/lib/supabase/server";
import { requireId } from "@/lib/validation";

/** Derive tenant identity from the verified session, never from action arguments. */
export async function requireFamilyContext(expectedFamilyId?: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Please sign in again");
  const { data: member, error } = await supabase.from("family_members")
    .select("id,family_id,role").eq("user_id", user.id).single();
  if (error || !member) throw new Error("Family membership could not be verified");
  if (expectedFamilyId !== undefined && requireId(expectedFamilyId, "family") !== member.family_id) {
    throw new Error("This item does not belong to your family");
  }
  return { supabase, familyId: member.family_id as string, memberId: member.id as string, role: member.role };
}

export type FamilyContext = Awaited<ReturnType<typeof requireFamilyContext>>;

export async function requireFamilyRecord(
  { supabase, familyId }: FamilyContext,
  table: "family_members" | "chore_templates" | "star_rewards" | "lists" | "calendar_connections",
  id: string,
) {
  requireId(id);
  const { data, error } = await supabase.from(table).select("id").eq("id", id).eq("family_id", familyId).single();
  if (error || !data) throw new Error("This item is unavailable in your family");
}
