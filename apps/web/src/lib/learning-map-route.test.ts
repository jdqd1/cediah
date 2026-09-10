import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ session: vi.fn(), request: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/api-session", () => ({
  getApiRequestCookie: api.session,
}));
vi.mock("@/lib/server/content-api", () => ({
  requestContentApi: api.request,
  getContentApiError: () => "unavailable",
}));
import { GET, POST, PATCH } from "../app/api/guided-learning/[...path]/route";

const id = "b1000000-0000-4000-8000-000000000001";
const context = (...path: string[]) => ({
  params: Promise.resolve(path.length ? { path } : { path: ["map"] }),
});
const request = (method = "GET", origin = "https://koras.example") =>
  new Request("https://koras.example/api/guided-learning/map", {
    method,
    headers: {
      origin,
      "Content-Type": "application/json",
      "Idempotency-Key": id,
    },
    ...(method === "GET" ? {} : { body: "{}" }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  api.session.mockResolvedValue({
    status: "ready",
    cookie: "private-test-session",
  });
  api.request.mockResolvedValue({
    status: 200,
    body: {
      map: null,
      nodes: [],
      structuralVersion: 0,
      progress: {
        status: "empty",
        percentage: null,
        completedEssentialSteps: 0,
        totalEssentialSteps: 0,
        started: false,
      },
    },
  });
});
describe("map BFF allowlist and trust boundary", () => {
  it("forwards only the explicit paths and methods", async () => {
    expect((await GET(request(), context("map"))).status).toBe(200);
    expect(api.request.mock.calls[0]?.[0]).toMatchObject({
      path: "/v1/guided-learning/map",
      cookie: "private-test-session",
      method: "GET",
    });
    api.request.mockClear();
    for (const path of [
      ["map", "admin"],
      ["map", "level", "extra"],
      ["map", "..", "users"],
    ])
      expect((await GET(request(), context(...path))).status).toBe(404);
    expect((await POST(request("POST"), context("map", "layout"))).status).toBe(
      404,
    );
    expect(
      (await PATCH(request("PATCH"), context("map", "nodes", "bad-id"))).status,
    ).toBe(404);
    expect(api.request).not.toHaveBeenCalled();
  });
  it("rejects foreign origins and anonymous requests before forwarding mutations", async () => {
    expect(
      (
        await POST(
          request("POST", "https://foreign.example"),
          context("map", "ensure"),
        )
      ).status,
    ).toBe(403);
    api.session.mockResolvedValue({ status: "anonymous" });
    expect((await POST(request("POST"), context("map", "ensure"))).status).toBe(
      401,
    );
    expect(api.request).not.toHaveBeenCalled();
  });
  it("validates upstream DTOs and keeps successful responses private", async () => {
    const response = await GET(request(), context("map"));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    api.request.mockResolvedValue({
      status: 200,
      body: { map: null, manifest: { secret: "not-a-map-dto" } },
    });
    const invalid = await GET(request(), context("map"));
    expect(invalid.status).toBe(502);
    expect(await invalid.text()).not.toContain("not-a-map-dto");
  });
});
