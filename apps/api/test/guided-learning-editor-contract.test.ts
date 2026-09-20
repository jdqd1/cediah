import { describe, expect, it } from "vitest";
import {
  LearningEditorMaterialDetailSchema,
  LearningPathOptionDraftSchema,
  LearningPathValidateRequestSchema,
  LearningPathValidationIssueSchema,
  LearningPathValidationResponseSchema,
} from "@cediah/contracts";

const sourceContentId = "10000000-0000-4000-8000-000000000001";
const resourceRevisionId = "10000000-0000-4000-8000-000000000002";
const itemId = "10000000-0000-4000-8000-000000000003";
const objectiveId = "10000000-0000-4000-8000-000000000004";
const rewardIdentity = "10000000-0000-4000-8000-000000000005";

function legacyOption() {
  return {
    config: {
      objectiveMappings: [{ itemId, objectiveIds: [objectiveId] }],
      selectedItemIds: [itemId],
    },
    estimatedMinutes: 12,
    isDefault: true,
    label: "Responder cuestionario",
    projection: "quiz" as const,
    rewardIdentity,
    rewardVersion: 1,
    sourceContentId,
  };
}

describe("guided-learning editor contracts", () => {
  it("keeps legacy option payloads valid and defaults refresh to false", () => {
    const parsed = LearningPathOptionDraftSchema.parse(legacyOption());
    expect(parsed.refreshResource).toBe(false);
    expect(parsed.expectedSourceVersion).toBeUndefined();
    expect(parsed.config.selectedItemIds).toEqual([itemId]);
  });

  it("accepts the new option instructions and rejects extra fields", () => {
    expect(LearningPathOptionDraftSchema.parse({
      ...legacyOption(),
      expectedSourceVersion: 7,
      refreshResource: true,
    })).toMatchObject({ expectedSourceVersion: 7, refreshResource: true });

    expect(LearningPathOptionDraftSchema.safeParse({
      ...legacyOption(),
      refreshResource: false,
      unexpected: true,
    }).success).toBe(false);
  });

  it("validates the strict validation request and positive expected version", () => {
    expect(LearningPathValidateRequestSchema.parse({})).toEqual({});
    expect(LearningPathValidateRequestSchema.parse({ expectedVersion: 9 })).toEqual({ expectedVersion: 9 });
    expect(LearningPathValidateRequestSchema.safeParse({ expectedVersion: 0 }).success).toBe(false);
    expect(LearningPathValidateRequestSchema.safeParse({ expectedVersion: 9, actorUserId: sourceContentId }).success).toBe(false);
  });

  it("validates issue context without accepting invalid UUIDs or extra keys", () => {
    const issue = {
      code: "insufficient_evidence",
      context: {
        actualCount: 3,
        objectiveId,
        requiredCount: 5,
        stepStableKey: "actividad-practica",
        unitStableKey: "unidad-torax",
      },
      message: "Evidence is incomplete",
      path: `objective.${objectiveId}`,
      severity: "error" as const,
    };
    expect(LearningPathValidationIssueSchema.parse(issue).context).toMatchObject({ actualCount: 3, requiredCount: 5 });
    expect(LearningPathValidationIssueSchema.safeParse({
      ...issue,
      context: { ...issue.context, objectiveId: "not-a-uuid" },
    }).success).toBe(false);
    expect(LearningPathValidationIssueSchema.safeParse({
      ...issue,
      context: { ...issue.context, hidden: true },
    }).success).toBe(false);
  });

  it("accepts legacy and versioned validation responses but rejects extra data", () => {
    expect(LearningPathValidationResponseSchema.parse({ issues: [], ready: false })).toEqual({ issues: [], ready: false });
    expect(LearningPathValidationResponseSchema.parse({
      issues: [],
      ready: true,
      validatedEditVersion: 4,
    }).validatedEditVersion).toBe(4);
    expect(LearningPathValidationResponseSchema.safeParse({
      issues: [],
      ready: true,
      validatedEditVersion: 4,
      internalPathId: sourceContentId,
    }).success).toBe(false);
  });

  it("accepts ready detail at its limits and rejects invalid item identities", () => {
    const ready = {
      currentSourceVersion: 8,
      estimatedMinutes: 600,
      explanationCoverage: "complete" as const,
      items: [{ id: itemId, kind: "question" as const, prompt: "P".repeat(10_000) }],
      projection: "quiz" as const,
      resourceRevisionId,
      sourceContentId,
      sourceVersion: 7,
      status: "ready" as const,
      title: "T".repeat(240),
    };
    expect(LearningEditorMaterialDetailSchema.parse(ready).status).toBe("ready");
    expect(LearningEditorMaterialDetailSchema.safeParse({
      ...ready,
      items: [{ id: "invalid", kind: "question", prompt: "Pregunta" }],
    }).success).toBe(false);
    expect(LearningEditorMaterialDetailSchema.safeParse({
      ...ready,
      items: [{ id: itemId, kind: "question", prompt: "P".repeat(10_001) }],
    }).success).toBe(false);
    expect(LearningEditorMaterialDetailSchema.safeParse({
      ...ready,
      estimatedMinutes: 601,
    }).success).toBe(false);
    expect(LearningEditorMaterialDetailSchema.safeParse({
      ...ready,
      items: Array.from({ length: 501 }, () => ({ id: itemId, kind: "question", prompt: "Pregunta" })),
    }).success).toBe(false);
  });

  it("validates unavailable material responses as a strict union member", () => {
    const unavailable = LearningEditorMaterialDetailSchema.parse({
      reason: "retired",
      sourceContentId,
      status: "unavailable",
      title: "Material vinculado",
    });
    expect(unavailable).toEqual({
      reason: "retired",
      sourceContentId,
      status: "unavailable",
      title: "Material vinculado",
    });
    expect(LearningEditorMaterialDetailSchema.safeParse({
      ...unavailable,
      resourceRevisionId,
    }).success).toBe(false);
    expect(LearningEditorMaterialDetailSchema.safeParse({
      ...unavailable,
      reason: "deleted",
    }).success).toBe(false);
  });
});
