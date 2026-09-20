import { LearningPathDetailSchema } from "@cediah/contracts";
import { describe, expect, it } from "vitest";
import { editorDraftFromDetail } from "./editor-model";
import { serializeUpdateRequest } from "./editor-serialization";
import {
  createEditorFixtureRuntime,
  editorFixture,
  editorFixtureModes,
  isEditorFixtureEnabled,
} from "./editor-fixtures";

describe("editor visual fixtures", () => {
  it.each(editorFixtureModes)("builds a schema-valid %s state", (mode) => {
    const fixture = editorFixture(mode);
    if (fixture.initialPath) expect(LearningPathDetailSchema.safeParse(fixture.initialPath).success).toBe(true);
    if (mode === "new") expect(fixture.initialPath).toBeUndefined();
    if (mode === "empty-catalog") expect(fixture.initialResources).toEqual([]);
  });

  it("contains the exact ready, error, limited, legacy and long scenarios", async () => {
    const ready = editorFixture("ready").initialPath!;
    expect(ready.version.units).toHaveLength(1);
    expect(ready.version.units[0]!.objectives).toHaveLength(1);
    expect(ready.version.units[0]!.steps.map((step) => step.options[0]!.projection)).toEqual(["guide", "quiz"]);
    expect(new Set(ready.version.units[0]!.steps[1]!.options[0]!.config.selectedItemIds).size).toBe(5);

    const errorsRuntime = createEditorFixtureRuntime("errors");
    const errors = await errorsRuntime.transport.validate(editorFixture("errors").initialPath!.id, 1);
    expect(errors.ok && errors.value.issues.map((issue) => issue.code)).toEqual(["objective_understanding_missing", "insufficient_evidence"]);

    const limitedRuntime = createEditorFixtureRuntime("limited");
    const limited = await limitedRuntime.transport.validate(editorFixture("limited").initialPath!.id, 1);
    expect(limited.ok && limited.value.ready).toBe(true);
    expect(limited.ok && limited.value.issues.some((issue) => issue.code === "limited_evidence" && issue.severity === "warning")).toBe(true);

    const legacy = editorFixture("legacy").initialPath!;
    expect(legacy.version.units[0]!.objectives).toHaveLength(2);
    expect(legacy.version.units[0]!.steps.flatMap((step) => step.options).map((entry) => entry.projection)).toEqual(["guide", "video", "quiz", "flashcards"]);
    expect(legacy.version.units[0]!.steps.map((step) => step.purpose)).toEqual(["integrate", "diagnostic"]);

    const long = editorFixture("long").initialPath!;
    expect(long.title).toHaveLength(200);
    expect(long.version.units).toHaveLength(30);
    expect(long.version.units[0]!.title).toHaveLength(240);
  });

  it("enforces expectedVersion and mutates only its in-memory copy", async () => {
    const runtime = createEditorFixtureRuntime("ready");
    const initial = runtime.getPath()!;
    const serialized = serializeUpdateRequest(editorDraftFromDetail(initial), initial.version.editVersion);
    expect(serialized.ok).toBe(true);
    if (!serialized.ok) return;
    expect(await runtime.transport.save(initial.id, { ...serialized.value, expectedVersion: 99 })).toMatchObject({ ok: false, status: 409 });
    const saved = await runtime.transport.save(initial.id, serialized.value);
    expect(saved.ok && saved.value.version.editVersion).toBe(2);
    expect(runtime.requests).toEqual(["save:99", "save:1"]);
  });

  it("deletes only the matching mutable fixture version", async () => {
    const runtime = createEditorFixtureRuntime("ready");
    const initial = runtime.getPath()!;
    expect(await runtime.transport.deletePath(initial.id, initial.version.editVersion + 1))
      .toMatchObject({ errorCode: "version_conflict", ok: false, status: 409 });
    expect(await runtime.transport.deletePath(initial.id, initial.version.editVersion))
      .toEqual({ ok: true, status: 200, value: { id: initial.id } });
    expect(runtime.getPath()).toBeNull();
    expect(runtime.requests).toEqual(["delete:2", "delete:1"]);

    const published = createEditorFixtureRuntime("published");
    const publishedPath = published.getPath()!;
    expect(await published.transport.deletePath(publishedPath.id, publishedPath.version.editVersion))
      .toMatchObject({ errorCode: "conflict", ok: false, status: 409 });
  });

  it("provides deterministic failures and stale validation without blind retries", async () => {
    const failed = createEditorFixtureRuntime("ready", "save-503");
    const initial = failed.getPath()!;
    const serialized = serializeUpdateRequest(editorDraftFromDetail(initial), 1);
    if (!serialized.ok) throw new Error("fixture update must be valid");
    expect(await failed.transport.save(initial.id, serialized.value)).toMatchObject({ ok: false, status: 503 });
    expect(await failed.transport.save(initial.id, serialized.value)).toMatchObject({ ok: true });

    const stale = createEditorFixtureRuntime("ready", "validate-stale");
    expect(await stale.transport.validate(initial.id, 1)).toMatchObject({ ok: true, value: { validatedEditVersion: 2 } });
  });

  it("keeps read-only details and catalog operations free of editorial writes", async () => {
    const runtime = createEditorFixtureRuntime("legacy");
    const before = runtime.getPath();
    const optionId = before!.version.units[0]!.steps[0]!.options[0]!.id;
    await runtime.transport.search({ q: "pared" });
    await runtime.transport.currentDetail(before!.version.units[0]!.steps[0]!.options[0]!.sourceContentId, "guide");
    await runtime.transport.fixedDetail(before!.id, optionId);
    expect(runtime.getPath()).toEqual(before);
  });

  it("guards fixture routes outside development", () => {
    expect(isEditorFixtureEnabled("development")).toBe(true);
    expect(isEditorFixtureEnabled("production")).toBe(false);
    expect(isEditorFixtureEnabled("test")).toBe(false);
  });
});
