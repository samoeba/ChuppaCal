"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/family-context";
import type { FamilySettings } from "@/lib/types";
import { requireText } from "@/lib/validation";

export async function updateFamilyName(name: string): Promise<string> {
  const trimmed = requireText(name, "Family name", 100);
  const { supabase, familyId } = await requireFamilyContext();
  const { data, error } = await supabase.from("families")
    .update({ name: trimmed })
    .eq("id", familyId)
    .select("name")
    .single();
  if (error || !data) throw new Error("Could not save the family name. Please retry.");
  revalidatePath("/today");
  return data.name;
}

export type DisplaySettingsPatch = Partial<Pick<FamilySettings,
  "weather_location" | "time_zone" | "sleep_start" | "sleep_end" | "sleep_enabled" | "screensaver_enabled" | "screensaver_timeout_minutes"
>>;

export async function updateDisplaySettings(patch: DisplaySettingsPatch): Promise<FamilySettings> {
  const { supabase } = await requireFamilyContext();
  // The RPC validates a strict field allowlist and merges under a row lock.
  const { data, error } = await supabase.rpc("cc_patch_settings", { p_patch: patch });
  if (error || !data) throw new Error(error?.message ?? "Could not save settings");
  revalidatePath("/", "layout");
  return data as FamilySettings;
}
