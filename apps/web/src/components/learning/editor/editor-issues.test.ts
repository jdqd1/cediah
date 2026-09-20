import type { LearningPathDetail, LearningPathValidationIssue } from "@cediah/contracts";
import { describe, expect, it } from "vitest";
import { presentIssue, presentIssues } from "./editor-issues";

const unitId = "e1000000-0000-4000-8000-000000000001";
const objectiveId = "e1000000-0000-4000-8000-000000000002";
const activityId = "e1000000-0000-4000-8000-000000000003";
const optionId = "e1000000-0000-4000-8000-000000000004";
const sourceContentId = "e1000000-0000-4000-8000-000000000005";
const resourceRevisionId = "e1000000-0000-4000-8000-000000000006";

const detail: LearningPathDetail = {
  archivedAt: null,
  coverKey: "lungs",
  createdBy: "e1000000-0000-4000-8000-000000000007",
  enrollment: null,
  id: "e1000000-0000-4000-8000-000000000008",
  slug: "ruta-pared-toracica",
  summary: "Resumen de la ruta.",
  title: "Ruta de anatomía",
  topic: { id: "e1000000-0000-4000-8000-000000000009", title: "Anatomía" },
  version: {
    editVersion: 4,
    evidenceLevel: "standard",
    id: "e1000000-0000-4000-8000-000000000010",
    number: 1,
    policyVersion: "guided-v1",
    publishedAt: null,
    releaseNotes: "",
    status: "draft",
    units: [{
      id: unitId,
      objectives: [{ id: objectiveId, importance: 2, title: "Identificar estructuras" }],
      pedagogyVersion: 1,
      position: 0,
      stableKey: "pared-toracica",
      steps: [{
        id: activityId,
        isEssential: true,
        objectiveIds: [objectiveId],
        options: [{
          completionRule: { completion: "submitted", type: "quiz" },
          config: { objectiveMappings: [], selectedItemIds: [] },
          estimatedMinutes: 8,
          id: optionId,
          isDefault: true,
          label: "Cuestionario",
          projection: "quiz",
          resourceRevisionId,
          rewardIdentity: "e1000000-0000-4000-8000-000000000011",
          rewardVersion: 1,
          sourceContentId,
        }],
        pedagogyVersion: 1,
        position: 0,
        purpose: "check",
        recommendedAfter: [],
        stableKey: "practica-pared",
        title: "Práctica de la pared",
      }],
      title: "Pared torácica",
    }],
  },
};

const codes = [
  "unit_required",
  "objective_required",
  "essential_step_required",
  "option_required",
  "default_option_required",
  "unknown_objective",
  "unknown_resource_item",
  "unknown_mapping_item",
  "unknown_mapping_objective",
  "question_explanation_required",
  "unknown_prerequisite",
  "cyclic_recommendation",
  "objective_understanding_missing",
  "objective_retrieval_missing",
  "objective_mapping_missing",
  "insufficient_evidence",
  "limited_evidence",
  "resource_unavailable",
  "topic_unavailable",
  "duplicate_objective",
  "duplicate_step_key",
  "duplicate_unit_key",
  "resource_changed",
] as const;

function issue(code: string, overrides: Partial<LearningPathValidationIssue> = {}): LearningPathValidationIssue {
  return {
    code,
    context: {
      actualCount: 3,
      objectiveId,
      optionId,
      requiredCount: 5,
      sourceContentId,
      stepId: activityId,
      stepStableKey: "practica-pared",
      unitId,
      unitStableKey: "pared-toracica",
    },
    message: "Mensaje técnico que no debe mostrarse.",
    path: "version.units.0.steps.0.options.0",
    severity: code === "limited_evidence" ? "warning" : "error",
    ...overrides,
  };
}

describe("editor issue presentation", () => {
  it.each(codes)("turns %s into a concise problem, location, solution and action", (code) => {
    const presented = presentIssue(issue(code), detail);
    expect(presented.title.length).toBeGreaterThan(0);
    expect(presented.title.length).toBeLessThanOrEqual(90);
    expect(presented.location).toContain("Pared torácica");
    expect(presented.resolution.length).toBeGreaterThan(0);
    expect(presented.actionLabel.length).toBeGreaterThan(0);
    const visible = [presented.title, presented.location, presented.resolution, presented.actionLabel].join(" ");
    expect(visible).not.toContain("version.units");
    expect(visible).not.toContain(unitId);
    expect(visible).not.toContain(activityId);
    expect(visible).not.toContain(optionId);
  });

  it("states the exact shortfall for standard evidence", () => {
    const presented = presentIssue(issue("insufficient_evidence"), detail);
    expect(presented.title).toBe("Faltan 2 preguntas o tarjetas para este objetivo");
    expect(presented.resolution).toContain("Hay 3 de las 5 necesarias");
    expect(presented.severity).toBe("error");
  });

  it("opens the existing empty activity instead of creating an unrelated one", () => {
    expect(presentIssue(issue("option_required"), detail).target).toEqual({
      activityId,
      kind: "alternative",
      unitId,
    });
  });

  it("uses confirmed context before a misleading legacy path", () => {
    const presented = presentIssue(issue("resource_unavailable", { path: "version.units.19.steps.4.options.2" }), detail);
    expect(presented.location).toBe("Pared torácica · Práctica de la pared · Cuestionario");
    expect(presented.target).toMatchObject({ activityId, kind: "replace", optionId, unitId });
  });

  it("uses only strict legacy paths and never prints an untrusted path", () => {
    const byResource = presentIssue(issue("resource_unavailable", {
      context: undefined,
      path: `resource.${resourceRevisionId}`,
    }), detail);
    expect(byResource.location).toContain("Práctica de la pared");

    const untrusted = presentIssue(issue("mystery_check", {
      context: undefined,
      path: "<img src=x onerror=alert(1)>",
    }), detail);
    expect(untrusted.location).toBe("Ruta completa");
    expect([untrusted.title, untrusted.location, untrusted.resolution].join(" ")).not.toContain("<img");
  });

  it("deduplicates identical findings but retains the same code at another location", () => {
    const second = structuredClone(detail);
    second.version.units.push({
      ...structuredClone(detail.version.units[0]!),
      id: "e2000000-0000-4000-8000-000000000001",
      stableKey: "mediastino",
      title: "Mediastino",
    });
    const repeated = issue("objective_required", { context: { unitId, unitStableKey: "pared-toracica" }, path: "version.units.0.objectives" });
    const other = issue("objective_required", {
      context: { unitId: second.version.units[1]!.id, unitStableKey: "mediastino" },
      path: "version.units.1.objectives",
    });
    expect(presentIssues([repeated, repeated, other], second).map((entry) => entry.location)).toEqual([
      "Pared torácica",
      "Mediastino",
    ]);
  });
});
