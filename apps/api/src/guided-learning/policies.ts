import type {
  LearningCompletionRule,
  LearningProjection,
} from "@cediah/contracts";

export const guidedLearningPolicyV1 = {
  evidence: {
    consolidatedDistinctItems: 5,
    developingDistinctItems: 3,
    minimumScorePercent: 80,
    recentDays: 30,
    separatedHours: 24,
  },
  policyVersion: "guided-v1",
  progress: { skippedEssentialCountsAsComplete: false },
  review: { stagesInDays: [1, 3, 7, 14, 30] },
} as const;

export function defaultCompletionRule(
  projection: LearningProjection,
  itemCount: number,
): LearningCompletionRule {
  if (projection === "video") {
    return {
      externalDeclarationRequired: true,
      minimumCoveragePercent: 90,
      type: "video",
    };
  }
  if (projection === "guide") {
    return { confirmationRequired: true, type: "guide" };
  }
  if (projection === "quiz") {
    return { completion: "submitted", type: "quiz" };
  }
  return { minimumRated: Math.max(1, itemCount), type: "flashcards" };
}
