import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeChore, redeemReward, updateChoreTemplate } from "@/app/actions/chores";

const mocks = vi.hoisted(() => ({ context: vi.fn(), rpc: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/family-context", () => ({ requireFamilyContext: mocks.context }));
const family = "00000000-0000-0000-0000-000000000001";
const member = "00000000-0000-0000-0000-000000000002";
const id = "00000000-0000-0000-0000-000000000003";
const request = "00000000-0000-0000-0000-000000000004";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.context.mockResolvedValue({ familyId: family, supabase: { rpc: mocks.rpc } });
});
describe("transactional chore actions", () => {
  it("delegates canonical cost and balance to one idempotent database transaction", async () => {
    const saved = { id: "saved", stars_spent: 7 };
    mocks.rpc.mockResolvedValue({ data: saved, error: null });
    expect(await redeemReward(id, member, family, request)).toEqual(saved);
    expect(mocks.context).toHaveBeenCalledWith(family);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("cc_redeem_reward", { p_reward_id: id, p_member_id: member, p_request_id: request });
  });
  it("surfaces insufficient balance without a second write", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Not enough stars" } });
    await expect(redeemReward(id, member, family, request)).rejects.toThrow("Not enough stars");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("rejects a forged family before invoking the transaction", async () => {
    mocks.context.mockRejectedValue(new Error("unavailable in your family"));
    await expect(redeemReward(id, member, family, request)).rejects.toThrow("your family");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("sends expectations without client-controlled stars or category", async () => {
    mocks.rpc.mockResolvedValue({ data: { id }, error: null });
    await completeChore(id, member, family, "2026-09-26");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("cc_complete_chore", { p_template_id: id, p_member_id: member, p_date: "2026-09-26" });
  });
  it("updates a template and assignments in one call", async () => {
    mocks.rpc.mockResolvedValue({ data: id, error: null });
    const data = { name: "Brush teeth", emoji: "🪥", star_value: 0, recurrence: { type: "daily" as const }, category: "expectation" as const, is_special: false };
    await updateChoreTemplate(id, data, [member, member]);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("cc_save_template", { p_template_id: id, p_data: data, p_member_ids: [member] });
  });
});
