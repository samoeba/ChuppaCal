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

export function templatesForDay(templates: ChoreTemplate[], date: Date): ChoreTemplate[] {
  return templates.filter((t) => t.active && isScheduledToday(t.recurrence, date));
}
