"use client";

import type { FamilyMember } from "@/lib/types";

export default function MemberLegend({
  members,
  hiddenIds,
  onToggle,
}: {
  members: FamilyMember[];
  hiddenIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (members.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-cc-line">
      {members.map((m) => {
        const hidden = hiddenIds.has(m.id);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onToggle(m.id)}
            aria-pressed={!hidden}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-opacity active:scale-[0.97] ${
              hidden
                ? "border-cc-line bg-cc-beige/40 opacity-50"
                : "border-cc-line bg-cc-white"
            }`}
          >
            <span
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: hidden ? "transparent" : m.color,
                borderColor: m.color,
                borderWidth: hidden ? 1.5 : 0,
                borderStyle: "solid",
              }}
              aria-hidden
            />
            <span
              className={`text-caption ${hidden ? "line-through" : ""}`}
            >
              {m.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
