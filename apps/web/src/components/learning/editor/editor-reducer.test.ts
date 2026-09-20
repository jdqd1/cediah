import { describe, expect, it } from "vitest";
import type { EditorActivity, EditorOption, EditorUnit, RouteEditorState } from "./editor-model";
import { createNewEditorState } from "./editor-model";
import { routeEditorReducer } from "./editor-reducer";

const unitAId = "50000000-0000-4000-8000-000000000001";
const unitBId = "50000000-0000-4000-8000-000000000002";
const activityAId = "50000000-0000-4000-8000-000000000003";
const activityBId = "50000000-0000-4000-8000-000000000004";
const objectiveAId = "50000000-0000-4000-8000-000000000005";
const objectiveBId = "50000000-0000-4000-8000-000000000006";
const optionAId = "50000000-0000-4000-8000-000000000007";
const optionBId = "50000000-0000-4000-8000-000000000008";
const resourceAId = "50000000-0000-4000-8000-000000000009";
const resourceBId = "50000000-0000-4000-8000-000000000010";
const rewardId = "50000000-0000-4000-8000-000000000011";
const itemId = "50000000-0000-4000-8000-000000000012";

function option(id: string, sourceContentId: string, isDefault: boolean): EditorOption {
  return {
    completionRule: { completion: "submitted", type: "quiz" },
    config: {
      objectiveMappings: [{ itemId, objectiveIds: [objectiveAId] }],
      selectedItemIds: [itemId],
    },
    estimatedMinutes: 10,
    id,
    isDefault,
    label: "Responder cuestionario",
    projection: "quiz",
    rewardIdentity: rewardId,
    rewardVersion: 4,
    sourceContentId,
  };
}

function activity(input: {
  id: string;
  options?: EditorOption[];
  recommendedAfter?: string[];
  stableKey: string;
}): EditorActivity {
  return {
    id: input.id,
    isEssential: true,
    objectiveIds: [objectiveAId],
    options: input.options ?? [],
    pedagogyVersion: 3,
    purpose: "check",
    recommendedAfter: input.recommendedAfter ?? [],
    stableKey: input.stableKey,
    title: input.stableKey,
  };
}

function unit(id: string, steps: EditorActivity[]): EditorUnit {
  return {
    id,
    objectives: [
      { id: objectiveAId, importance: 3, title: "Objetivo A" },
      { id: objectiveBId, importance: 2, title: "Objetivo B" },
    ],
    pedagogyVersion: 2,
    stableKey: `unidad-${id}`,
    steps,
    title: id === unitAId ? "Unidad A" : "Unidad B",
  };
}

function state(): RouteEditorState {
  const base = createNewEditorState({ createId: () => "50000000-0000-4000-8000-000000000099", topics: [] });
  const first = activity({
    id: activityAId,
    options: [option(optionAId, resourceAId, true), option(optionBId, resourceBId, false)],
    stableKey: "actividad-a",
  });
  const second = activity({
    id: activityBId,
    recommendedAfter: ["actividad-a"],
    stableKey: "actividad-b",
  });
  return {
    ...base,
    draft: {
      ...base.draft,
      definition: { ...base.draft.definition, units: [unit(unitAId, [first]), unit(unitBId, [second])] },
    },
    expandedActivityId: activityAId,
    expandedUnitId: unitAId,
    validation: { editVersion: 2, issues: [], localRevision: 0, ready: true },
  };
}

