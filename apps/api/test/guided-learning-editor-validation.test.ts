import { describe, expect, it } from "vitest";
import type { LearningPathDetail } from "@cediah/contracts";
import { validateLearningPathDefinition } from "../src/guided-learning/service.js";

const objectiveId = "92000000-0000-4000-8000-000000000001";
const unitId = "92000000-0000-4000-8000-000000000002";
const itemIds = [
  "92000000-0000-4000-8000-000000000011",
  "92000000-0000-4000-8000-000000000012",
  "92000000-0000-4000-8000-000000000013",
];

function detail(evidenceLevel: "limited" | "standard"): LearningPathDetail {
  const mapped = itemIds.map((itemId) => ({ itemId, objectiveIds: [objectiveId] }));
  return {
    archivedAt: null,
    coverKey: "lungs",
    createdBy: "92000000-0000-4000-8000-000000000003",
    enrollment: null,
    id: "92000000-0000-4000-8000-000000000004",
    slug: "ruta-validacion",
    summary: "Fixture local para validar cobertura.",
    title: "Ruta de validación",
    topic: { id: "92000000-0000-4000-8000-000000000005", title: "Tema" },
    version: {
      editVersion: 1,
      evidenceLevel,
      id: "92000000-0000-4000-8000-000000000006",
      number: 1,
      policyVersion: "guided-v1",
      publishedAt: null,
      releaseNotes: "",
      status: "draft",
      units: [{
        id: unitId,
        objectives: [{ id: objectiveId, importance: 3, title: "Reconocer relaciones" }],
        pedagogyVersion: 1,
        position: 0,
        stableKey: "unidad-relaciones",
        steps: [
          {
            id: "92000000-0000-4000-8000-000000000021",
            isEssential: true,
            objectiveIds: [objectiveId],
            options: [{
              completionRule: {
                externalDeclarationRequired: false,
                minimumCoveragePercent: 80,
                type: "video",
              },
              config: { objectiveMappings: [], selectedItemIds: [] },
              estimatedMinutes: 5,
              id: "92000000-0000-4000-8000-000000000031",
              isDefault: true,
              label: "Comprender",
              projection: "video",
              resourceRevisionId: "92000000-0000-4000-8000-000000000041",
              rewardIdentity: "92000000-0000-4000-8000-000000000051",
              rewardVersion: 1,
              sourceContentId: "92000000-0000-4000-8000-000000000061",
            }],
            pedagogyVersion: 1,
            position: 0,
            purpose: "understand",
            recommendedAfter: [],
            stableKey: "comprender-relaciones",
            title: "Comprender",
          },
          ...(["quiz", "flashcards"] as const).map((projection, index) => ({
            id: `92000000-0000-4000-8000-00000000002${index + 2}`,
            isEssential: true,
            objectiveIds: [objectiveId],
            options: [{
              completionRule: projection === "quiz"
                ? { completion: "submitted" as const, type: "quiz" as const }
                : { minimumRated: 3, type: "flashcards" as const },
              config: { objectiveMappings: mapped, selectedItemIds: [...itemIds] },
              estimatedMinutes: 5,
              id: `92000000-0000-4000-8000-00000000003${index + 2}`,
              isDefault: true,
              label: projection === "quiz" ? "Comprobar" : "Recordar",
              projection,
              resourceRevisionId: `92000000-0000-4000-8000-00000000004${index + 2}`,
              rewardIdentity: `92000000-0000-4000-8000-00000000005${index + 2}`,
              rewardVersion: 1,
              sourceContentId: `92000000-0000-4000-8000-00000000006${index + 2}`,
            }],
            pedagogyVersion: 1,
            position: index + 1,
            purpose: projection === "quiz" ? "check" as const : "recall" as const,
            recommendedAfter: [],
            stableKey: projection === "quiz" ? "comprobar-relaciones" : "recordar-relaciones",
            title: projection === "quiz" ? "Comprobar" : "Recordar",
          })),
        ],
        title: "Relaciones",
      }],
    },
  };
}

function resources() {
  const items = itemIds.map((id) => ({ explanation: "Explicación útil", id, kind: "question" }));
  return new Map([
    ["92000000-0000-4000-8000-000000000041", []],
    ["92000000-0000-4000-8000-000000000042", items],
    ["92000000-0000-4000-8000-000000000043", items],
  ]);
}

describe("guided-learning editor validation", () => {
  it("counts distinct canonical items across retrieval alternatives and returns stable context", () => {
    const issues = validateLearningPathDefinition(detail("standard"), resources());
    expect(issues).toEqual([expect.objectContaining({
      code: "insufficient_evidence",
      context: {
        actualCount: 3,
        objectiveId,
        requiredCount: 5,
        unitId,
        unitStableKey: "unidad-relaciones",
      },
      path: `objective.${objectiveId}`,
      severity: "error",
    })]);
  });

  it("keeps limited evidence explicit and non-blocking", () => {
    const issues = validateLearningPathDefinition(detail("limited"), resources());
    expect(issues).toEqual([expect.objectContaining({
      code: "limited_evidence",
      context: expect.objectContaining({ actualCount: 3, requiredCount: 5 }),
      severity: "warning",
    })]);
    expect(issues.some((entry) => entry.severity === "error")).toBe(false);
  });

  it("locates invalid selections at their unit, activity and option", () => {
    const fixture = detail("standard");
    fixture.version.units[0]!.steps[1]!.options[0]!.config.selectedItemIds.push(
      "92000000-0000-4000-8000-000000000099",
    );
    const issue = validateLearningPathDefinition(fixture, resources())
      .find((entry) => entry.code === "unknown_resource_item");
    expect(issue?.context).toEqual(expect.objectContaining({
      optionId: "92000000-0000-4000-8000-000000000032",
      stepId: "92000000-0000-4000-8000-000000000022",
      stepStableKey: "comprobar-relaciones",
      unitId,
      unitStableKey: "unidad-relaciones",
    }));
  });
});
