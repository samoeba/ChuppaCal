"use client";

import UiIcon from "@/components/ui-icon";
import { useEffect, useState } from "react";
import { type EventWithMember, formatTimeLong } from "@/lib/calendar";
import { useFamilyRuntime } from "@/components/family-runtime";
import { civilDate, zonedDate } from "@/lib/time-zone";
import MemberAvatar from "@/components/family/member-avatar";
import { useDialog } from "@/lib/use-dialog";

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
    left = Math.max(VIEWPORT_MARGIN, vw - VIEWPORT_MARGIN - POPOVER_WIDTH);
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
  const [pos, setPos] = useState(() => computePosition(anchorRect));
  const dialog = useDialog(true, onClose);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const reposition = () => setPos(computePosition(anchorRect));
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [anchorRect]);

  const { timeZone } = useFamilyRuntime();
  const start = event.all_day ? civilDate(event.start_time.slice(0, 10), timeZone) : zonedDate(event.start_time, timeZone);
  const end = event.end_time ? zonedDate(event.end_time, timeZone) : null;
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
        ref={dialog}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={event.title}
        className={`fixed z-50 bg-cc-white border border-cc-line rounded-cc-md shadow-lg p-5 transition-all duration-150 ease-out ${
          mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
        style={{
          top: pos.top,
          left: pos.left,
          width: `min(${POPOVER_WIDTH}px, calc(100vw - ${VIEWPORT_MARGIN * 2}px))`,
          maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`,
          overflowY: "auto",
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
            <UiIcon name="location" />
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
