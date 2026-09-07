import type { LearningEvidenceState } from "@cediah/contracts";

const dayMilliseconds = 86_400_000;

export type ObjectiveAssessment = {
  assessedAt: Date;
  itemIds: string[];
  percent: number;
};

export type ObjectiveEvidence = {
  distinctQuestions: number;
  evidenceLimited: boolean;
  historicalState: LearningEvidenceState;
  lastAssessedAt: Date | null;
  lastCheckPercent: number | null;
  reviewRecommended: boolean;
  state: LearningEvidenceState;
};

export function evaluateObjectiveEvidence(
  assessments: ObjectiveAssessment[],
  bankSize: number,
  now: Date,
): ObjectiveEvidence {
  const ordered = [...assessments].sort((left, right) => left.assessedAt.getTime() - right.assessedAt.getTime());
  const distinctQuestions = new Set(ordered.flatMap((assessment) => assessment.itemIds)).size;
  const latest = ordered.at(-1);
  const evidenceLimited = bankSize < 5;
  if (!latest) {
    return {
      distinctQuestions,
      evidenceLimited,
      historicalState: "unassessed",
      lastAssessedAt: null,
      lastCheckPercent: null,
      reviewRecommended: false,
      state: "unassessed",
    };
  }

  const qualifying = ordered.filter((assessment) =>
    assessment.itemIds.length >= 3 && assessment.percent >= 80,
  );
  let historicalState: LearningEvidenceState = "practicing";
  const latestQualifies = latest.itemIds.length >= 3 && latest.percent >= 80;
  if (latestQualifies) historicalState = "developing";
  if (latestQualifies && !evidenceLimited) {
    const earlier = qualifying.filter((assessment) =>
      latest.assessedAt.getTime() - assessment.assessedAt.getTime() >= dayMilliseconds,
    );
    if (earlier.some((assessment) =>
      new Set([...assessment.itemIds, ...latest.itemIds]).size >= 5,
    )) historicalState = "consolidated";
  }

  const reviewRecommended = now.getTime() - latest.assessedAt.getTime() > 30 * dayMilliseconds;
  const state = reviewRecommended && historicalState === "consolidated"
    ? "developing"
    : historicalState;
  return {
    distinctQuestions,
    evidenceLimited,
    historicalState,
    lastAssessedAt: latest.assessedAt,
    lastCheckPercent: latest.percent,
    reviewRecommended,
    state,
  };
}
