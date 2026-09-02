import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ session: vi.fn(), request: vi.fn() }));
vi.mock("@/lib/server/api-session", () => ({ getApiRequestCookie: api.session }));
vi.mock("@/lib/server/content-api", () => ({
  requestContentApi: api.request,
  safeContentApiStatus: (status: number) => [400, 401, 403, 404, 503].includes(status) ? status : 503,
}));
import { GET, PATCH } from "../app/api/content/[contentId]/reaction/route";

const contentId = "10000000-0000-4000-8000-000000000001";
const url = `https://koraz.example/api/content/${contentId}/reaction`;
const context = () => ({ params: Promise.resolve({ contentId }) });
const request = (body: unknown, origin = "https://koraz.example") => new Request(url, {
  method: "PATCH", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  api.session.mockResolvedValue({ cookie: "test-session=local-only", status: "ready" });
  api.request.mockResolvedValue({ status: 200, body: { reaction: "liked", likeCount: 20, dislikeCount: 4 } });
});

describe("private browser reaction endpoint", () => {
  it("forwards only a validated choice and returns no aggregate counts", async () => {
    const response = await PATCH(request({ reaction: "liked" }), context());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ reaction: "liked" });
    expect(api.request).toHaveBeenCalledWith({ body: { reaction: "liked" }, cookie: "test-session=local-only", method: "PATCH", path: `/v1/content/${contentId}/reaction` });
  });
  it("does not expose aggregate counts on reads either", async () => {
    const response = await GET(new Request(url), context());
    expect(await response.json()).toEqual({ reaction: "liked" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("rejects foreign origins before contacting the API", async () => {
    expect((await PATCH(request({ reaction: "liked" }, "https://attacker.example"), context())).status).toBe(403);
    expect(api.request).not.toHaveBeenCalled();
  });
  it("requires a session for both reads and writes", async () => {
    api.session.mockResolvedValue({ status: "anonymous" });
    expect((await GET(new Request(url), context())).status).toBe(401);
    expect((await PATCH(request({ reaction: "liked" }), context())).status).toBe(401);
    expect(api.request).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON, unsupported choices and identity/count overrides", async () => {
    for (const body of [{ reaction: "up" }, { reaction: "liked", viewerKey: "wrong" }, { reaction: "liked", likeCount: 50 }, {}]) {
      expect((await PATCH(request(body), context())).status).toBe(400);
    }
    expect((await PATCH(new Request(url, { method: "PATCH", body: "invalid", headers: { origin: "https://koraz.example" } }), context())).status).toBe(400);
    expect(api.request).not.toHaveBeenCalled();
  });
  it("fails closed for invalid upstream data and unavailable persistence", async () => {
    api.request.mockResolvedValueOnce({ status: 200, body: { reaction: "invalid" } });
    expect((await GET(new Request(url), context())).status).toBe(503);
    api.request.mockResolvedValueOnce({ status: 500, body: { error: "database details" } });
    const response = await PATCH(request({ reaction: null }), context());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "reactions_unavailable" });
  });
});
