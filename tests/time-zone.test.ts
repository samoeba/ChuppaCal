import { afterEach, describe, expect, it, vi } from "vitest";
import { addDays, eventOccursOnDay, parseDate, shiftForView, startOfDay, toDateParam, type EventWithMember } from "@/lib/calendar";
import { zonedDate } from "@/lib/time-zone";
import { startOfWeek } from "@/lib/chores";

afterEach(() => vi.unstubAllEnvs());
describe("explicit family timezone", () => {
  it.each(["UTC", "Pacific/Honolulu", "Asia/Tokyo"])("is independent of host timezone %s", (host) => {
    vi.stubEnv("TZ", host);
    const instant = new Date("2026-09-27T03:00:00Z");
    expect(toDateParam(instant, "America/Chicago")).toBe("2026-09-26");
    expect(toDateParam(instant, "Asia/Tokyo")).toBe("2026-09-27");
    expect(toDateParam(startOfWeek(zonedDate(instant, "America/Chicago")))).toBe("2026-09-21");
  });
  it.each(["Pacific/Kiritimati", "Pacific/Pago_Pago", "America/Chicago"])("round-trips civil dates and months in %s", (zone) => {
    const date = parseDate("2026-01-31", zone);
    expect(toDateParam(date)).toBe("2026-01-31");
    expect(toDateParam(shiftForView("month", date, 1))).toBe("2026-02-28");
  });
  it.each([["2026-03-08", 23], ["2026-11-01", 25]] as const)("uses civil midnight across DST on %s", (day, hours) => {
    const midnight = startOfDay(parseDate(day, "America/Chicago"));
    expect((+addDays(midnight, 1) - +midnight) / 3600000).toBe(hours);
  });
  it("keeps all-day dates distinct from UTC instants in UTC+14", () => {
    const event = { all_day: true, start_time: "2026-09-26T00:00:00Z", end_time: "2026-09-27T00:00:00Z" } as EventWithMember;
    expect(eventOccursOnDay(event, parseDate("2026-09-26", "Pacific/Kiritimati"))).toBe(true);
    expect(eventOccursOnDay(event, parseDate("2026-09-27", "Pacific/Kiritimati"))).toBe(false);
  });
});
