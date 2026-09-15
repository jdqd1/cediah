import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ forward: vi.fn() }));

vi.mock("@/lib/server/editor-content-route", () => ({
  forwardEditorContentRequest: api.forward,
  noStoreContentJson: (body: unknown, status = 200) => Response.json(body, { status }),
  readContentJson: async (request: Request) => {
    try {
      return { body: await request.json(), status: "ready" as const };
    } catch {
      return { status: "invalid" as const };
    }
  },
}));

import { POST } from "../app/api/editor/content/[contentId]/transition/route";

const contentId = "10000000-0000-4000-8000-000000000001";
const url = `https://koras.example/api/editor/content/${contentId}/transition`;
const context = () => ({ params: Promise.resolve({ contentId }) });
const request = (status: string) => new Request(url, {
  body: JSON.stringify({ status }),
  headers: { "Content-Type": "application/json" },
  method: "POST",
});
const upstreamResponse = (status = 200) => new Response(null, { status });

beforeEach(() => {
  vi.clearAllMocks();
  api.forward.mockResolvedValue(upstreamResponse());
});

describe("editor content transition endpoint", () => {
  it("approves and publishes in one browser action", async () => {
    const response = await POST(request("approved"), context());

    expect(response.status).toBe(200);
    expect(api.forward).toHaveBeenCalledTimes(2);
    expect(api.forward).toHaveBeenNthCalledWith(1, expect.objectContaining({
      body: { status: "approved" },
      method: "POST",
      path: `/v1/editor/content/${contentId}/transition`,
    }));
    expect(api.forward).toHaveBeenNthCalledWith(2, expect.objectContaining({
      body: { status: "published" },
      method: "POST",
      path: `/v1/editor/content/${contentId}/transition`,
    }));
  });

  it("does not publish when approval fails", async () => {
    api.forward.mockResolvedValueOnce(upstreamResponse(409));

    const response = await POST(request("approved"), context());

    expect(response.status).toBe(409);
    expect(api.forward).toHaveBeenCalledTimes(1);
  });

  it("forwards other transitions unchanged", async () => {
    const response = await POST(request("archived"), context());

    expect(response.status).toBe(200);
    expect(api.forward).toHaveBeenCalledTimes(1);
    expect(api.forward).toHaveBeenCalledWith(expect.objectContaining({
      body: { status: "archived" },
      method: "POST",
      path: `/v1/editor/content/${contentId}/transition`,
    }));
  });

  it("rejects invalid transition payloads before contacting the API", async () => {
    const response = await POST(request("unknown"), context());

    expect(response.status).toBe(400);
    expect(api.forward).not.toHaveBeenCalled();
  });
});
