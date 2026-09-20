import { beforeEach, describe, expect, it, vi } from "vitest";

const upstream = vi.hoisted(() => ({ request: vi.fn(), session: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/api-session", () => ({ getApiRequestCookie: upstream.session }));
vi.mock("@/lib/server/content-api", () => ({
  getContentApiError: () => "unavailable",
  requestContentApi: upstream.request,
}));

import { GET as getMaterial } from "../app/api/editor/learning-resources/[contentId]/route";
import { GET as getPath } from "../app/api/editor/learning-paths/[...path]/route";

const pathId = "b2000000-0000-4000-8000-000000000001";
const optionId = "b2000000-0000-4000-8000-000000000002";
const contentId = "b2000000-0000-4000-8000-000000000003";
const material = {
  currentSourceVersion: 2,
  estimatedMinutes: 8,
  explanationCoverage: "complete",
  items: [{ id: optionId, kind: "question", prompt: "Pregunta local" }],
  projection: "quiz",
  resourceRevisionId: null,
  sourceContentId: contentId,
  sourceVersion: 2,
  status: "ready",
  title: "Material local",
};

beforeEach(() => {
  vi.clearAllMocks();
  upstream.session.mockResolvedValue({ cookie: "private-session", status: "ready" });
  upstream.request.mockResolvedValue({ body: material, status: 200 });
});

describe("learning editor BFF allowlist", () => {
  it("forwards a validated current material detail and keeps it private", async () => {
    const request = new Request(`https://cediah.test/api/editor/learning-resources/${contentId}?projection=quiz`);
    const response = await getMaterial(request, { params: Promise.resolve({ contentId }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(upstream.request).toHaveBeenCalledWith(expect.objectContaining({
      cookie: "private-session",
      method: "GET",
      path: `/v1/editor/learning-resources/${contentId}?projection=quiz`,
    }));
  });

  it("rejects invalid detail identifiers, projections and extra query keys locally", async () => {
    const invalidCases: Array<[string, string]> = [
      ["not-a-uuid", "projection=quiz"],
      [contentId, "projection=unknown"],
      [contentId, "projection=quiz&admin=true"],
    ];
    for (const [id, query] of invalidCases) {
      const response = await getMaterial(
        new Request(`https://cediah.test/api/editor/learning-resources/${id}?${query}`),
        { params: Promise.resolve({ contentId: id }) },
      );
      expect(response.status).toBe(404);
    }
    expect(upstream.request).not.toHaveBeenCalled();
  });

  it("allows only the exact fixed-material path", async () => {
    const request = new Request(`https://cediah.test/api/editor/learning-paths/${pathId}/materials/${optionId}`);
    expect((await getPath(request, {
      params: Promise.resolve({ path: [pathId, "materials", optionId] }),
    })).status).toBe(200);
    expect(upstream.request).toHaveBeenCalledWith(expect.objectContaining({
      path: `/v1/editor/learning-paths/${pathId}/materials/${optionId}`,
    }));

    upstream.request.mockClear();
    for (const path of [
      [pathId, "materials", "bad-id"],
      [pathId, "materials", optionId, "extra"],
      [pathId, "admin", optionId],
    ]) {
      expect((await getPath(request, { params: Promise.resolve({ path }) })).status).toBe(404);
    }
    expect(upstream.request).not.toHaveBeenCalled();
  });
});
