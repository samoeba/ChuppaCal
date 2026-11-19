import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/screensaver/photos/[name]/route";

const mocks = vi.hoisted(() => ({ context: vi.fn(), sign: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/family-context", () => ({ requireFamilyContext: mocks.context }));
const name = "12345678-1234-1234-1234-123456789abc";
const request = (photo = name) => GET(new Request("https://calendar.example/api/screensaver/photos/" + photo), { params: Promise.resolve({ name: photo }) });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.from.mockReturnValue({ createSignedUrl: mocks.sign });
  mocks.context.mockResolvedValue({ familyId: "family-one", supabase: { storage: { from: mocks.from } } });
  mocks.sign.mockResolvedValue({ data: { signedUrl: "https://storage.example/photo?token=temporary" }, error: null });
});

it("redirects to private storage without downloading photo bytes", async () => {
  const response = await request();
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe("https://storage.example/photo?token=temporary");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.text()).toBe("");
  expect(mocks.from).toHaveBeenCalledWith("screensaver-photos");
  expect(mocks.sign).toHaveBeenCalledWith(`family-one/${name}`, 3600);
});

it("obtains a new signed link for subsequent slideshow requests", async () => {
  await request();
  mocks.sign.mockResolvedValue({ data: { signedUrl: "https://storage.example/photo?token=renewed" }, error: null });
  expect((await request()).headers.get("location")).toContain("token=renewed");
  expect(mocks.context).toHaveBeenCalledTimes(2);
});

it("rejects invalid names before accessing storage", async () => {
  expect((await request("..%2Fother-family")).status).toBe(404);
  expect(mocks.context).not.toHaveBeenCalled();
});

it("requires family authentication", async () => {
  mocks.context.mockRejectedValue(new Error("Signed out"));
  expect((await request()).status).toBe(401);
  expect(mocks.sign).not.toHaveBeenCalled();
});

it("returns 404 when storage cannot sign the photo", async () => {
  mocks.sign.mockResolvedValue({ data: null, error: new Error("Unavailable") });
  expect((await request()).status).toBe(404);
});
