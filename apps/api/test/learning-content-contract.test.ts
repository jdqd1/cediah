import { describe, expect, it } from "vitest";
import {
  GuideQuizQuestionSchema,
  normalizeContentLearningIdentity,
  reconcileContentLearningIdentity,
} from "@cediah/contracts";

describe("learning content identity contracts", () => {
  it("accepts legacy questions but rejects partial or duplicate option identity", () => {
    const legacy = {
      correctOptionIndex: 1,
      explanation: "",
      options: ["A", "B"],
      prompt: "Pregunta",
    };
    expect(GuideQuizQuestionSchema.safeParse(legacy).success).toBe(true);
    expect(GuideQuizQuestionSchema.safeParse({
      ...legacy,
      optionIds: ["10000000-0000-4000-8000-000000000001"],
    }).success).toBe(false);
    expect(GuideQuizQuestionSchema.safeParse({
      ...legacy,
      optionIds: [
        "10000000-0000-4000-8000-000000000001",
        "10000000-0000-4000-8000-000000000001",
      ],
    }).success).toBe(false);
  });

  it("adds identities once and leaves authored values byte-for-byte equivalent", () => {
    let next = 1;
    const createId = () => `10000000-0000-4000-8000-${String(next++).padStart(12, "0")}`;
    const draft = {
      kind: "guide" as const,
      content: {
        quiz: {
          questions: [{
            correctOptionIndex: 1,
            explanation: "Contexto",
            options: ["A", "B"],
            prompt: "Pregunta",
          }],
        },
      },
    };

    const first = normalizeContentLearningIdentity(draft, createId);
    const second = normalizeContentLearningIdentity(first.value, createId);
    const question = first.value.content.quiz.questions[0];

    expect(first.changed).toBe(true);
    expect(second).toEqual({ changed: false, value: first.value });
    expect(question).toMatchObject({
      correctOptionIndex: 1,
      explanation: "Contexto",
      memoryVersion: 1,
      options: ["A", "B"],
      prompt: "Pregunta",
    });
    expect((question as typeof question & { optionIds?: string[] })?.optionIds).toHaveLength(2);
  });

  it("preserves memory through reordering and advances it for a substantive answer change", () => {
    const itemId = "10000000-0000-4000-8000-000000000001";
    const optionA = "10000000-0000-4000-8000-000000000002";
    const optionB = "10000000-0000-4000-8000-000000000003";
    const current = {
      kind: "quiz" as const,
      content: { questions: [{
        correctOptionIndex: 1,
        explanation: "Explicación",
        id: itemId,
        memoryVersion: 4,
        optionIds: [optionA, optionB],
        options: ["A", "B"],
        prompt: "Pregunta",
      }] },
    };
    const reordered = reconcileContentLearningIdentity(current, {
      kind: "quiz" as const,
      content: { questions: [{
        ...current.content.questions[0],
        correctOptionIndex: 0,
        optionIds: [optionB, optionA],
        options: ["B", "A"],
      }] },
    });
    expect(reordered.status).toBe("success");
    if (reordered.status !== "success") return;
    expect(reordered.value.content.questions[0]?.memoryVersion).toBe(4);

    const changedAnswer = reconcileContentLearningIdentity(current, {
      kind: "quiz" as const,
      content: { questions: [{
        ...current.content.questions[0],
        correctOptionIndex: 0,
      }] },
    });
    expect(changedAnswer.status).toBe("success");
    if (changedAnswer.status !== "success") return;
    expect(changedAnswer.value.content.questions[0]?.memoryVersion).toBe(5);
  });

  it("rejects an editorial update that drops stored identities", () => {
    const current = {
      kind: "flashcards" as const,
      content: { cards: [{
        back: "Respuesta",
        front: "Pregunta",
        id: "10000000-0000-4000-8000-000000000001",
        memoryVersion: 1,
      }] },
    };
    expect(reconcileContentLearningIdentity(current, {
      kind: "flashcards" as const,
      content: { cards: [{ back: "Respuesta", front: "Pregunta" }] },
    })).toEqual({ status: "unsafe_identity" });
  });
});