describe("route editor reducer", () => {
  it("removes a unit by id and cleans incoming dependencies in every remaining unit", () => {
    const before = state();
    const after = routeEditorReducer(before, { type: "remove-unit", unitId: unitAId });
    expect(after.draft.definition.units.map((entry) => entry.id)).toEqual([unitBId]);
    expect(after.draft.definition.units[0]!.steps[0]!.recommendedAfter).toEqual([]);
    expect(after.expandedUnitId).toBeNull();
    expect(after.expandedActivityId).toBeNull();
    expect(after).toMatchObject({ dirty: true, localRevision: 1, validation: null });
    expect(before.draft.definition.units).toHaveLength(2);
  });

  it("permits removing the last unit and treats a missing id as an exact no-op", () => {
    const one = state();
    one.draft.definition.units = [one.draft.definition.units[0]!];
    const empty = routeEditorReducer(one, { type: "remove-unit", unitId: unitAId });
    expect(empty.draft.definition.units).toEqual([]);
    expect(routeEditorReducer(empty, { type: "remove-unit", unitId: unitAId })).toBe(empty);
  });

  it("changes a label without rebuilding config, completion rule or identities", () => {
    const before = state();
    const current = before.draft.definition.units[0]!.steps[0]!.options[0]!;
    const after = routeEditorReducer(before, {
      activityId: activityAId,
      optionId: optionAId,
      patch: { label: "Práctica final" },
      type: "update-option",
      unitId: unitAId,
    });
    const updated = after.draft.definition.units[0]!.steps[0]!.options[0]!;
    expect(updated).toEqual({ ...current, label: "Práctica final" });
    expect(updated.config).toBe(current.config);
    expect(updated.completionRule).toBe(current.completionRule);
    expect(updated.rewardIdentity).toBe(rewardId);
  });

  it("updates item mappings without rebuilding unrelated option configuration", () => {
    const before = state();
    const current = before.draft.definition.units[0]!.steps[0]!.options[0]!;
    current.config.videoRange = { endSeconds: 90, startSeconds: 10 };
    const nextItemId = "10000000-0000-4000-8000-000000000015";
    const after = routeEditorReducer(before, {
      activityId: activityAId,
      objectiveMappings: [{ itemId: nextItemId, objectiveIds: [objectiveAId] }],
      optionId: optionAId,
      selectedItemIds: [nextItemId],
      type: "update-option-mappings",
      unitId: unitAId,
    });
    const updated = after.draft.definition.units[0]!.steps[0]!.options[0]!;
    expect(updated.config).toEqual({
      objectiveMappings: [{ itemId: nextItemId, objectiveIds: [objectiveAId] }],
      selectedItemIds: [nextItemId],
      videoRange: { endSeconds: 90, startSeconds: 10 },
    });
    expect(updated.completionRule).toBe(current.completionRule);
    expect(updated.rewardIdentity).toBe(current.rewardIdentity);
    expect(updated.sourceContentId).toBe(current.sourceContentId);
  });

  it("promotes exactly one remaining option after removing the recommended one", () => {
    const after = routeEditorReducer(state(), {
      activityId: activityAId,
      optionId: optionAId,
      type: "remove-option",
      unitId: unitAId,
    });
    const options = after.draft.definition.units[0]!.steps[0]!.options;
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ id: optionBId, isDefault: true, rewardIdentity: rewardId });
  });

  it("allows zero options and preserves the activity", () => {
    const before = state();
    before.draft.definition.units[0]!.steps[0]!.options = [option(optionAId, resourceAId, true)];
    const after = routeEditorReducer(before, {
      activityId: activityAId,
      optionId: optionAId,
      type: "remove-option",
      unitId: unitAId,
    });
    expect(after.draft.definition.units[0]!.steps[0]!.options).toEqual([]);
  });

  it("reassigns a referenced objective explicitly and deduplicates ids without changing items", () => {
    const before = state();
    const first = before.draft.definition.units[0]!.steps[0]!;
    first.objectiveIds = [objectiveAId, objectiveBId];
    first.options[0]!.config.objectiveMappings[0]!.objectiveIds = [objectiveAId, objectiveBId];
    const blocked = routeEditorReducer(before, {
      objectiveId: objectiveAId,
      type: "remove-objective",
      unitId: unitAId,
    });
    expect(blocked).toBe(before);

    const after = routeEditorReducer(before, {
      objectiveId: objectiveAId,
      replacementObjectiveId: objectiveBId,
      type: "remove-objective",
      unitId: unitAId,
    });
    const updated = after.draft.definition.units[0]!.steps[0]!;
    expect(updated.objectiveIds).toEqual([objectiveBId]);
    expect(updated.options[0]!.config.objectiveMappings).toEqual([
      { itemId, objectiveIds: [objectiveBId] },
    ]);
    expect(updated.options[0]!.config.selectedItemIds).toEqual([itemId]);
  });

  it("reorders arrays without rewriting explicit dependencies", () => {
    const before = state();
    const dependency = before.draft.definition.units[1]!.steps[0]!.recommendedAfter;
    const after = routeEditorReducer(before, { direction: -1, type: "move-unit", unitId: unitBId });
    expect(after.draft.definition.units.map((entry) => entry.id)).toEqual([unitBId, unitAId]);
    expect(after.draft.definition.units[0]!.steps[0]!.recommendedAfter).toBe(dependency);
  });

  it("resets only material-specific fields during an explicit replacement", () => {
    const before = state();
    const current = before.draft.definition.units[0]!.steps[0]!.options[0]!;
    const after = routeEditorReducer(before, {
      activityId: activityAId,
      optionId: optionAId,
      replacement: {
        config: { objectiveMappings: [], selectedItemIds: [] },
        estimatedMinutes: null,
        expectedSourceVersion: 9,
        projection: "guide",
        sourceContentId: resourceBId,
      },
      type: "replace-option-material",
      unitId: unitAId,
    });
    const updated = after.draft.definition.units[0]!.steps[0]!.options[0]!;
    expect(updated).toMatchObject({
      completionRule: undefined,
      id: current.id,
      label: current.label,
      projection: "guide",
      refreshResource: true,
      rewardIdentity: current.rewardIdentity,
      rewardVersion: current.rewardVersion,
      sourceContentId: resourceBId,
    });
  });

  it("blocks mutations while an operation is active", () => {
    const before = { ...state(), operation: "saving" as const };
    expect(routeEditorReducer(before, { type: "remove-unit", unitId: unitAId })).toBe(before);
  });
});
