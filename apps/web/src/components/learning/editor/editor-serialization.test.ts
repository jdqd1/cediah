import { describe, expect, it } from "vitest";
import { createEmptyDraft, createUnit, type EditorDraft } from "./editor-model";
import { serializeCreateRequest, serializeUpdateRequest } from "./editor-serialization";

const topicId = "40000000-0000-4000-8000-000000000001";
const unitId = "40000000-0000-4000-8000-000000000002";
const objectiveId = "40000000-0000-4000-8000-000000000003";
const blankObjectiveId = "40000000-0000-4000-8000-000000000004";
const activityId = "40000000-0000-4000-8000-000000000005";

function validDraft(): EditorDraft {
  const draft = createEmptyDraft([{ id: topicId, title: "Tórax" }]);
  const unit = createUnit((() => {
    const values = [unitId, objectiveId];
    let index = 0;
    return () => values[index++]!;
  })());
  unit.title = "  Unidad uno  ";
  unit.objectives[0]!.title = "  Identificar estructuras  ";
  return {
    ...draft,
    definition: { ...draft.definition, units: [unit] },
    slug: "ruta-prueba-40000000-0000-4000-8000-000000000099",
    summary: "  Descripción clara  ",
    title: "  Ruta de prueba  ",
  };
}

describe("route editor serialization", () => {
  it("trims author text and omits only blank unreferenced objectives", () => {
    const draft = validDraft();
    draft.definition.units[0]!.objectives.push({ id: blankObjectiveId, importance: 3, title: "   " });
    const result = serializeCreateRequest(draft);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      summary: "Descripción clara",
      title: "Ruta de prueba",
    });
    expect(result.value.definition.units[0]!.title).toBe("Unidad uno");
    expect(result.value.definition.units[0]!.objectives).toEqual([
      { id: objectiveId, importance: 3, title: "Identificar estructuras" },
    ]);
  });

  it("returns an objective target when a referenced objective is blank", () => {
    const draft = validDraft();
    const unit = draft.definition.units[0]!;
    unit.objectives.push({ id: blankObjectiveId, importance: 3, title: " " });
    unit.steps.push({
      id: activityId,
      isEssential: true,
      objectiveIds: [blankObjectiveId],
      options: [],
      pedagogyVersion: 1,
      purpose: "understand",
      recommendedAfter: [],
      stableKey: `actividad-${activityId}`,
      title: "Actividad",
    });
    const result = serializeCreateRequest(draft);
    expect(result).toMatchObject({
      errors: [{ target: { entity: "objective", objectiveId: blankObjectiveId, unitId } }],
      ok: false,
    });
  });

  it("maps contract errors to stable entity ids instead of array positions", () => {
    const draft = validDraft();
    draft.definition.units[0]!.title = " ";
    const result = serializeCreateRequest(draft);
    expect(result).toMatchObject({
      errors: [{ target: { entity: "unit", field: "title", unitId } }],
      ok: false,
    });
  });

  it("serializes an update with the confirmed expected version", () => {
    const result = serializeUpdateRequest(validDraft(), 7);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.expectedVersion).toBe(7);
    expect(JSON.stringify(result.value)).not.toContain("expandedUnitId");
    expect(JSON.stringify(result.value)).not.toContain("localRevision");
  });
});
