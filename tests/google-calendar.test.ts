import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eventToDbRow, listCalendars, listEvents, type GoogleEvent } from "@/lib/google/calendar";
import { getValidAccessToken, type StoredGoogleCredentials } from "@/lib/google/oauth";

vi.mock("@/lib/google/oauth", () => ({ getValidAccessToken: vi.fn() }));
const creds: StoredGoogleCredentials = { access_token: "test", refresh_token: "test-refresh", expires_at: 1, scope: "test" };
const fetchMock = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(getValidAccessToken).mockResolvedValue({ token: "test", updated: null });
});
afterEach(() => vi.unstubAllGlobals());
const response = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
const opts = { familyId: "family", connectionId: "connection", memberId: null };

describe("Google import", () => {
  it("paginates even an empty page and reuses refreshed credentials", async () => {
    const refreshed = { ...creds, access_token: "fresh" };
    vi.mocked(getValidAccessToken).mockResolvedValueOnce({ token: "fresh", updated: refreshed });
    fetchMock.mockResolvedValueOnce(response({ items: [], nextPageToken: "next" })).mockResolvedValueOnce(response({ items: [{ id: "event" }] }));
    const result = await listEvents({ creds, calendarId: "a/b", timeMin: new Date(0), timeMax: new Date(1000) });
    expect(result.events).toEqual([{ id: "event" }]);
    expect(result.updatedCreds).toEqual(refreshed);
    expect(getValidAccessToken).toHaveBeenNthCalledWith(2, refreshed, expect.any(AbortSignal));
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get("pageToken")).toBe("next");
    expect(fetchMock.mock.calls[0][0]).toContain("a%2Fb");
  });
  it("paginates calendar selection and rejects repeated page tokens", async () => {
    fetchMock.mockImplementation(async () => response({ items: [], nextPageToken: "loop" }));
    await expect(listCalendars(creds)).rejects.toThrow("repeated page token");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const nextPage = new URL(fetchMock.mock.calls[1][0]).searchParams;
    expect(nextPage.get("showHidden")).toBe("true");
    expect(nextPage.get("minAccessRole")).toBe("reader");
  });
  it("does not include Google response bodies in errors", async () => {
    fetchMock.mockResolvedValue(new Response("sensitive-response", { status: 403 }));
    await expect(listCalendars(creds)).rejects.toThrow(/^Google API error 403$/);
  });
  it("stores all-day dates at UTC midnight and ignores cancelled entries without dates", () => {
    const row = eventToDbRow({ id: "all", status: "confirmed", start: { date: "2026-03-08" }, end: { date: "2026-03-09" } }, opts);
    expect(row?.start_time).toBe("2026-03-08T00:00:00.000Z");
    expect(row?.end_time).toBe("2026-03-09T00:00:00.000Z");
    expect(eventToDbRow({ id: "deleted", status: "cancelled" } as GoogleEvent, opts)).toBeNull();
  });
  it("rejects malformed or reversed times", () => {
    expect(() => eventToDbRow({ id: "bad", status: "confirmed", start: { dateTime: "invalid" }, end: { dateTime: "invalid" } }, opts)).toThrow();
    expect(() => eventToDbRow({ id: "bad", status: "confirmed", start: { date: "2026-03-10" }, end: { date: "2026-03-09" } }, opts)).toThrow();
  });
});
