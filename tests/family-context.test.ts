import { beforeEach, expect, it, vi } from "vitest";
import { requireFamilyContext, requireFamilyRecord } from "@/lib/family-context";
import { query } from "./helpers/query";
const mocks = vi.hoisted(() => ({ user: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.user }, from: mocks.from }) }));
const family = "00000000-0000-0000-0000-000000000001";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
  mocks.from.mockReturnValue(query({ id: "member", family_id: family, role: "parent" }));
});
it("rejects anonymous sessions", async () => {
  mocks.user.mockResolvedValue({ data: { user: null }, error: null });
  await expect(requireFamilyContext()).rejects.toThrow("sign in");
  expect(mocks.from).not.toHaveBeenCalled();
});
it("rejects a caller-supplied different family", async () => {
  await expect(requireFamilyContext("00000000-0000-0000-0000-000000000099")).rejects.toThrow("your family");
});
it("rejects ambiguous/missing membership", async () => {
  mocks.from.mockReturnValue(query(null, { message: "multiple rows" }));
  await expect(requireFamilyContext()).rejects.toThrow("membership");
});
it("requires target records in the verified family", async () => {
  const context = await requireFamilyContext();
  const target = query(null);
  mocks.from.mockReturnValue(target);
  await expect(requireFamilyRecord(context, "family_members", family)).rejects.toThrow("your family");
  expect(target.eq).toHaveBeenCalledWith("family_id", family);
});
