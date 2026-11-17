import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/sync-calendars/route";
import { query } from "./helpers/query";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), events: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
vi.mock("@/lib/google/calendar", async (original) => ({ ...await original<typeof import("@/lib/google/calendar")>(), listEvents: mocks.events }));
const request = () => new Request("https://example.test/api/cron/sync-calendars", { headers: { authorization: "Bearer test" } });
const connection = { id: "connection", provider: "google", family_id: "family", member_id: null, credentials: { refresh_token: "test" }, sync_version: 1, sync_lock_token: "lock" };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("CRON_SECRET", "test");
  mocks.from.mockReturnValue(query([{ id: connection.id }]));
  mocks.rpc.mockImplementation(async (name) => ({ data: name === "cc_claim_calendar_sync" ? connection : 0, error: null }));
});
afterEach(() => vi.unstubAllEnvs());
it("reports per-connection failure as HTTP 502 without exposing provider details", async () => {
  mocks.events.mockRejectedValue(new Error("sensitive provider response"));
  const response = await GET(request());
  expect(response.status).toBe(502);
  const body = await response.json();
  expect(body.ok).toBe(false);
  expect(body.results[0].error).toMatch("Sync failed");
  expect(JSON.stringify(body)).not.toContain("sensitive");
  expect(mocks.rpc).toHaveBeenLastCalledWith("cc_calendar_sync_error", expect.anything());
});
it("fetches one complete rolling window and atomically applies even an empty snapshot", async () => {
  mocks.events.mockResolvedValue({ events: [], updatedCreds: null });
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(mocks.events).toHaveBeenCalledOnce();
  expect(mocks.events.mock.calls[0][0].updatedMin).toBeUndefined();
  expect(mocks.rpc).toHaveBeenLastCalledWith("cc_apply_calendar_snapshot", expect.objectContaining({ p_events: [], p_token: "lock", p_version: 1 }));
});
it("syncs a primary and secondary calendar into separate connections even when Google reuses an event ID", async () => {
  const personal = { ...connection, id: "personal", calendar_external_id: "personal@group.calendar.google.com", sync_lock_token: "personal-lock" };
  mocks.from.mockReturnValue(query([{ id: connection.id }, { id: personal.id }]));
  mocks.rpc.mockImplementation(async (name, args) => ({ data: name === "cc_claim_calendar_sync" ?
    (args.p_id === personal.id ? personal : connection) : 1, error: null }));
  mocks.events.mockImplementation(async ({ calendarId }) => ({
    events: [{ id: "same-event", status: "confirmed", summary: calendarId, start: { date: "2026-11-14" }, end: { date: "2026-11-15" } }], updatedCreds: null,
  }));
  expect((await GET(request())).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("cc_apply_calendar_snapshot", expect.objectContaining({
    p_id: connection.id, p_events: [expect.objectContaining({ external_id: "same-event", title: "primary" })],
  }));
  expect(mocks.rpc).toHaveBeenCalledWith("cc_apply_calendar_snapshot", expect.objectContaining({
    p_id: personal.id, p_events: [expect.objectContaining({ external_id: "same-event", title: personal.calendar_external_id })],
  }));
});
it("does not access the database for an unauthorized request", async () => {
  const response = await GET(new Request("https://example.test"));
  expect(response.status).toBe(401);
  expect(mocks.from).not.toHaveBeenCalled();
});
it("does not apply a partial download or ignore an apply failure", async () => {
  mocks.events.mockResolvedValue({ events: [], updatedCreds: null });
  mocks.rpc.mockResolvedValueOnce({ data: connection, error: null }).mockResolvedValueOnce({ data: null, error: { message: "write failed" } }).mockResolvedValue({ error: null });
  expect((await GET(request())).status).toBe(502);
});
it("skips a leased/recently attempted connection without calling Google", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  expect((await GET(request())).status).toBe(200);
  expect(mocks.events).not.toHaveBeenCalled();
});
