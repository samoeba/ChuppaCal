"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useFamilyRuntime } from "@/components/family-runtime";

export default function FamilyRealtime() {
  const { familyId } = useFamilyRuntime();
  useEffect(() => {
    if (!familyId) return;
    const supabase = createClient();
    let disposed = false;
    const channel = supabase.channel(`family:${familyId}`, { config: { private: true } })
      .on("broadcast", { event: "changed" }, () => window.dispatchEvent(new Event("chuppacal-data-changed")));
    void supabase.realtime.setAuth().then(() => { if (!disposed) channel.subscribe(); }).catch(() => { /* polling fallback */ });
    return () => { disposed = true; void supabase.removeChannel(channel); };
  }, [familyId]);
  return null;
}
