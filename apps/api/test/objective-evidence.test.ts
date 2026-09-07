import { describe, expect, it } from "vitest";
import { evaluateObjectiveEvidence } from "../src/guided-learning/objective-evidence.js";

const now = new Date("2026-09-06T12:00:00.000Z");

describe("guided-learning evidence-v1", () => {
  it("separates no evidence, practice and developing evidence", () => {
    expect(evaluateObjectiveEvidence([], 8, now).state).toBe("unassessed");
    expect(evaluateObjectiveEvidence([{
      assessedAt: now,
      itemIds: ["a", "b", "c"],
      percent: 79,
    }], 8, now).state).toBe("practicing");
    expect(evaluateObjectiveEvidence([{
      assessedAt: now,
      itemIds: ["a", "b", "c"],
      percent: 80,
    }], 8, now).state).toBe("developing");
  });

  it("requires two checks, 24 hours, five distinct questions and a sufficient bank", () => {
    const first = { assessedAt: new Date("2026-09-05T11:59:59.000Z"), itemIds: ["a", "b", "c"], percent: 80 };
    const second = { assessedAt: now, itemIds: ["c", "d", "e"], percent: 90 };
    expect(evaluateObjectiveEvidence([first, second], 5, now).state).toBe("consolidated");
    expect(evaluateObjectiveEvidence([{ ...first, assessedAt: new Date("2026-09-05T12:00:01.000Z") }, second], 5, now).state)
      .toBe("developing");
    expect(evaluateObjectiveEvidence([first, second], 4, now)).toMatchObject({
      evidenceLimited: true,
      state: "developing",
    });
  });

  it("does not present stale consolidation as current knowledge", () => {
    const evidence = evaluateObjectiveEvidence([
      { assessedAt: new Date("2026-07-01T12:00:00.000Z"), itemIds: ["a", "b", "c"], percent: 100 },
      { assessedAt: new Date("2026-07-03T12:00:00.000Z"), itemIds: ["c", "d", "e"], percent: 100 },
    ], 5, now);
    expect(evidence).toMatchObject({
      historicalState: "consolidated",
      reviewRecommended: true,
      state: "developing",
    });
  });
});
