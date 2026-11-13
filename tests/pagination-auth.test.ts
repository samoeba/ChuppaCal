import { afterEach, describe, expect, it, vi } from "vitest";
import { readAllRows } from "@/lib/pagination";
import { isCronAuthorized } from "@/lib/cron-auth";

afterEach(() => vi.unstubAllEnvs());
describe("paginated history", () => {
  it("reads past the default 1000-row cap with inclusive range bounds", async () => {
    const page = vi.fn().mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, id) => ({ id })), error: null }).mockResolvedValueOnce({ data: [{ id: 1000 }], error: null });
    expect(await readAllRows(page)).toHaveLength(1001);
    expect(page.mock.calls).toEqual([[0, 999], [1000, 1999]]);
  });
  it("never returns a silently incomplete total when another page fails", async () => {
    const page = vi.fn().mockResolvedValueOnce({ data: Array(1000).fill({}), error: null }).mockResolvedValueOnce({ data: null, error: { message: "offline" } });
    await expect(readAllRows(page)).rejects.toThrow("offline");
  });
});
describe("cron authorization", () => {
  it.each(["production", "test"])("fails closed with a missing secret in %s", (env) => {
    vi.stubEnv("NODE_ENV", env);
    vi.stubEnv("CRON_SECRET", "");
    expect(isCronAuthorized(new Request("https://example.test"))).toBe(false);
  });
  it("allows the documented development-only no-secret mode", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CRON_SECRET", "");
    expect(isCronAuthorized(new Request("https://example.test"))).toBe(true);
  });
  it("requires an exact bearer header", () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    for (const header of ["", "test-secret", "Bearer nope", "Bearer test-secret-extra"]) {
      expect(isCronAuthorized(new Request("https://example.test", { headers: { authorization: header } }))).toBe(false);
    }
    expect(isCronAuthorized(new Request("https://example.test", { headers: { authorization: "Bearer test-secret" } }))).toBe(true);
  });
});
