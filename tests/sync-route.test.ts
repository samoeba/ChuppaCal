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
