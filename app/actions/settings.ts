"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/family-context";
import type { FamilySettings } from "@/lib/types";

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
