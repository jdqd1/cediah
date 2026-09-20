import { describe, expect, it } from "vitest";
import { createActivityFromMaterial, createEmptyDraft, createUnit } from "./editor-model";
import { previewDuration } from "./route-preview";

const ids = [
  "fc000000-0000-4000-8000-000000000001",
  "fc000000-0000-4000-8000-000000000002",
  "fc000000-0000-4000-8000-000000000003",
  "fc000000-0000-4000-8000-000000000004",
  "fc000000-0000-4000-8000-000000000005",
  "fc000000-0000-4000-8000-000000000006",
  "fc000000-0000-4000-8000-000000000007",
];

describe("local route preview", () => {
  it("sums only the recommended option of each activity", () => {
    let index = 0;
    const createId = () => ids[index++]!;
    const draft = createEmptyDraft([]);
    const unit = createUnit(createId);
    unit.objectives[0]!.title = "Identificar";
    const activity = createActivityFromMaterial({
      createId,
      detail: {
        currentSourceVersion: 1,
        estimatedMinutes: 12,
        explanationCoverage: "not_applicable",
        items: [],
        projection: "guide",
        resourceRevisionId: null,
        sourceContentId: ids[6]!,
        sourceVersion: 1,
        status: "ready",
        title: "Guía",
      },
      objectiveIds: [unit.objectives[0]!.id],
    });
    activity.options.push({ ...activity.options[0]!, estimatedMinutes: 40, id: ids[5]!, isDefault: false });
    unit.steps.push(activity);
    draft.definition.units.push(unit);
    expect(previewDuration(draft)).toBe(12);
  });

  it("does not present a partial duration as an exact total", () => {
    const draft = createEmptyDraft([]);
    const unit = createUnit(() => "fc000000-0000-4000-8000-000000000001");
    unit.steps.push({
      id: "fc000000-0000-4000-8000-000000000002",
      isEssential: true,
      objectiveIds: [unit.objectives[0]!.id],
      options: [],
      pedagogyVersion: 1,
      purpose: "understand",
      recommendedAfter: [],
      stableKey: "actividad-sin-duracion",
      title: "Pendiente",
    });
    draft.definition.units.push(unit);
    expect(previewDuration(draft)).toBeNull();
  });
});
