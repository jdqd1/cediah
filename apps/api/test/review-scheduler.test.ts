import { describe, expect, it } from "vitest";
import { compareLearningTasks, reviewTaskKey, scheduleReview } from "../src/guided-learning/review-scheduler.js";
import {
  selectReviewCandidates,
  type ReviewCandidate,
} from "../src/guided-learning/review-candidates.js";

const acceptedAt = new Date("2026-09-06T12:00:00.000Z");

describe("guided-learning scheduler-v1", () => {
  it.each([
    ["again", 0, 1, "2026-09-06T12:10:00.000Z"],
    ["hard", 0, 0, "2026-09-07T12:00:00.000Z"],
    ["good", 1, 0, "2026-09-07T12:00:00.000Z"],
    ["easy", 2, 0, "2026-09-09T12:00:00.000Z"],
  ] as const)("schedules %s deterministically", (grade, stage, lapses, nextDueAt) => {
    const result = scheduleReview({ lapses: 0, stage: 0 }, grade, acceptedAt);
    expect(result).toMatchObject({ lapses, stage });
    expect(result.nextDueAt.toISOString()).toBe(nextDueAt);
  });

  it("moves a third failed appearance to one day without exceeding stage bounds", () => {
    const failed = scheduleReview({ lapses: 4, stage: 4 }, "again", acceptedAt, 2);
    expect(failed).toMatchObject({ lapses: 5, stage: 0 });
    expect(failed.nextDueAt.toISOString()).toBe("2026-09-07T12:00:00.000Z");
    expect(scheduleReview({ lapses: 0, stage: 4 }, "easy", acceptedAt).stage).toBe(4);
  });

  it("sorts lexicographically by visible bands and documented tie breakers", () => {
    const base = {
      dueAtMs: acceptedAt.getTime(),
      editorialPosition: 2,
      estimatedMinutes: 10,
      examDays: null,
      importance: 2 as const,
      pinnedPath: false,
    };
    const tasks = [
      { ...base, band: 3 as const, key: "step" },
      { ...base, band: 1 as const, importance: 1 as const, key: "review-normal" },
      { ...base, band: 1 as const, importance: 3 as const, key: "review-important" },
      { ...base, band: 0 as const, key: "review-priority" },
    ].sort((left, right) => compareLearningTasks(left, right, 10));
    expect(tasks.map((task) => task.key)).toEqual([
      "review-priority",
      "review-important",
      "review-normal",
      "step",
    ]);
  });

  it("keeps task identity tied to the memory cycle", () => {
    expect(reviewTaskKey("item", 2, 8)).toBe("review:item:2:8");
    expect(reviewTaskKey("item", 2, 9)).not.toBe(reviewTaskKey("item", 2, 8));
  });

  it("caps an eighty-item backlog at ten while preserving priority and unit variety", () => {
    const candidates: ReviewCandidate[] = Array.from({ length: 80 }, (_, index) => {
      const itemId = `70000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
      return {
        dueAt: new Date(acceptedAt.getTime() + index),
        enrollmentId: "71000000-0000-4000-8000-000000000001",
        evidenceEnrollmentIds: ["71000000-0000-4000-8000-000000000001"],
        importance: index < 12 ? 3 : 1,
        item: {
          correctOptionIndex: 0,
          explanation: "Fixture",
          id: itemId,
          memoryVersion: 1,
          optionIds: [
            `72000000-0000-4000-8000-${String(index * 2 + 1).padStart(12, "0")}`,
            `72000000-0000-4000-8000-${String(index * 2 + 2).padStart(12, "0")}`,
          ],
          options: ["Correcta", "Distractor"],
          prompt: `Pregunta ${index + 1}`,
        },
        itemId,
        kind: "quiz" as const,
        lapses: 0,
        memoryVersion: 1,
        objectiveIds: [],
        pathSlug: "ruta-prueba",
        pathTitle: "Ruta de prueba",
        payloadHash: "a".repeat(64),
        resourceRevisionId: "73000000-0000-4000-8000-000000000001",
        reviewStateVersion: 1,
        sourceContentId: "74000000-0000-4000-8000-000000000001",
        stage: 0,
        taskKey: reviewTaskKey(itemId, 1, 1),
        unitId: `75000000-0000-4000-8000-${String(index % 4 + 1).padStart(12, "0")}`,
      };
    });
    const selected = selectReviewCandidates(candidates, 10);
    expect(selected).toHaveLength(10);
    expect(selected.every((candidate) => candidate.importance === 3)).toBe(true);
    expect(new Set(selected.map((candidate) => candidate.unitId)).size).toBe(4);
    expect(new Set(selected.map((candidate) => candidate.itemId)).size).toBe(10);
  });
});
