import type { LearningRecallGrade } from "@cediah/contracts";

export const reviewSchedulerPolicyVersion = "scheduler-v1" as const;
export const recommendationPolicyVersion = "recommendations-v1" as const;
const dayMilliseconds = 86_400_000;
const intervalDays = [1, 3, 7, 14, 30] as const;

export type ReviewMemoryState = {
  lapses: number;
  stage: number;
};

export type ScheduledReview = ReviewMemoryState & {
  nextDueAt: Date;
};

export function scheduleReview(
  previous: ReviewMemoryState,
  grade: LearningRecallGrade,
  acceptedAt: Date,
  retryCountInSession = 0,
): ScheduledReview {
  const stage = Math.max(0, Math.min(4, Math.trunc(previous.stage)));
  let nextStage = stage;
  let lapses = Math.max(0, Math.trunc(previous.lapses));
  let delayMilliseconds: number;
  if (grade === "again") {
    nextStage = 0;
    lapses += 1;
    delayMilliseconds = retryCountInSession < 2 ? 10 * 60_000 : dayMilliseconds;
  } else if (grade === "hard") {
    delayMilliseconds = dayMilliseconds;
  } else if (grade === "good") {
    delayMilliseconds = intervalDays[stage]! * dayMilliseconds;
    nextStage = Math.min(4, stage + 1);
  } else {
    delayMilliseconds = intervalDays[Math.min(4, stage + 1)]! * dayMilliseconds;
    nextStage = Math.min(4, stage + 2);
  }
  return {
    lapses,
    nextDueAt: new Date(acceptedAt.getTime() + delayMilliseconds),
    stage: nextStage,
  };
}

export type LearningTaskCandidate = {
  band: 0 | 1 | 2 | 3 | 4;
  dueAtMs: number | null;
  editorialPosition: number;
  estimatedMinutes: number | null;
  examDays: number | null;
  importance: 1 | 2 | 3;
  key: string;
  pinnedPath: boolean;
};

export function compareLearningTasks(
  left: LearningTaskCandidate,
  right: LearningTaskCandidate,
  sessionMinutes: number,
) {
  const due = (task: LearningTaskCandidate) => task.dueAtMs ?? Number.MAX_SAFE_INTEGER;
  const exam = (task: LearningTaskCandidate) => task.examDays ?? Number.MAX_SAFE_INTEGER;
  const fits = (task: LearningTaskCandidate) =>
    task.estimatedMinutes !== null && task.estimatedMinutes <= sessionMinutes;
  return left.band - right.band
    || right.importance - left.importance
    || due(left) - due(right)
    || exam(left) - exam(right)
    || Number(right.pinnedPath) - Number(left.pinnedPath)
    || Number(fits(right)) - Number(fits(left))
    || left.editorialPosition - right.editorialPosition
    || left.key.localeCompare(right.key);
}

export function reviewTaskKey(itemId: string, memoryVersion: number, reviewStateVersion: number) {
  return `review:${itemId}:${memoryVersion}:${reviewStateVersion}`;
}

export function stepTaskKey(enrollmentId: string, stableKey: string, pedagogyVersion: number) {
  return `step:${enrollmentId}:${stableKey}:${pedagogyVersion}`;
}
