import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createObjective, createUnit } from "./editor-model";
import { routeEditorReducer } from "./editor-reducer";
import { UnitCards, unitHasCompleteObjective, unitObjectiveIsReferenced } from "./unit-card";
import { createNewEditorState } from "./editor-model";
import { EditorFocusProvider } from "./editor-focus";

describe("unit cards", () => {
  it("shows every objective without exposing stable keys", () => {
    const unit = createUnit(() => "d1000000-0000-4000-8000-000000000001");
    unit.title = "Pared torácica";
    unit.objectives[0]!.title = "Identificar estructuras";
    unit.objectives.push({ ...createObjective(() => "d1000000-0000-4000-8000-000000000002"), title: "Comparar relaciones" });
    const html = renderToStaticMarkup(
      <EditorFocusProvider><UnitCards
        allActivities={unit.steps}
        disabled={false}
        expandedActivityId={null}
        expandedUnitId={unit.id}
        onAddActivity={() => {}}
        onDispatch={() => {}}
        onExpandedUnitChange={() => {}}
        onExpandedActivityChange={() => {}}
        onHelpChange={() => {}}
        onOpenPicker={() => {}}
        onMoreOptionsOpenChange={() => {}}
        onRequestAddUnit={() => {}}
        openHelp={null}
        openMoreActivityId={null}
        optionRevisionById={new Map()}
        scope={["route-editor", "d1000000-0000-4000-8000-000000000009", "new:test"]}
        units={[unit]}
      /></EditorFocusProvider>,
    );
    expect(html).toContain("Identificar estructuras");
    expect(html).toContain("Comparar relaciones");
    expect(html).toContain("Acciones de la unidad Pared torácica");
    expect(html).not.toContain(unit.stableKey);
  });

  it("detects whether an objective is complete or referenced", () => {
    const unit = createUnit(() => "d2000000-0000-4000-8000-000000000001");
    const objectiveId = unit.objectives[0]!.id;
    expect(unitHasCompleteObjective(unit)).toBe(false);
    expect(unitObjectiveIsReferenced(unit, objectiveId)).toBe(false);
    unit.objectives[0]!.title = "Explicar la región";
    unit.steps.push({
      id: "d2000000-0000-4000-8000-000000000002",
      isEssential: true,
      objectiveIds: [objectiveId],
      options: [],
      pedagogyVersion: 1,
      purpose: "understand",
      recommendedAfter: [],
      stableKey: "actividad-d2000000-0000-4000-8000-000000000002",
      title: "Comprender",
    });
    expect(unitHasCompleteObjective(unit)).toBe(true);
    expect(unitObjectiveIsReferenced(unit, objectiveId)).toBe(true);
  });

  it("removes a unit locally and cleans dependencies without deleting material data", () => {
    const first = createUnit(() => "d3000000-0000-4000-8000-000000000001");
    const second = createUnit(() => "d3000000-0000-4000-8000-000000000002");
    second.steps.push({
      id: "d3000000-0000-4000-8000-000000000003",
      isEssential: true,
      objectiveIds: [],
      options: [],
      pedagogyVersion: 1,
      purpose: "understand",
      recommendedAfter: ["actividad-eliminada"],
      stableKey: "actividad-conservada",
      title: "Conservar",
    });
    first.steps.push({ ...second.steps[0]!, id: "d3000000-0000-4000-8000-000000000004", stableKey: "actividad-eliminada" });
    const state = createNewEditorState({ createId: () => "d3000000-0000-4000-8000-000000000010", topics: [] });
    state.draft.definition.units = [first, second];
    const next = routeEditorReducer(state, { type: "remove-unit", unitId: first.id });
    expect(next.draft.definition.units).toEqual([{ ...second, steps: [{ ...second.steps[0]!, recommendedAfter: [] }] }]);
    expect(next.dirty).toBe(true);
    expect(next.localRevision).toBe(1);
  });
});
