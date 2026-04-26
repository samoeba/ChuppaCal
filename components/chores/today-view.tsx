"use client";

import ChoreRow from "@/components/chores/chore-row";
import type { ChoreCompletion, ChoreTemplate, FamilyMember } from "@/lib/types";

interface TodayViewProps {
  kid: FamilyMember;
  templates: ChoreTemplate[];
  completions: ChoreCompletion[];
  familyId: string;
  familyPin: string;
  today: string;
  onComplete: (c: ChoreCompletion) => void;
  onUncomplete: (templateId: string, memberId: string) => void;
}

export default function TodayView({
  kid, templates, completions, familyId, familyPin, today, onComplete, onUncomplete,
}: TodayViewProps) {
  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-6">
        <div className="text-4xl mb-3">🎉</div>
        <p className="font-semibold text-slate-600">No chores today!</p>
        <p className="text-sm text-slate-400 mt-1">Enjoy your day, {kid.name}.</p>
      </div>
    );
  }

  const completionMap = Object.fromEntries(completions.map((c) => [c.template_id, c]));
  const sorted = [
    ...templates.filter((t) => !completionMap[t.id]),
    ...templates.filter((t) => !!completionMap[t.id]),
  ];

  return (
    <div className="p-3 flex flex-col gap-2">
      {sorted.map((template) => (
        <ChoreRow
          key={template.id}
          template={template}
          kid={kid}
          completion={completionMap[template.id]}
          familyId={familyId}
          familyPin={familyPin}
          today={today}
          onComplete={onComplete}
          onUncomplete={onUncomplete}
        />
      ))}
    </div>
  );
}
