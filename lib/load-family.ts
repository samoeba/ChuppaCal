import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Family } from "@/lib/types";

/** React cache is request-scoped; never cache a user's family globally. */
export const loadFamily = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  const { data: membership, error } = await supabase
    .from("family_members")
    .select("family:families(*)")
    .eq("user_id", user.id)
    .maybeSingle()
    .overrideTypes<{ family: Family | null }, { merge: false }>();
  if (error) throw new Error("Could not verify family membership");
  if (!membership) redirect("/onboarding");
  if (!membership.family) throw new Error("Could not load family settings");
  return { supabase, userId: user.id, family: membership.family };
});
