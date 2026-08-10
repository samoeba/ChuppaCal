import { describe, it, expect } from "vitest";
import { expectationsForDay, gateOpen } from "@/lib/chores";
import type { ChoreCompletion, ChoreTemplate } from "@/lib/types";

const MONDAY = "2026-08-10"; // getDay() === 1

function template(over: Partial<ChoreTemplate> = {}): ChoreTemplate {
  return {
    id: "t1", family_id: "f1", name: "Make bed", emoji: "🛏️",
    star_value: 0, recurrence: { type: "daily" }, active: true,
    created_at: "", category: "expectation", is_special: false,
    ...over,
  };
}

function completion(over: Partial<ChoreCompletion> = {}): ChoreCompletion {
  return {
    id: "c1", family_id: "f1", template_id: "t1", member_id: "m1",
    date: MONDAY, stars_earned: 0, completed_at: "",
    category: "expectation", ...over,
  };
}

describe("expectationsForDay", () => {
  it("keeps active daily expectations", () => {
    expect(expectationsForDay([template()], new Date(MONDAY + "T00:00:00"))).toHaveLength(1);
  });

  it("drops extra work", () => {
    const job = template({ id: "j1", category: "extra_work", star_value: 3 });
    expect(expectationsForDay([job], new Date(MONDAY + "T00:00:00"))).toHaveLength(0);
  });

  it("drops inactive templates", () => {
    expect(expectationsForDay([template({ active: false })], new Date(MONDAY + "T00:00:00"))).toHaveLength(0);
  });

  it("respects custom recurrence days", () => {
    const sundayOnly = template({ recurrence: { type: "custom", days: [0] } });
    expect(expectationsForDay([sundayOnly], new Date(MONDAY + "T00:00:00"))).toHaveLength(0);
  });
});

describe("gateOpen", () => {
  it("is open when nothing is scheduled", () => {
    expect(gateOpen([], [], MONDAY)).toBe(true);
  });

  it("is open when the only expectations are extra work", () => {
    const job = template({ id: "j1", category: "extra_work", star_value: 3 });
    expect(gateOpen([job], [], MONDAY)).toBe(true);
  });

  it("is closed when a scheduled expectation is unfinished", () => {
    expect(gateOpen([template()], [], MONDAY)).toBe(false);
  });

  it("is closed when only some are finished", () => {
    const a = template({ id: "a" });
    const b = template({ id: "b" });
    expect(gateOpen([a, b], [completion({ template_id: "a" })], MONDAY)).toBe(false);
  });

  it("is open when all are finished", () => {
    const a = template({ id: "a" });
    const b = template({ id: "b" });
    const done = [completion({ template_id: "a" }), completion({ id: "c2", template_id: "b" })];
    expect(gateOpen([a, b], done, MONDAY)).toBe(true);
  });

  it("ignores completions from another date", () => {
    const stale = completion({ date: "2026-08-09" });
    expect(gateOpen([template()], [stale], MONDAY)).toBe(false);
  });

  it("ignores expectations not scheduled today", () => {
    const sundayOnly = template({ id: "s", recurrence: { type: "custom", days: [0] } });
    expect(gateOpen([template(), sundayOnly], [completion()], MONDAY)).toBe(true);
  });
});
