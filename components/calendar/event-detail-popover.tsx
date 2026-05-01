"use client";

import { useEffect, useState } from "react";
import { type EventWithMember, formatTimeLong } from "@/lib/calendar";
import MemberAvatar from "@/components/family/member-avatar";

const POPOVER_WIDTH = 320;
const ANCHOR_GAP = 8;
const VIEWPORT_MARGIN = 12;
const ESTIMATED_HEIGHT = 280;

function computePosition(rect: DOMRect): {
  top: number;
  left: number;
  origin: string;
} {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let origin = "left top";
  let left = rect.right + ANCHOR_GAP;
  if (left + POPOVER_WIDTH > vw - VIEWPORT_MARGIN) {
    origin = "right top";
    left = rect.left - ANCHOR_GAP - POPOVER_WIDTH;
  }
  if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
  if (left + POPOVER_WIDTH > vw - VIEWPORT_MARGIN) {
    left = vw - VIEWPORT_MARGIN - POPOVER_WIDTH;
  }

  let top = rect.top;
  if (top + ESTIMATED_HEIGHT > vh - VIEWPORT_MARGIN) {
    top = vh - VIEWPORT_MARGIN - ESTIMATED_HEIGHT;
  }
  if (top < VIEWPORT_MARGIN) top = VIEWPORT_MARGIN;

  return { top, left, origin };
}

export default function EventDetailPopover({
  event,
  anchorRect,
  onClose,
}: {
  event: EventWithMember;
  anchorRect: DOMRect;
  onClose: () => void;
}) {
  const [pos] = useState(() => computePosition(anchorRect));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const start = new Date(event.start_time);
  const end = event.end_time ? new Date(event.end_time) : null;
  const member = event.member;
  const accent = member?.color ?? "#4ecdc4";

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label={event.title}
        className={`fixed z-50 bg-cc-white border border-cc-line rounded-cc-md shadow-lg p-5 transition-all duration-150 ease-out ${
          mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
        style={{
          top: pos.top,
          left: pos.left,
          width: POPOVER_WIDTH,
          transformOrigin: pos.origin,
        }}
      >
        {member && (
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-3 h-3 rounded-full inline-block flex-shrink-0"
              style={{ background: accent }}
            />
            <MemberAvatar member={member} size={20} emojiClassName="text-xs" />
            <span className="text-caption truncate">{member.name}</span>
          </div>
        )}

        <div className="text-heading-md text-cc-ink mb-2 pr-10 leading-tight">
          {event.title}
        </div>

        <div className="text-body text-cc-ink">
          {event.all_day
            ? "All day"
            : end
            ? `${formatTimeLong(start)} – ${formatTimeLong(end)}`
            : formatTimeLong(start)}
        </div>
        <div className="text-caption mt-1">
          {start.toLocaleString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </div>

        {event.location && (
          <div className="mt-4 flex items-start gap-2 text-body">
            <span aria-hidden="true">📍</span>
            <span className="break-words">{event.location}</span>
          </div>
        )}

        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center rounded-full text-cc-ink-dim text-body-lg active:bg-cc-beige"
        >
          ×
        </button>
      </div>
    </>
  );
}
