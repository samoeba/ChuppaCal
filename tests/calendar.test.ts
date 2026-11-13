import { describe, expect, it } from "vitest";
import { addDays, eventOccursOnDay, groupEventsByDay, shiftForView, toDateParam, type EventWithMember } from "@/lib/calendar";
import { layoutTimedEvents } from "@/lib/calendar-layout";
import { isDateString, requireBoolean, requireColor, requireDate, requireId, requireInteger, requireRecurrence, requireText } from "@/lib/validation";

function event(id: string, start: string, end: string, allDay = false): EventWithMember {
  return { id, family_id: "family", connection_id: null, member_id: null, external_id: null, title: id, start_time: start, end_time: end, all_day: allDay, location: null, synced_at: "", member: null };
}

describe("calendar civil dates", () => {
  it.each(["2026-02-30", "2025-02-29", "2026-13-01", "not-a-date", "2026-1-1"])("rejects %s", (date) => {
    expect(isDateString(date)).toBe(false);
    expect(() => requireDate(date)).toThrow();
  });
  it("accepts leap days and clamps month navigation", () => {
    expect(isDateString("2024-02-29")).toBe(true);
    expect(toDateParam(shiftForView("month", new Date(2026, 0, 31), 1))).toBe("2026-02-28");
    expect(toDateParam(shiftForView("month", new Date(2024, 2, 31), -1))).toBe("2024-02-29");
  });
  it("keeps all-day events on their civil dates with exclusive ends", () => {
    const ev = event("trip", "2026-03-07T00:00:00.000Z", "2026-03-10T00:00:00.000Z", true);
    expect(groupEventsByDay([ev], new Date(2026, 2, 6), 5).map((day) => day.length)).toEqual([0, 1, 1, 1, 0]);
  });
  it("includes overnight events on both days but not after a midnight end", () => {
    const ev = event("overnight", new Date(2026, 2, 7, 23).toISOString(), new Date(2026, 2, 9).toISOString());
    expect(groupEventsByDay([ev], new Date(2026, 2, 7), 3).map((day) => day.length)).toEqual([1, 1, 0]);
  });
  it("uses calendar boundaries across daylight-saving transitions", () => {
    // CI runs with TZ=America/Chicago; local runs remain valid in other zones.
    const day = new Date(2026, 2, 8);
    const next = addDays(day, 1);
    expect(next.getDate()).toBe(9);
    const ev = event("late", new Date(2026, 2, 8, 23, 30).toISOString(), new Date(2026, 2, 9, 0, 30).toISOString());
    expect(eventOccursOnDay(ev, day)).toBe(true);
    expect(eventOccursOnDay(ev, next)).toBe(true);
    expect(eventOccursOnDay(ev, addDays(next, 1))).toBe(false);
  });
});

describe("timed event layout", () => {
  const day = new Date(2026, 8, 26);
  const at = (hour: number, minute = 0) => new Date(2026, 8, 26, hour, minute).toISOString();
  it("packs overlapping events into columns and gives later events full width", () => {
    const result = layoutTimedEvents([event("a", at(9), at(11)), event("b", at(9, 30), at(10)), event("c", at(10), at(11)), event("d", at(11), at(12))], day, 0, 1440, 1);
    expect(result.map(({ column, columns }) => [column, columns])).toEqual([[0, 2], [1, 2], [1, 2], [0, 1]]);
  });
  it("clips overnight/short events to the visible grid", () => {
    const result = layoutTimedEvents([event("night", new Date(2026, 8, 25, 23).toISOString(), at(7)), event("short", at(23, 55), at(23, 56))], day, 360, 1440, 1);
    expect(result.map(({ top, height }) => [top, height])).toEqual([[0, 60], [1075, 5]]);
  });
  it("does not position all-day or out-of-range events", () => {
    expect(layoutTimedEvents([event("early", at(1), at(2)), event("all", at(8), at(10), true)], day, 360, 1200, 1)).toEqual([]);
  });
});

describe("server input validation", () => {
  it("normalizes text and rejects empty, oversized and incorrectly typed input", () => {
    expect(requireText("  Dinner  ", "Name")).toBe("Dinner");
    for (const value of ["", " ", null, 3, "x".repeat(201)]) expect(() => requireText(value, "Name")).toThrow();
    expect(() => requireInteger(1.5, 1, 10)).toThrow();
    expect(() => requireInteger(Infinity, 1, 10)).toThrow();
    expect(() => requireBoolean("false")).toThrow();
    expect(() => requireColor("red")).toThrow();
    expect(() => requireId("temp-123")).toThrow();
  });
  it("validates and deduplicates recurrence days", () => {
    expect(requireRecurrence({ type: "custom", days: [1, 1, 5] })).toEqual({ type: "custom", days: [1, 5] });
    expect(() => requireRecurrence({ type: "custom", days: [] })).toThrow();
    expect(() => requireRecurrence({ type: "custom", days: [7] })).toThrow();
  });
});
