import type { ChoreCompletion, ChoreRecurrence, ChoreTemplate, StarRedemption } from "@/lib/types";

export function isScheduledToday(recurrence: ChoreRecurrence, date: Date): boolean {
  const day = date.getDay();
  switch (recurrence.type) {
    case "daily": return true;
    case "weekdays": return day >= 1 && day <= 5;
    case "custom": return (recurrence.days ?? []).includes(day);
  }
}

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function computeStarBalance(
  memberId: string,
  allCompletions: ChoreCompletion[],
  redemptions: StarRedemption[]
): number {
  const earned = allCompletions
    .filter((c) => c.member_id === memberId)
    .reduce((sum, c) => sum + c.stars_earned, 0);
  const spent = redemptions
    .filter((r) => r.member_id === memberId)
    .reduce((sum, r) => sum + r.stars_spent, 0);
  return Math.max(0, earned - spent);
}

export function expectationsForDay(templates: ChoreTemplate[], date: Date): ChoreTemplate[] {
  return templates.filter(
    (t) => t.active && t.category === "expectation" && isScheduledToday(t.recurrence, date)
  );
}

/**
 * A child may claim extra work only once every expectation assigned to them and
 * scheduled today is complete. A child with nothing scheduled is vacuously open.
 *
 * `memberCompletions` must already be filtered to a single member.
 */
export function gateOpen(
  memberTemplates: ChoreTemplate[],
  memberCompletions: ChoreCompletion[],
  dateStr: string
): boolean {
  const due = expectationsForDay(memberTemplates, new Date(dateStr + "T00:00:00"));
  if (due.length === 0) return true;
  const doneIds = new Set(
    memberCompletions.filter((c) => c.date === dateStr).map((c) => c.template_id)
  );
  return due.every((t) => doneIds.has(t.id));
}
