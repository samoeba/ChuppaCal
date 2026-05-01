"use client";

import { useEffect, useRef, useState } from "react";
import {
  END_MIN,
  MIN_PX,
  START_MIN,
  TIME_RAIL_REM,
} from "@/components/calendar/time-grid-constants";

export default function CurrentTimeIndicator({
  rangeStartISO,
  rangeDays,
}: {
  rangeStartISO: string;
  rangeDays: number;
}) {
  const [now, setNow] = useState<Date | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const scrolledRef = useRef(false);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (scrolledRef.current || !now || !ref.current) return;

    let parent: HTMLElement | null = ref.current.parentElement;
    while (parent) {
      const overflowY = getComputedStyle(parent).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") break;
      parent = parent.parentElement;
    }
    if (!parent) return;

    const target = ref.current.offsetTop - parent.offsetTop;
    const max = parent.scrollHeight - parent.clientHeight;
    parent.scrollTop = Math.max(0, Math.min(target, max));
    scrolledRef.current = true;
  }, [now]);

  if (!now) return null;

  const rangeStart = new Date(rangeStartISO);
  const rangeEndMs = rangeStart.getTime() + rangeDays * 24 * 60 * 60 * 1000;
  if (now.getTime() < rangeStart.getTime() || now.getTime() >= rangeEndMs) {
    return null;
  }

  const h = now.getHours();
  const m = now.getMinutes();
  const nowMin = h * 60 + m;
  if (nowMin < START_MIN || nowMin >= END_MIN) return null;

  const top = (nowMin - START_MIN) * MIN_PX;

  const h12 = h % 12 === 0 ? 12 : h % 12;
  const suffix = h >= 12 ? "PM" : "AM";
  const label = `${h12}:${String(m).padStart(2, "0")} ${suffix}`;

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top,
        left: 0,
        right: 0,
        height: 0,
        zIndex: 100,
        pointerEvents: "none",
      }}
      aria-label={`Current time ${label}`}
    >
      <div
        style={{
          position: "absolute",
          left: `${TIME_RAIL_REM}rem`,
          right: 0,
          top: -1,
          height: 2,
          background: "#E03030",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: "translateY(-50%)",
          padding: "2px 6px",
          borderRadius: 5,
          background: "#E03030",
          color: "#FFFFFF",
          fontSize: "0.7rem",
          fontWeight: 700,
          whiteSpace: "nowrap",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      >
        {label}
      </div>
    </div>
  );
}
