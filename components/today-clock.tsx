"use client";
import { useEffect, useState } from "react";
import { useFamilyRuntime } from "@/components/family-runtime";

export default function TodayClock() {
  const { timeZone } = useFamilyRuntime();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { const tick = () => setNow(new Date()); tick(); const timer = setInterval(tick, 30_000); return () => clearInterval(timer); }, []);
  return <span className="tabular-nums">{now ? now.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" }) : "—:—"}</span>;
}
