import { describe, expect, it } from "vitest";
import type { LearningEditorMaterialDetail, LearningPathDetail } from "@cediah/contracts";
import {
  createActivityFromMaterial,
  createEmptyDraft,
  createNewEditorState,
  createUnit,
  editorDraftFromDetail,
  makeSlug,
} from "./editor-model";

const ids = {
  activity: "30000000-0000-4000-8000-000000000004",
  item: "30000000-0000-4000-8000-000000000008",
  objective: "30000000-0000-4000-8000-000000000003",
  option: "30000000-0000-4000-8000-000000000005",
  path: "30000000-0000-4000-8000-000000000001",
  resource: "30000000-0000-4000-8000-000000000007",
  revision: "30000000-0000-4000-8000-000000000009",
  reward: "30000000-0000-4000-8000-000000000006",
  topic: "30000000-0000-4000-8000-000000000002",
  unit: "30000000-0000-4000-8000-000000000010",
  version: "30000000-0000-4000-8000-000000000011",
};

function idFactory(values: string[]) {
  let index = 0;
  return () => values[index++]!;
}

function legacyDetail(): LearningPathDetail {
  const secondObjective = "30000000-0000-4000-8000-000000000012";
  return {
    archivedAt: null,
    coverKey: "heart",
    createdBy: ids.path,
    enrollment: null,
    id: ids.path,
    slug: "ruta-heredada",
    summary: "Descripción",
    title: "Ruta heredada",
    topic: { id: ids.topic, title: "Tórax" },
    version: {
      editVersion: 4,
      evidenceLevel: "limited",
      id: ids.version,
      number: 2,
      policyVersion: "guided-v1",
      publishedAt: null,
      releaseNotes: "Conservar",
      status: "draft",
      units: [{
        id: ids.unit,
        objectives: [
          { id: ids.objective, importance: 2, title: "Objetivo uno" },
          { id: secondObjective, importance: 1, title: "Objetivo dos" },
        ],
        pedagogyVersion: 8,
        position: 0,
        stableKey: "unidad-heredada",
        steps: [{
          id: ids.activity,
          isEssential: false,
          objectiveIds: [ids.objective, secondObjective],
          options: [{
            completionRule: { minimumRated: 1, type: "flashcards" },
            config: {
              guideSectionIndexes: [1, 3],
              objectiveMappings: [{ itemId: ids.item, objectiveIds: [secondObjective] }],
              selectedItemIds: [ids.item],
              videoRange: { endSeconds: 80, startSeconds: 20 },
            },
            estimatedMinutes: null,
            id: ids.option,
            isDefault: true,
            label: "Etiqueta propia",
            projection: "flashcards",
            resourceRevisionId: ids.revision,
            rewardIdentity: ids.reward,
            rewardVersion: 6,
            sourceContentId: ids.resource,
          }],
          pedagogyVersion: 7,
          position: 0,
          purpose: "diagnostic",
          recommendedAfter: ["actividad-previa"],
          stableKey: "actividad-heredada",
          title: "Actividad personalizada",
        }],
        title: "Unidad heredada",
      }],
    },
  };
}

describe("route editor model", () => {
  it("hydrates every inherited objective and customized configuration without recalculating it", () => {
    const draft = editorDraftFromDetail(legacyDetail());
    const activity = draft.definition.units[0]!.steps[0]!;
    expect(draft.definition.evidenceLevel).toBe("limited");
    expect(draft.definition.units[0]!.objectives).toHaveLength(2);
    expect(activity.purpose).toBe("diagnostic");
    expect(activity.options[0]).toMatchObject({
      completionRule: { minimumRated: 1, type: "flashcards" },
      config: {
        guideSectionIndexes: [1, 3],
        selectedItemIds: [ids.item],
        videoRange: { endSeconds: 80, startSeconds: 20 },
      },
      label: "Etiqueta propia",
      rewardVersion: 6,
    });
  });

  it("selects a topic only when exactly one exists", () => {
    expect(createEmptyDraft([]).topicContentId).toBe("");
    expect(createEmptyDraft([{ id: ids.topic, title: "Tórax" }]).topicContentId).toBe(ids.topic);
    expect(createEmptyDraft([
      { id: ids.topic, title: "Tórax" },
      { id: ids.resource, title: "Abdomen" },
    ]).topicContentId).toBe("");
  });

  it("creates permanent UUID-derived keys rather than positional keys", () => {
    const unit = createUnit(idFactory([ids.unit, ids.objective]));
    expect(unit).toMatchObject({
      id: ids.unit,
      objectives: [{ id: ids.objective, importance: 3, title: "" }],
      stableKey: `unidad-${ids.unit}`,
      title: "",
    });
  });

  it("creates a selected material as one required activity with format defaults", () => {
    const detail: Extract<LearningEditorMaterialDetail, { status: "ready" }> = {
      currentSourceVersion: 4,
      estimatedMinutes: 14,
      explanationCoverage: "complete",
      items: [{ id: ids.item, kind: "question", prompt: "Pregunta" }],
      projection: "quiz",
      resourceRevisionId: null,
      sourceContentId: ids.resource,
      sourceVersion: 4,
      status: "ready",
      title: "Cuestionario de tórax",
    };
    const activity = createActivityFromMaterial({
      createId: idFactory([ids.activity, ids.option, ids.reward]),
      detail,
      objectiveIds: [ids.objective],
    });
    expect(activity).toMatchObject({
      id: ids.activity,
      isEssential: true,
      purpose: "check",
      stableKey: `actividad-${ids.activity}`,
      title: detail.title,
    });
    expect(activity.options[0]).toMatchObject({
      estimatedMinutes: 14,
      expectedSourceVersion: 4,
      id: ids.option,
      isDefault: true,
      label: "Responder cuestionario",
      rewardIdentity: ids.reward,
    });
    expect(activity.options[0]!.config.objectiveMappings).toEqual([
      { itemId: ids.item, objectiveIds: [ids.objective] },
    ]);
  });

  it("keeps one creation id and produces a bounded, deterministic slug", () => {
    const state = createNewEditorState({ createId: () => ids.path, topics: [] });
    const slug = makeSlug(`${"Árbol médico 🫀 ".repeat(40)}`, state.creationId);
    expect(state.creationId).toBe(ids.path);
    expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(slug.length).toBeLessThanOrEqual(192);
    expect(makeSlug("🫀🫀", state.creationId)).toBe(`ruta-${ids.path}`);
  });
});
