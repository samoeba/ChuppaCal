import type { FamilyMember } from "@/lib/types";

export default function MemberLegend({ members }: { members: FamilyMember[] }) {
  if (members.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-cc-line">
      {members.map((m) => (
        <div key={m.id} className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: m.color }}
            aria-hidden
          />
          <span className="text-caption">{m.name}</span>
        </div>
      ))}
    </div>
  );
}
