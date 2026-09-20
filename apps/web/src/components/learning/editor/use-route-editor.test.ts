import type { LearningPathDetail } from "@cediah/contracts";
import { describe, expect, it, vi } from "vitest";
import { createNewEditorState } from "./editor-model";
import { executeSaveThenValidate, prepareEditorSave } from "./use-route-editor";

const detail: LearningPathDetail = {
  archivedAt: null,
  coverKey: "lungs",
  createdBy: "fa000000-0000-4000-8000-000000000001",
  enrollment: null,
  id: "fa000000-0000-4000-8000-000000000002",
  slug: "ruta-confirmada",
  summary: "Resumen confirmado.",
  title: "Ruta confirmada",
  topic: { id: "fa000000-0000-4000-8000-000000000003", title: "Tema" },
  version: {
    editVersion: 9,
    evidenceLevel: "standard",
    id: "fa000000-0000-4000-8000-000000000004",
    number: 1,
    policyVersion: "guided-v1",
    publishedAt: null,
    releaseNotes: "",
    status: "draft",
    units: [],
  },
};

function validNewState() {
  const state = createNewEditorState({
    createId: () => "fa000000-0000-4000-8000-000000000005",
    topics: [{ id: detail.topic.id, title: detail.topic.title }],
  });
  state.dirty = true;
  state.draft.title = "Anatomía 🫁 del tórax";
  state.draft.summary = "Introducción para estudiantes.";
  return state;
}

describe("route editor orchestration", () => {
  it("freezes a deterministic slug only after the draft is locally valid", () => {
    const invalid = validNewState();
    invalid.draft.summary = "";
    expect(prepareEditorSave(invalid).ok).toBe(false);
    expect(invalid.frozenSlug).toBeNull();

    const prepared = prepareEditorSave(validNewState());
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.state.frozenSlug).toBe("anatomia-del-torax-fa000000-0000-4000-8000-000000000005");
    expect(prepared.request.slug).toBe(prepared.state.frozenSlug);
  });

  it("never validates when saving fails and preserves the failure", async () => {
    const validate = vi.fn();
    const failure = { errorCode: "network_error", ok: false as const, status: 503 as const };
    const result = await executeSaveThenValidate({
      persist: async () => ({ apiFailure: failure, ok: false, reason: "request" }),
      validate,
    });
    expect(result).toEqual({
      apiFailure: failure,
      ok: false,
      reason: "request",
    });
    expect(validate).not.toHaveBeenCalled();
  });

  it("validates the confirmed editVersion rather than a stale render", async () => {
    const validate = vi.fn(async (_pathId: string, expectedVersion: number) => ({
      ok: true as const,
      status: 200,
      value: { issues: [], ready: true, validatedEditVersion: expectedVersion },
    }));
    const result = await executeSaveThenValidate({
      persist: async () => ({ ok: true, value: detail }),
      validate,
    });
    expect(validate).toHaveBeenCalledWith(detail.id, 9);
    expect(result).toMatchObject({ ok: true, value: { confirmed: { version: { editVersion: 9 } } } });
  });

  it.each([8, undefined])("rejects ready from an unconfirmed version (%s)", async (validatedEditVersion) => {
    const result = await executeSaveThenValidate({
      persist: async () => ({ ok: true, value: detail }),
      validate: async () => ({
        ok: true,
        status: 200,
        value: { issues: [], ready: true, validatedEditVersion },
      }),
    });
    expect(result).toEqual({ ok: false, reason: "outdated_validation" });
  });

  it("does not reinterpret a server error as validation success", async () => {
    const failure = { errorCode: "version_conflict", ok: false as const, status: 409 as const };
    const result = await executeSaveThenValidate({
      persist: async () => ({ ok: true, value: detail }),
      validate: async () => failure,
    });
    expect(result).toEqual({
      apiFailure: failure,
      ok: false,
      reason: "request",
      requestStage: "validate",
    });
  });
});
