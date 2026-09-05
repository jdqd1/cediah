import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ session: vi.fn(), request: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: api.revalidate }));
vi.mock("@/lib/server/api-session", () => ({ getApiRequestCookie: api.session }));
vi.mock("@/lib/server/content-api", () => ({
  requestContentApi: api.request,
  safeContentApiStatus: (status: number) => [400, 401, 403, 404, 503].includes(status) ? status : 503,
}));
import { POST } from "../app/api/content/[contentId]/views/route";

const contentId = "10000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ contentId }) };
const request = (origin = "https://koraz.example") => new Request(`https://koraz.example/api/content/${contentId}/views`, {
  method: "POST", headers: { origin },
});
const receipt = { counted: true, viewCount: 8, retryAfterMs: 1_800_000 };
beforeEach(() => {
  vi.clearAllMocks();
  api.session.mockResolvedValue({ cookie: "local-test", status: "ready" });
  api.request.mockResolvedValue({ status: 200, body: receipt });
});
describe("browser view endpoint", () => {
  it("returns authoritative totals and invalidates stale catalog counts after a new view", async () => {
    const response = await POST(request(), context);
    expect(await response.json()).toEqual(receipt);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(api.revalidate).toHaveBeenCalledExactlyOnceWith("published-content", { expire: 0 });
  });
  it("returns repeated-view totals without invalidating catalogs", async () => {
    api.request.mockResolvedValue({ status: 200, body: { ...receipt, counted: false } });
    expect(await (await POST(request(), context)).json()).toEqual({ ...receipt, counted: false });
    expect(api.revalidate).not.toHaveBeenCalled();
  });
  it("rejects foreign origins and anonymous visitors before writing", async () => {
    expect((await POST(request("https://foreign.example"), context)).status).toBe(403);
    api.session.mockResolvedValue({ status: "anonymous" });
    expect((await POST(request(), context)).status).toBe(401);
    expect(api.request).not.toHaveBeenCalled();
  });
  it("does not confirm invalid upstream totals", async () => {
    api.request.mockResolvedValue({ status: 200, body: { counted: true } });
    expect((await POST(request(), context)).status).toBe(503);
    expect(api.revalidate).not.toHaveBeenCalled();
  });
});
