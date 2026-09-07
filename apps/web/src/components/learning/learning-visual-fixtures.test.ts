import { describe, expect, it } from "vitest";
import {
  LearningAttemptSchema,
  LearningEnrollmentProgressSchema,
  LearningEnrollmentUpgradePreviewResponseSchema,
  LearningHomeSchema,
  LearningPathCardSchema,
  LearningPathDetailSchema,
  LearningRewardSchema,
} from "@cediah/contracts";
import {
  learningVisualAttempt,
  learningVisualAwards,
  learningVisualBlockedUpgrade,
  learningVisualCompleteHome,
  learningVisualHome,
  learningVisualLongTitleHome,
  learningVisualNewHome,
  learningVisualPathDetail,
  learningVisualPaths,
  learningVisualProgress,
  learningVisualUpgrade,
} from "./learning-visual-fixtures";

describe("guided learning visual fixtures", () => {
  it("keeps every visual state within the public contracts", () => {
    for (const home of [
      learningVisualHome,
      learningVisualNewHome,
      learningVisualCompleteHome,
      learningVisualLongTitleHome,
    ]) {
      expect(LearningHomeSchema.safeParse(home).success).toBe(true);
    }
    for (const path of learningVisualPaths) {
      expect(LearningPathCardSchema.safeParse(path).success).toBe(true);
    }
    expect(LearningPathDetailSchema.safeParse(learningVisualPathDetail).success).toBe(true);
    expect(LearningEnrollmentProgressSchema.safeParse(learningVisualProgress).success).toBe(true);
    expect(LearningEnrollmentUpgradePreviewResponseSchema.safeParse(learningVisualUpgrade).success).toBe(true);
    expect(LearningEnrollmentUpgradePreviewResponseSchema.safeParse(learningVisualBlockedUpgrade).success).toBe(true);
    expect(LearningAttemptSchema.safeParse(learningVisualAttempt).success).toBe(true);
    for (const award of learningVisualAwards) {
      expect(LearningRewardSchema.safeParse(award).success).toBe(true);
    }
  });

  it("covers empty, dense, complete and long-title states without fake production data", () => {
    expect(learningVisualNewHome.activePath).toBeNull();
    expect(learningVisualHome.counts.dueReviews).toBeGreaterThan(learningVisualHome.tasks[0]!.itemCount);
    expect(learningVisualCompleteHome.activePath?.progressPercent).toBe(100);
    expect(learningVisualLongTitleHome.activePath!.title.length).toBeGreaterThan(90);
    expect(learningVisualPathDetail.version.status).toBe("published");
    expect(learningVisualUpgrade.upgrade?.activeAttempt).toBeNull();
    expect(learningVisualBlockedUpgrade.upgrade?.activeAttempt).not.toBeNull();
  });
});
