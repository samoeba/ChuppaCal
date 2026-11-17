import { beforeEach, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/calendar/connections/[id]/calendars/route";
import { PATCH } from "@/app/api/calendar/connections/[id]/route";
import { query } from "./helpers/query";

const mocks = vi.hoisted(() => ({ after: vi.fn(), list: vi.fn(), from: vi.fn(), rpc: vi.fn(), sync: vi.fn() }));
vi.mock("next/server", async (original) => ({ ...await original<typeof import("next/server")>(), after: mocks.after }));
vi.mock("@/lib/family-context", () => ({
  requireFamilyContext: async () => ({ supabase: { from: mocks.from, rpc: mocks.rpc }, familyId: "family" }),
}));
vi.mock("@/lib/google/calendar", () => ({ listCalendars: mocks.list }));
vi.mock("@/lib/google/sync", () => ({ syncGoogleConnections: mocks.sync }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => "worker" }));

const sourceId = "10000000-0000-0000-0000-000000000001";
const params = { params: Promise.resolve({ id: sourceId }) };
const url = "https://example.test/api/calendar/connections/id/calendars";
const request = (body: object, method = "POST") => new Request(url, { method, body: JSON.stringify(body) });
const credentials = { account_email: "owner@example.test", access_token: "secret" };
const calendars = [
  { id: "owner@example.test", summary: "Main", primary: true },
  { id: "shared@example.test", summary: "Shared", summaryOverride: "Family trips" },
  { id: "personal@example.test", summary: "Personal" },
];
const source = () => query({ member_id: "member", credentials });
const existing = () => query([
  { id: sourceId, calendar_external_id: "primary", account_email: credentials.account_email },
  { id: "other", calendar_external_id: "primary", account_email: "someone-else@example.test" },
]);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.list.mockResolvedValue({ items: calendars, updatedCreds: null });
});

it("lists secondary calendars and recognizes an existing primary alias", async () => {
  const lookup = source();
  mocks.from.mockReturnValueOnce(lookup).mockReturnValueOnce(existing());
  const response = await GET(new Request(url), params);
  expect(response.status).toBe(200);
  expect(lookup.eq.mock.calls).toEqual([["id", sourceId], ["family_id", "family"], ["provider", "google"]]);
  expect(await response.json()).toEqual({ calendars: [
    { id: calendars[0].id, name: "Main", primary: true, connected: true },
    { id: calendars[1].id, name: "Family trips", primary: false, connected: false },
    { id: calendars[2].id, name: "Personal", primary: false, connected: false },
  ] });
});

it("adds several verified calendars alongside the original and schedules only their initial sync", async () => {
  const write = query([{ id: "new-shared" }, { id: "new-personal" }]);
  const refreshed = { ...credentials, access_token: "refreshed" };
  mocks.list.mockResolvedValueOnce({ items: calendars, updatedCreds: refreshed });
  mocks.from.mockReturnValueOnce(source()).mockReturnValueOnce(existing()).mockReturnValueOnce(write);
  const response = await POST(request({ calendar_ids: [calendars[0].id, calendars[1].id, calendars[2].id, calendars[1].id] }), params);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ added: ["new-shared", "new-personal"] });
  const [[rows, options]] = write.upsert.mock.calls;
  expect(rows).toHaveLength(2);
  expect(rows).toEqual([
    expect.objectContaining({ calendar_external_id: calendars[1].id, calendar_name: "Family trips", member_id: "member", family_id: "family", credentials: refreshed }),
    expect.objectContaining({ calendar_external_id: calendars[2].id, calendar_name: "Personal", member_id: "member", family_id: "family", credentials: refreshed }),
  ]);
  expect(options).toEqual({ onConflict: "id", ignoreDuplicates: true });
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.after).toHaveBeenCalledOnce();
  await mocks.after.mock.calls[0][0]();
  expect(mocks.sync).toHaveBeenCalledWith("worker", ["new-shared", "new-personal"], expect.any(Number));
});

it("uses the same insert key for concurrent requests and skips a calendar that is already connected", async () => {
  const body = { calendar_ids: [calendars[2].id] };
  const firstWrite = query([{ id: "new" }]);
  const secondWrite = query([]);
  mocks.from.mockReturnValueOnce(source()).mockReturnValueOnce(existing()).mockReturnValueOnce(firstWrite)
    .mockReturnValueOnce(source()).mockReturnValueOnce(existing()).mockReturnValueOnce(secondWrite)
    .mockReturnValueOnce(source()).mockReturnValueOnce(query([{ id: "new", calendar_external_id: calendars[2].id }]));
  await POST(request(body), params);
  expect(await (await POST(request(body), params)).json()).toEqual({ added: [] });
  expect(secondWrite.upsert.mock.calls[0][0][0].id).toBe(firstWrite.upsert.mock.calls[0][0][0].id);
  expect(await (await POST(request(body), params)).json()).toEqual({ added: [] });
  expect(mocks.from).toHaveBeenCalledTimes(8);
  expect(mocks.after).toHaveBeenCalledOnce();
});

it("rejects unavailable calendars and connections outside the family before writing anything", async () => {
  mocks.from.mockReturnValueOnce(source()).mockReturnValueOnce(existing()).mockReturnValueOnce(query());
  expect((await POST(request({ calendar_ids: [calendars[1].id, "unavailable"] }), params)).status).toBe(400);
  expect((await POST(request({ calendar_ids: [calendars[1].id] }), params)).status).toBe(400);
  expect(mocks.from).toHaveBeenCalledTimes(3);
  expect(mocks.list).toHaveBeenCalledOnce();
  expect(mocks.after).not.toHaveBeenCalled();
});

it("keeps the same calendar when changing its assigned family member", async () => {
  const memberId = "20000000-0000-0000-0000-000000000001";
  mocks.from.mockReturnValueOnce(query({ calendar_external_id: "primary", calendar_name: "Main" }));
  mocks.rpc.mockResolvedValueOnce({ error: null });
  expect((await PATCH(request({ member_id: memberId, calendar_external_id: calendars[1].id }, "PATCH"), params)).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("cc_update_calendar", {
    p_id: sourceId, p_member_id: memberId, p_calendar_id: "primary", p_calendar_name: "Main",
  });
});
