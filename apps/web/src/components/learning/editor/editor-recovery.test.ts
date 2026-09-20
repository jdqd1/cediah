import { describe, expect, it } from "vitest";
import { createEditorStateFromDetail, createNewEditorState } from "./editor-model";
import { editorFixture } from "./editor-fixtures";
import {
  EDITOR_RECOVERY_TTL_MS,
  applyEditorRecovery,
  createEditorRecovery,
  editorRecoveryKey,
  parseEditorRecovery,
  recoveryMatchesBase,
} from "./editor-recovery";

const actorA = "f1000000-0000-4000-8000-000000000001";
const actorB = "f1000000-0000-4000-8000-000000000002";

function state() {
  const result = createNewEditorState({
    createId: () => "f1000000-0000-4000-8000-000000000003",
    topics: [],
  });
  result.dirty = true;
  result.draft.title = "Texto todavía incompleto";
  result.localRevision = 3;
  return result;
}

describe("editor recovery", () => {
  it("isolates cache keys by actor and route", () => {
    expect(editorRecoveryKey(actorA)).not.toBe(editorRecoveryKey(actorB));
    expect(editorRecoveryKey(actorA, "f1000000-0000-4000-8000-000000000004"))
      .toBe(`cediah:route-editor:v1:${actorA}:f1000000-0000-4000-8000-000000000004`);
  });

  it("roundtrips incomplete local text without accepting extra properties", () => {
    const recovery = createEditorRecovery(state(), 1_000);
    const parsed = parseEditorRecovery(JSON.stringify(recovery), 2_000);
    expect(parsed).toMatchObject({ status: "available", recovery: { draft: { title: "Texto todavía incompleto" } } });
    expect(parseEditorRecovery(JSON.stringify({ ...recovery, cookie: "secret" }), 2_000)).toEqual({ status: "invalid" });
  });

  it("roundtrips a hydrated route with fixed material configuration", () => {
    const current = createEditorStateFromDetail(editorFixture("ready").initialPath!);
    current.dirty = true;
    current.draft.title = "Borrador en conflicto";
    const recovery = createEditorRecovery(current, 1_000);
    expect(parseEditorRecovery(JSON.stringify(recovery), 2_000)).toMatchObject({
      recovery: { draft: { title: "Borrador en conflicto" } },
      status: "available",
    });
  });

  it("expires at 24 hours and rejects future or malformed entries", () => {
    const recovery = createEditorRecovery(state(), 1_000);
    expect(parseEditorRecovery(JSON.stringify(recovery), 1_000 + EDITOR_RECOVERY_TTL_MS)).toEqual({ status: "expired" });
    expect(parseEditorRecovery(JSON.stringify({ ...recovery, savedAt: 70_001 }), 1_000)).toEqual({ status: "expired" });
    expect(parseEditorRecovery("{broken", 2_000)).toEqual({ status: "invalid" });
  });

  it("requires the same base version and recovers only after an explicit action", () => {
    const current = state();
    const recovery = { ...createEditorRecovery(current, 1_000), baseEditVersion: 8 };
    expect(recoveryMatchesBase(recovery, 9)).toBe(false);
    expect(current.draft.title).toBe("Texto todavía incompleto");
    const recovered = applyEditorRecovery(current, recovery);
    expect(recovered.dirty).toBe(true);
    expect(recovered.validation).toBeNull();
    expect(recovered.draft).not.toBe(recovery.draft);
  });
});
