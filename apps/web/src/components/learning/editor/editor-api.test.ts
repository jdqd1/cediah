import { describe, expect, it, vi } from "vitest";
import {
  createEditorApi,
  EditorQueryError,
  unwrapEditorReadResult,
} from "./editor-api";

const pathId = "b3000000-0000-4000-8000-000000000001";
const contentId = "b3000000-0000-4000-8000-000000000002";
const optionId = "b3000000-0000-4000-8000-000000000003";
const detail = {
  archivedAt: null,
  coverKey: "lungs",
  createdBy: "b3000000-0000-4000-8000-000000000004",
  enrollment: null,
  id: pathId,
  slug: "ruta-api",
  summary: "Ruta de prueba del transporte.",
  title: "Ruta API",
  topic: { id: contentId, title: "Tema" },
  version: {
    editVersion: 7,
    evidenceLevel: "standard",
    id: "b3000000-0000-4000-8000-000000000005",
    number: 1,
    policyVersion: "guided-v1",
    publishedAt: null,
    releaseNotes: "",
    status: "draft",
    units: [],
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

describe("editor API", () => {
  it("sends expectedVersion when validating and parses the confirmed version", async () => {
    const fetcher = vi.fn(async () => json({ issues: [], ready: true, validatedEditVersion: 7 }));
    const api = createEditorApi(fetcher as typeof fetch);
    await expect(api.validate(pathId, 7)).resolves.toEqual({
      ok: true,
      status: 200,
      value: { issues: [], ready: true, validatedEditVersion: 7 },
    });
    expect(fetcher).toHaveBeenCalledWith(
      `/api/editor/learning-paths/${pathId}/validate`,
      expect.objectContaining({ body: JSON.stringify({ expectedVersion: 7 }), method: "POST" }),
    );
  });

  it.each([400, 401, 403, 404, 409, 422, 429, 503] as const)(
    "preserves the safe %s failure status and code",
    async (status) => {
      const api = createEditorApi(vi.fn(async () => json({ error: "safe_code" }, status)) as typeof fetch);
      expect(await api.validate(pathId, 7)).toEqual({ errorCode: "safe_code", ok: false, status });
    },
  );

  it("does not mistake an error or malformed success for a validation result", async () => {
    const failed = createEditorApi(vi.fn(async () => json({ issues: [], ready: false }, 422)) as typeof fetch);
    expect(await failed.validate(pathId, 7)).toEqual({
      errorCode: "invalid_response",
      ok: false,
      status: 422,
    });
    const malformed = createEditorApi(vi.fn(async () => json({ issues: [], ready: "yes" })) as typeof fetch);
    expect(await malformed.validate(pathId, 7)).toEqual({
      errorCode: "invalid_response",
      ok: false,
      status: 503,
    });
  });

  it("passes the query signal through and safely encodes filters and detail paths", async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher.mockImplementation(async (url) => String(url).includes("learning-resources?")
      ? json({ items: [], nextCursor: null, resourceTopics: [], topics: [] })
      : json({
          currentSourceVersion: null,
          estimatedMinutes: null,
          explanationCoverage: "not_applicable",
          items: [],
          projection: "guide",
          resourceRevisionId: null,
          sourceContentId: contentId,
          sourceVersion: 1,
          status: "ready",
          title: "Guía",
        }));
    const api = createEditorApi(fetcher as typeof fetch);
    const controller = new AbortController();
    await api.search({ limit: 24, q: "pared & tórax", topic: "Tórax" }, controller.signal);
    expect(fetcher.mock.calls[0]![0]).toBe(
      "/api/editor/learning-resources?limit=24&q=pared+%26+t%C3%B3rax&topic=T%C3%B3rax",
    );
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ signal: controller.signal });
    await api.currentDetail(contentId, "guide", controller.signal);
    expect(fetcher.mock.calls[1]![0]).toBe(
      `/api/editor/learning-resources/${contentId}?projection=guide`,
    );
  });

  it("preserves cancellation and converts other network failures", async () => {
    const controller = new AbortController();
    controller.abort();
    const aborted = new DOMException("aborted", "AbortError");
    const api = createEditorApi(vi.fn(async () => { throw aborted; }) as typeof fetch);
    await expect(api.search({}, controller.signal)).rejects.toBe(aborted);

    const offline = createEditorApi(vi.fn(async () => { throw new Error("private network detail"); }) as typeof fetch);
    expect(await offline.fixedDetail(pathId, optionId)).toEqual({
      errorCode: "network_error",
      ok: false,
      status: 503,
    });
  });

  it("unwraps successful reads and throws a safe typed query error for failures", () => {
    expect(unwrapEditorReadResult({ ok: true, status: 200, value: "ready" })).toBe("ready");
    expect(() => unwrapEditorReadResult({ errorCode: "forbidden", ok: false, status: 403 }))
      .toThrow(EditorQueryError);
    try {
      unwrapEditorReadResult({ errorCode: "forbidden", ok: false, status: 403 });
    } catch (error) {
      expect(error).toMatchObject({ errorCode: "forbidden", message: "No se pudo completar la lectura del editor.", status: 403 });
    }
  });

  it("uses the explicit mutation endpoints", async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher.mockImplementation(async () => json(detail));
    const api = createEditorApi(fetcher as typeof fetch);
    await api.createVersion(pathId, "Notas");
    await api.transition(pathId, 7, "in_review");
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      `/api/editor/learning-paths/${pathId}/versions`,
      `/api/editor/learning-paths/${pathId}/transition`,
    ]);
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ body: JSON.stringify({ releaseNotes: "Notas" }) });
    expect(fetcher.mock.calls[1]![1]).toMatchObject({ body: JSON.stringify({ expectedVersion: 7, status: "in_review" }) });
  });
});
