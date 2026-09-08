import { z } from "zod";
import {
  LearningProjectionSchema,
  PublicLearningQuestionSchema,
  type LearningProjection,
} from "./learning-content.js";

const SlugSchema = z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const StableKeySchema = z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/);
const InternalHrefSchema = z.string().regex(/^\/(?!\/)[^\s]*$/);

export const LearningPathStatusSchema = z.enum([
  "draft",
  "in_review",
  "changes_requested",
  "approved",
  "published",
  "archived",
]);
export const LearningStepPurposeSchema = z.enum([
  "understand",
  "recall",
  "check",
  "integrate",
  "diagnostic",
]);
export const LearningEnrollmentStatusSchema = z.enum(["active", "paused", "archived"]);
export const LearningCoverKeySchema = z.enum([
  "back-muscles",
  "heart",
  "intestines",
  "lungs",
  "neck-muscles",
  "pelvis",
  "skull",
  "thigh",
]);

export const LearningObjectiveSchema = z.strictObject({
  id: z.string().uuid(),
  importance: z.number().int().min(1).max(3),
  title: z.string().trim().min(1).max(240),
});

export const LearningObjectiveMappingSchema = z.strictObject({
  itemId: z.string().uuid(),
  objectiveIds: z.array(z.string().uuid()).min(1).max(20),
});

export const LearningOptionConfigSchema = z.strictObject({
  guideSectionIndexes: z.array(z.number().int().nonnegative()).max(100).optional(),
  objectiveMappings: z.array(LearningObjectiveMappingSchema).max(500).default([]),
  selectedItemIds: z.array(z.string().uuid()).max(500).default([]),
  videoRange: z.strictObject({
    endSeconds: z.number().int().positive(),
    startSeconds: z.number().int().nonnegative(),
  }).refine((range) => range.endSeconds > range.startSeconds, {
    message: "endSeconds must be greater than startSeconds",
  }).optional(),
});

export const LearningCompletionRuleSchema = z.discriminatedUnion("type", [
  z.strictObject({
    externalDeclarationRequired: z.boolean().default(true),
    minimumCoveragePercent: z.number().int().min(1).max(100).default(90),
    type: z.literal("video"),
  }),
  z.strictObject({ confirmationRequired: z.literal(true).default(true), type: z.literal("guide") }),
  z.strictObject({ completion: z.literal("submitted").default("submitted"), type: z.literal("quiz") }),
  z.strictObject({ minimumRated: z.number().int().min(1).max(500), type: z.literal("flashcards") }),
]);

export const LearningPathOptionDraftSchema = z.strictObject({
  completionRule: LearningCompletionRuleSchema.optional(),
  config: LearningOptionConfigSchema.default({ objectiveMappings: [], selectedItemIds: [] }),
  estimatedMinutes: z.number().int().min(1).max(600).nullable().default(null),
  id: z.string().uuid().optional(),
  isDefault: z.boolean().default(false),
  label: z.string().trim().min(1).max(120),
  projection: LearningProjectionSchema,
  rewardIdentity: z.string().uuid(),
  rewardVersion: z.number().int().min(1).max(1_000_000).default(1),
  sourceContentId: z.string().uuid(),
});

export const LearningPathStepDraftSchema = z.strictObject({
  id: z.string().uuid().optional(),
  isEssential: z.boolean().default(true),
  objectiveIds: z.array(z.string().uuid()).min(1).max(20),
  options: z.array(LearningPathOptionDraftSchema).max(12).default([]),
  pedagogyVersion: z.number().int().min(1).max(1_000_000).default(1),
  purpose: LearningStepPurposeSchema,
  recommendedAfter: z.array(StableKeySchema).max(20).default([]),
  stableKey: StableKeySchema,
  title: z.string().trim().min(1).max(240),
});

export const LearningPathUnitDraftSchema = z.strictObject({
  id: z.string().uuid().optional(),
  objectives: z.array(LearningObjectiveSchema).max(30).default([]),
  pedagogyVersion: z.number().int().min(1).max(1_000_000).default(1),
  stableKey: StableKeySchema,
  steps: z.array(LearningPathStepDraftSchema).max(60).default([]),
  title: z.string().trim().min(1).max(240),
});

export const LearningPathDefinitionSchema = z.strictObject({
  evidenceLevel: z.enum(["standard", "limited"]).default("standard"),
  policyVersion: z.string().trim().min(1).max(80).default("guided-v1"),
  releaseNotes: z.string().trim().max(4_000).default(""),
  units: z.array(LearningPathUnitDraftSchema).max(30).default([]),
});

const LearningPathMetadataShape = {
  coverKey: LearningCoverKeySchema,
  slug: SlugSchema,
  summary: z.string().trim().min(1).max(2_000),
  title: z.string().trim().min(1).max(200),
  topicContentId: z.string().uuid(),
};

export const LearningPathCreateRequestSchema = z.strictObject({
  ...LearningPathMetadataShape,
  definition: LearningPathDefinitionSchema,
});

export const LearningPathUpdateRequestSchema = z.strictObject({
  ...LearningPathMetadataShape,
  definition: LearningPathDefinitionSchema,
  expectedVersion: z.number().int().min(1),
});

export const LearningPathTransitionRequestSchema = z.strictObject({
  expectedVersion: z.number().int().min(1),
  status: z.enum(["in_review", "changes_requested", "approved", "published", "archived"]),
});

export const LearningPathCreateVersionRequestSchema = z.strictObject({
  releaseNotes: z.string().trim().max(4_000).default(""),
});

export const LearningPathValidationIssueSchema = z.strictObject({
  code: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(500),
  path: z.string().trim().min(1).max(500),
  severity: z.enum(["error", "warning"]),
});
export const LearningPathValidationResponseSchema = z.strictObject({
  issues: z.array(LearningPathValidationIssueSchema),
  ready: z.boolean(),
});

export const LearningPathOptionSchema = z.strictObject({
  completionRule: LearningCompletionRuleSchema,
  config: LearningOptionConfigSchema,
  estimatedMinutes: z.number().int().min(1).max(600).nullable(),
  id: z.string().uuid(),
  isDefault: z.boolean(),
  label: z.string(),
  projection: LearningProjectionSchema,
  resourceRevisionId: z.string().uuid(),
  rewardIdentity: z.string().uuid(),
  rewardVersion: z.number().int().positive(),
  sourceContentId: z.string().uuid(),
});

export const LearningPathStepSchema = z.strictObject({
  id: z.string().uuid(),
  isEssential: z.boolean(),
  objectiveIds: z.array(z.string().uuid()),
  options: z.array(LearningPathOptionSchema),
  pedagogyVersion: z.number().int().positive(),
  position: z.number().int().nonnegative(),
  purpose: LearningStepPurposeSchema,
  recommendedAfter: z.array(StableKeySchema),
  stableKey: StableKeySchema,
  title: z.string(),
});

export const LearningPathUnitSchema = z.strictObject({
  id: z.string().uuid(),
  objectives: z.array(LearningObjectiveSchema),
  pedagogyVersion: z.number().int().positive(),
  position: z.number().int().nonnegative(),
  stableKey: StableKeySchema,
  steps: z.array(LearningPathStepSchema),
  title: z.string(),
});

export const LearningEnrollmentSummarySchema = z.strictObject({
  completedAt: z.string().datetime({ offset: true }).nullable(),
  id: z.string().uuid(),
  pathVersionId: z.string().uuid(),
  rowVersion: z.number().int().positive(),
  status: LearningEnrollmentStatusSchema,
});

export const LearningPathDetailSchema = z.strictObject({
  archivedAt: z.string().datetime({ offset: true }).nullable(),
  coverKey: LearningCoverKeySchema,
  createdBy: z.string().uuid(),
  enrollment: LearningEnrollmentSummarySchema.nullable(),
  id: z.string().uuid(),
  slug: SlugSchema,
  summary: z.string(),
  title: z.string(),
  topic: z.strictObject({ id: z.string().uuid(), title: z.string() }),
  version: z.strictObject({
    editVersion: z.number().int().positive(),
    evidenceLevel: z.enum(["standard", "limited"]),
    id: z.string().uuid(),
    number: z.number().int().positive(),
    policyVersion: z.string(),
    publishedAt: z.string().datetime({ offset: true }).nullable(),
    releaseNotes: z.string(),
    status: LearningPathStatusSchema,
    units: z.array(LearningPathUnitSchema),
  }),
});

export const LearningPathCardSchema = z.strictObject({
  coverKey: LearningCoverKeySchema,
  enrollment: LearningEnrollmentSummarySchema.nullable(),
  estimatedMinutes: z.number().int().nonnegative(),
  id: z.string().uuid(),
  slug: SlugSchema,
  summary: z.string(),
  title: z.string(),
  topic: z.strictObject({ id: z.string().uuid(), title: z.string() }),
  unitCount: z.number().int().positive(),
});

export const LearningPathCatalogQuerySchema = z.strictObject({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  topicId: z.string().uuid().optional(),
});

export const LearningPathCatalogResponseSchema = z.strictObject({
  items: z.array(LearningPathCardSchema),
  nextCursor: z.string().uuid().nullable(),
});

export const LearningLibraryOptionsQuerySchema = z.strictObject({
  projection: LearningProjectionSchema,
  sourceContentId: z.string().uuid(),
});
export const LearningLibraryOptionSchema = z.strictObject({
  href: InternalHrefSchema,
  label: z.string().trim().min(1).max(120),
  optionId: z.string().uuid(),
  pathTitle: z.string().trim().min(1).max(200),
  projection: LearningProjectionSchema,
  stepTitle: z.string().trim().min(1).max(240),
});
export const LearningLibraryOptionsResponseSchema = z.strictObject({
  items: z.array(LearningLibraryOptionSchema).max(20),
});

export const LearningEditorResourceQuerySchema = z.strictObject({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(24),
  projection: LearningProjectionSchema.optional(),
  q: z.string().trim().max(120).optional(),
  topic: z.string().trim().min(1).max(120).optional(),
});
export const LearningEditorResourceProjectionSchema = z.strictObject({
  explanationCoverage: z.enum(["complete", "partial", "missing", "not_applicable"]),
  itemCount: z.number().int().nonnegative(),
  itemIds: z.array(z.string().uuid()).max(500),
  projection: LearningProjectionSchema,
});
export const LearningEditorResourceSchema = z.strictObject({
  catalogVisibility: z.enum(["catalog", "guided_only"]),
  estimatedMinutes: z.number().int().nonnegative().nullable(),
  id: z.string().uuid(),
  issues: z.array(z.string().trim().min(1).max(240)).max(20),
  kind: z.enum(["video", "guide", "quiz", "flashcards"]),
  projections: z.array(LearningEditorResourceProjectionSchema).max(4),
  title: z.string().trim().min(1).max(200),
  topic: z.string().trim().max(120),
  version: z.number().int().positive(),
});
export const LearningEditorResourceCatalogResponseSchema = z.strictObject({
  items: z.array(LearningEditorResourceSchema),
  nextCursor: z.string().uuid().nullable(),
  resourceTopics: z.array(z.string().trim().min(1).max(120)).max(500),
  topics: z.array(z.strictObject({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
  })).max(500),
});

export const LearningEnrollmentCreateRequestSchema = z.strictObject({
  pathId: z.string().uuid(),
});

export const LearningEnrollmentUpdateRequestSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  status: LearningEnrollmentStatusSchema,
});

export const LearningEnrollmentResponseSchema = z.strictObject({
  continueHref: InternalHrefSchema,
  enrollment: LearningEnrollmentSummarySchema,
  pathSlug: SlugSchema,
});

export const LearningEditorPathListResponseSchema = z.strictObject({
  items: z.array(LearningPathDetailSchema),
});

export const LearningAttemptStatusSchema = z.enum(["in_progress", "completed", "abandoned"]);
export const LearningStepProgressStateSchema = z.enum([
  "not_started",
  "in_progress",
  "completed",
  "skipped",
]);
export const LearningRecallGradeSchema = z.enum(["again", "hard", "good", "easy"]);
export const LearningIdempotencyKeySchema = z.string().uuid();
export const LEARNING_VIDEO_OBSERVED_XP = 10;
export const LEARNING_VIDEO_SKIPPED_XP = 2;
export const LearningRewardKindSchema = z.enum([
  "activity_understand",
  "activity_recall",
  "activity_check",
  "review_applied",
  "unit_completed",
  "route_completed",
  "milestone_first_activity",
  "milestone_first_unit",
  "milestone_first_review",
]);
export const LearningRewardSchema = z.strictObject({
  awardKey: z.string().trim().min(1).max(300),
  awardedAt: z.string().datetime({ offset: true }),
  kind: LearningRewardKindSchema,
  title: z.string().trim().min(1).max(120),
  xp: z.number().int().nonnegative(),
});
export const LearningMilestoneSchema = LearningRewardSchema.extend({
  kind: z.enum([
    "route_completed",
    "milestone_first_activity",
    "milestone_first_unit",
    "milestone_first_review",
  ]),
});
export const LearningEvidenceStateSchema = z.enum([
  "unassessed",
  "practicing",
  "developing",
  "consolidated",
]);
export const LearningSessionMinutesSchema = z.coerce.number().int().refine(
  (value) => value === 5 || value === 10 || value === 20,
  { message: "sessionMinutes must be 5, 10 or 20" },
);

const LearningAttemptManifestBase = {
  completionRule: LearningCompletionRuleSchema,
  resourceRevisionId: z.string().uuid(),
  sourceContentId: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
};
const LearningAttemptQuestionSchema = PublicLearningQuestionSchema.extend({
  memoryVersion: z.number().int().positive(),
  objectiveIds: z.array(z.string().uuid()).max(20),
});
const LearningAttemptCardSchema = z.strictObject({
  front: z.string(),
  itemId: z.string().uuid(),
  memoryVersion: z.number().int().positive(),
  objectiveIds: z.array(z.string().uuid()).max(20),
});
const LearningReviewItemBase = {
  itemId: z.string().uuid(),
  memoryVersion: z.number().int().positive(),
  objectiveIds: z.array(z.string().uuid()).max(20),
  resourceRevisionId: z.string().uuid(),
  reviewStateVersion: z.number().int().positive(),
  sourceContentId: z.string().uuid(),
};
export const LearningReviewItemSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...LearningReviewItemBase,
    kind: z.literal("quiz"),
    options: z.array(z.strictObject({ id: z.string().uuid(), text: z.string() })).min(2).max(12),
    prompt: z.string().trim().min(1),
  }),
  z.strictObject({
    ...LearningReviewItemBase,
    front: z.string().trim().min(1),
    kind: z.literal("flashcards"),
  }),
]);

export const LearningAttemptManifestSchema = z.discriminatedUnion("projection", [
  z.strictObject({
    ...LearningAttemptManifestBase,
    projection: z.literal("quiz"),
    questions: z.array(LearningAttemptQuestionSchema).min(1).max(100),
  }),
  z.strictObject({
    ...LearningAttemptManifestBase,
    cards: z.array(LearningAttemptCardSchema).min(1).max(500),
    projection: z.literal("flashcards"),
  }),
  z.strictObject({
    ...LearningAttemptManifestBase,
    document: z.unknown().nullable(),
    projection: z.literal("guide"),
    sections: z.array(z.strictObject({ body: z.string(), heading: z.string() })).max(100),
    selectedSectionIndexes: z.array(z.number().int().nonnegative()).max(100),
  }),
  z.strictObject({
    ...LearningAttemptManifestBase,
    durationSeconds: z.number().int().positive().nullable(),
    externalUrl: z.string().url().nullable(),
    projection: z.literal("video"),
    range: z.strictObject({
      endSeconds: z.number().int().positive(),
      startSeconds: z.number().int().nonnegative(),
    }).nullable(),
  }),
  z.strictObject({
    items: z.array(LearningReviewItemSchema).min(1).max(10),
    projection: z.literal("review"),
    title: z.string().trim().min(1).max(500),
  }),
]);

export const LearningObservedRangeSchema = z.strictObject({
  endSeconds: z.number().nonnegative(),
  startSeconds: z.number().nonnegative(),
}).refine((range) => range.endSeconds > range.startSeconds, {
  message: "endSeconds must be greater than startSeconds",
});

export const LearningAttemptResumeSchema = z.strictObject({
  answeredItemIds: z.array(z.string().uuid()).max(500),
  currentIndex: z.number().int().nonnegative(),
  guidePosition: z.strictObject({
    offsetPercent: z.number().min(0).max(100),
    sectionIndex: z.number().int().nonnegative(),
  }).nullable(),
  observedRanges: z.array(LearningObservedRangeSchema).max(500),
  ratedItemIds: z.array(z.string().uuid()).max(500),
  revealedItemIds: z.array(z.string().uuid()).max(500),
  videoDurationSeconds: z.number().int().positive().max(86_400).nullable().default(null),
  videoPositionSeconds: z.number().nonnegative().nullable(),
});

export const LearningReviewStateSummarySchema = z.strictObject({
  lapses: z.number().int().nonnegative(),
  nextDueAt: z.string().datetime({ offset: true }),
  policyVersion: z.string().trim().min(1).max(80),
  rowVersion: z.number().int().positive(),
  stage: z.number().int().min(0).max(4),
});
export const LearningAttemptResponseRecordSchema = z.strictObject({
  answer: z.record(z.string(), z.unknown()),
  answeredAt: z.string().datetime({ offset: true }),
  grading: z.strictObject({
    correct: z.boolean().optional(),
    correctOptionId: z.string().uuid().optional(),
    explanation: z.string().optional(),
    recallGrade: LearningRecallGradeSchema.optional(),
    reviewState: LearningReviewStateSummarySchema.optional(),
    selectedOptionId: z.string().uuid().optional(),
    sessionRetry: z.boolean().optional(),
  }),
  itemId: z.string().uuid(),
  memoryVersion: z.number().int().positive(),
  reviewState: LearningReviewStateSummarySchema.nullable(),
  round: z.number().int().positive(),
  scheduleApplied: z.boolean(),
});

export const LearningAttemptScoreSchema = z.strictObject({
  answered: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  percent: z.number().int().min(0).max(100),
  total: z.number().int().nonnegative(),
});

export const LearningAttemptSchema = z.strictObject({
  clientAttemptId: z.string().uuid(),
  enrollmentId: z.string().uuid().nullable(),
  id: z.string().uuid(),
  manifest: LearningAttemptManifestSchema,
  pathSlug: SlugSchema.nullable(),
  pathVersionId: z.string().uuid().nullable(),
  responses: z.array(LearningAttemptResponseRecordSchema),
  resume: LearningAttemptResumeSchema,
  revealedCards: z.array(z.strictObject({ back: z.string(), itemId: z.string().uuid() })),
  rowVersion: z.number().int().positive(),
  score: LearningAttemptScoreSchema.nullable(),
  startedAt: z.string().datetime({ offset: true }),
  status: LearningAttemptStatusSchema,
  stepId: z.string().uuid().nullable(),
  stepOptionId: z.string().uuid().nullable(),
  submittedAt: z.string().datetime({ offset: true }).nullable(),
});

export const LearningStepProgressSchema = z.strictObject({
  attemptId: z.string().uuid().nullable(),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  completionMethod: z.enum(["graded", "observed", "rated", "self_reported"]).nullable(),
  isEssential: z.boolean(),
  rowVersion: z.number().int().nonnegative(),
  state: LearningStepProgressStateSchema,
  stepId: z.string().uuid(),
  title: z.string(),
});
export const LearningUnitProgressSchema = z.strictObject({
  completedEssentialSteps: z.number().int().nonnegative(),
  id: z.string().uuid(),
  objectives: z.array(z.strictObject({
    distinctQuestions: z.number().int().nonnegative(),
    evidenceLimited: z.boolean(),
    id: z.string().uuid(),
    lastAssessedAt: z.string().datetime({ offset: true }).nullable(),
    lastCheckPercent: z.number().int().min(0).max(100).nullable(),
    lastReviewAt: z.string().datetime({ offset: true }).nullable(),
    reviewRecommended: z.boolean(),
    state: LearningEvidenceStateSchema,
    title: z.string(),
  })).default([]),
  steps: z.array(LearningStepProgressSchema),
  title: z.string(),
  totalEssentialSteps: z.number().int().nonnegative(),
});
export const LearningEnrollmentProgressSchema = z.strictObject({
  completedEssentialSteps: z.number().int().nonnegative(),
  enrollmentId: z.string().uuid(),
  pathVersionId: z.string().uuid(),
  percentage: z.number().int().min(0).max(100),
  totalEssentialSteps: z.number().int().nonnegative(),
  units: z.array(LearningUnitProgressSchema),
});

export const LearningAttemptCreateRequestSchema = z.strictObject({
  clientAttemptId: z.string().uuid(),
  stepOptionId: z.string().uuid(),
});
export const LearningAttemptResumeRequestSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    durationSeconds: z.number().int().positive().max(86_400).optional(),
    expectedVersion: z.number().int().positive(),
    kind: z.literal("video"),
    observedRanges: z.array(LearningObservedRangeSchema).max(8),
    positionSeconds: z.number().nonnegative(),
  }),
  z.strictObject({
    expectedVersion: z.number().int().positive(),
    kind: z.literal("guide"),
    offsetPercent: z.number().min(0).max(100),
    sectionIndex: z.number().int().nonnegative(),
  }),
]);
export const LearningAttemptResponseRequestSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    expectedVersion: z.number().int().positive(),
    expectedReviewVersion: z.number().int().positive().optional(),
    itemId: z.string().uuid(),
    kind: z.literal("quiz"),
    optionId: z.string().uuid(),
    round: z.number().int().min(1).max(10).default(1),
  }),
  z.strictObject({
    expectedVersion: z.number().int().positive(),
    expectedReviewVersion: z.number().int().positive().optional(),
    itemId: z.string().uuid(),
    kind: z.literal("flashcards"),
    recallGrade: LearningRecallGradeSchema,
    round: z.number().int().min(1).max(10).default(1),
  }),
]);
export const LearningAttemptRevealRequestSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
});
export const LearningAttemptCompleteRequestSchema = z.strictObject({
  confirmation: z.literal(true).optional(),
  expectedVersion: z.number().int().positive(),
});
export const LearningAttemptMutationResponseSchema = z.strictObject({
  attempt: LearningAttemptSchema,
  awards: z.array(LearningRewardSchema).max(20).default([]),
  feedback: LearningAttemptResponseRecordSchema.nullable(),
  progress: LearningEnrollmentProgressSchema.nullable(),
  saved: z.literal(true),
});
export const LearningAttemptMediaResponseSchema = z.strictObject({
  downloadUrl: z.string().url(),
  expiresAt: z.string().datetime({ offset: true }),
});

export const LearningEnrollmentUpgradeRequestSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  targetPathVersionId: z.string().uuid(),
});
export const LearningEnrollmentVersionHistorySchema = z.strictObject({
  adoptedAt: z.string().datetime({ offset: true }),
  pathVersionId: z.string().uuid(),
  previousVersionId: z.string().uuid().nullable(),
  versionNumber: z.number().int().positive(),
});
export const LearningEnrollmentUpgradeStepSchema = z.strictObject({
  completed: z.boolean(),
  currentStepId: z.string().uuid().nullable(),
  kind: z.enum(["equivalent", "changed", "added", "removed"]),
  stableKey: StableKeySchema,
  targetStepId: z.string().uuid().nullable(),
  title: z.string().trim().min(1).max(240),
  transferable: z.boolean(),
});
const LearningEnrollmentUpgradeVersionSchema = z.strictObject({
  id: z.string().uuid(),
  number: z.number().int().positive(),
  publishedAt: z.string().datetime({ offset: true }),
  releaseNotes: z.string(),
});
export const LearningEnrollmentUpgradePreviewSchema = z.strictObject({
  activeAttempt: z.strictObject({
    attemptId: z.string().uuid(),
    href: InternalHrefSchema,
    title: z.string().trim().min(1).max(240),
  }).nullable(),
  currentProgress: z.strictObject({
    completedEssentialSteps: z.number().int().nonnegative(),
    percentage: z.number().int().min(0).max(100),
    totalEssentialSteps: z.number().int().nonnegative(),
  }),
  currentVersion: LearningEnrollmentUpgradeVersionSchema,
  projectedProgress: z.strictObject({
    completedEssentialSteps: z.number().int().nonnegative(),
    percentage: z.number().int().min(0).max(100),
    totalEssentialSteps: z.number().int().nonnegative(),
  }),
  steps: z.array(LearningEnrollmentUpgradeStepSchema).max(3_600),
  summary: z.strictObject({
    added: z.number().int().nonnegative(),
    changed: z.number().int().nonnegative(),
    removed: z.number().int().nonnegative(),
    transferableCompleted: z.number().int().nonnegative(),
  }),
  targetVersion: LearningEnrollmentUpgradeVersionSchema,
});
export const LearningEnrollmentUpgradePreviewResponseSchema = z.strictObject({
  history: z.array(LearningEnrollmentVersionHistorySchema),
  upgrade: LearningEnrollmentUpgradePreviewSchema.nullable(),
});
export const LearningEnrollmentUpgradeResponseSchema = z.strictObject({
  enrollment: LearningEnrollmentSummarySchema,
  pathSlug: SlugSchema,
  progress: LearningEnrollmentProgressSchema,
  transferredSteps: z.number().int().nonnegative(),
});

export const LearningPreferencesSchema = z.strictObject({
  examDate: z.string().date().nullable(),
  pendingConstancy: z.strictObject({
    effectiveOn: z.string().date(),
    timezone: z.string().trim().min(1).max(80),
    weeklyGoalDays: z.union([z.literal(2), z.literal(3), z.literal(5)]).nullable(),
  }).nullable(),
  pinnedEnrollmentId: z.string().uuid().nullable(),
  rowVersion: z.number().int().nonnegative(),
  sessionMinutes: LearningSessionMinutesSchema,
  timezone: z.string().trim().min(1).max(80),
  weeklyGoalDays: z.union([z.literal(2), z.literal(3), z.literal(5)]).nullable(),
});
export const LearningPreferencesUpdateRequestSchema = z.strictObject({
  examDate: z.string().date().nullable().optional(),
  expectedVersion: z.number().int().nonnegative(),
  pinnedEnrollmentId: z.string().uuid().nullable().optional(),
  sessionMinutes: LearningSessionMinutesSchema.optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  weeklyGoalDays: z.union([z.literal(2), z.literal(3), z.literal(5)]).nullable().optional(),
}).refine((value) => Object.keys(value).some((key) => key !== "expectedVersion"), {
  message: "At least one preference is required",
});
export const LearningReviewSessionCreateRequestSchema = z.strictObject({
  clientAttemptId: z.string().uuid(),
  enrollmentId: z.string().uuid().optional(),
  sessionMinutes: LearningSessionMinutesSchema.optional(),
});
export const LearningTaskOverrideRequestSchema = z.strictObject({
  action: z.enum(["snooze", "dismiss", "pin"]),
  snoozedUntil: z.string().datetime({ offset: true }).optional(),
  taskKeys: z.array(z.string().trim().min(1).max(300)).min(1).max(10),
}).superRefine((value, context) => {
  if (value.action === "snooze" && !value.snoozedUntil) {
    context.addIssue({ code: "custom", message: "snoozedUntil is required for snooze" });
  }
  if (value.action !== "snooze" && value.snoozedUntil) {
    context.addIssue({ code: "custom", message: "snoozedUntil is only valid for snooze" });
  }
});
export const LearningTaskOverrideResponseSchema = z.strictObject({ saved: z.literal(true) });
export const LearningStepPreferenceRequestSchema = z.strictObject({
  action: z.enum(["skip", "unskip"]),
  enrollmentId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
});

export const LearningHomeQuerySchema = z.strictObject({
  minutes: LearningSessionMinutesSchema.optional(),
});
export const LearningHomeTaskSchema = z.strictObject({
  band: z.number().int().min(0).max(4),
  dueAt: z.string().datetime({ offset: true }).nullable(),
  enrollmentId: z.string().uuid().nullable(),
  estimatedMinutes: z.number().int().positive().nullable(),
  href: InternalHrefSchema,
  importance: z.number().int().min(1).max(3),
  itemCount: z.number().int().nonnegative(),
  key: z.string().trim().min(1).max(300),
  kind: z.enum(["review", "resume", "step", "reinforcement", "explore"]),
  reason: z.string().trim().min(1).max(240),
  taskKeys: z.array(z.string().trim().min(1).max(300)).min(1).max(10),
  title: z.string().trim().min(1).max(240),
});
export const LearningHomeSchema = z.strictObject({
  activePath: z.strictObject({
    completedSteps: z.number().int().nonnegative(),
    continueHref: InternalHrefSchema,
    enrollmentId: z.string().uuid(),
    progressPercent: z.number().int().min(0).max(100),
    title: z.string(),
    totalSteps: z.number().int().positive(),
  }).nullable(),
  constancy: z.strictObject({
    activeDaysThisWeek: z.number().int().nonnegative(),
    weeklyGoalDays: z.union([z.literal(2), z.literal(3), z.literal(5)]).nullable(),
  }),
  counts: z.strictObject({
    activePaths: z.number().int().nonnegative(),
    dueReviews: z.number().int().nonnegative(),
    pendingEssentialSteps: z.number().int().nonnegative(),
  }),
  generatedAt: z.string().datetime({ offset: true }),
  milestones: z.array(LearningMilestoneSchema).max(12).default([]),
  points: z.number().int().nonnegative(),
  policyVersion: z.literal("recommendations-v1"),
  preferences: LearningPreferencesSchema,
  tasks: z.array(LearningHomeTaskSchema).max(20),
});

export type LearningCompletionRule = z.infer<typeof LearningCompletionRuleSchema>;
export type LearningAttempt = z.infer<typeof LearningAttemptSchema>;
export type LearningAttemptCompleteRequest = z.infer<typeof LearningAttemptCompleteRequestSchema>;
export type LearningAttemptCreateRequest = z.infer<typeof LearningAttemptCreateRequestSchema>;
export type LearningAttemptManifest = z.infer<typeof LearningAttemptManifestSchema>;
export type LearningAttemptMediaResponse = z.infer<typeof LearningAttemptMediaResponseSchema>;
export type LearningAttemptMutationResponse = z.infer<typeof LearningAttemptMutationResponseSchema>;
export type LearningAttemptResponseRequest = z.infer<typeof LearningAttemptResponseRequestSchema>;
export type LearningAttemptResponseRecord = z.infer<typeof LearningAttemptResponseRecordSchema>;
export type LearningAttemptResume = z.infer<typeof LearningAttemptResumeSchema>;
export type LearningAttemptResumeRequest = z.infer<typeof LearningAttemptResumeRequestSchema>;
export type LearningAttemptStatus = z.infer<typeof LearningAttemptStatusSchema>;
export type LearningCoverKey = z.infer<typeof LearningCoverKeySchema>;
export type LearningEnrollmentProgress = z.infer<typeof LearningEnrollmentProgressSchema>;
export type LearningEnrollmentResponse = z.infer<typeof LearningEnrollmentResponseSchema>;
export type LearningEnrollmentStatus = z.infer<typeof LearningEnrollmentStatusSchema>;
export type LearningEnrollmentSummary = z.infer<typeof LearningEnrollmentSummarySchema>;
export type LearningEnrollmentUpgradePreview = z.infer<typeof LearningEnrollmentUpgradePreviewSchema>;
export type LearningEnrollmentUpgradePreviewResponse = z.infer<typeof LearningEnrollmentUpgradePreviewResponseSchema>;
export type LearningEnrollmentUpgradeRequest = z.infer<typeof LearningEnrollmentUpgradeRequestSchema>;
export type LearningEnrollmentUpgradeResponse = z.infer<typeof LearningEnrollmentUpgradeResponseSchema>;
export type LearningEnrollmentVersionHistory = z.infer<typeof LearningEnrollmentVersionHistorySchema>;
export type LearningEditorResource = z.infer<typeof LearningEditorResourceSchema>;
export type LearningEditorResourceCatalogResponse = z.infer<typeof LearningEditorResourceCatalogResponseSchema>;
export type LearningEvidenceState = z.infer<typeof LearningEvidenceStateSchema>;
export type LearningHome = z.infer<typeof LearningHomeSchema>;
export type LearningHomeTask = z.infer<typeof LearningHomeTaskSchema>;
export type LearningLibraryOption = z.infer<typeof LearningLibraryOptionSchema>;
export type LearningPreferences = z.infer<typeof LearningPreferencesSchema>;
export type LearningPreferencesUpdateRequest = z.infer<typeof LearningPreferencesUpdateRequestSchema>;
export type LearningRecallGrade = z.infer<typeof LearningRecallGradeSchema>;
export type LearningReward = z.infer<typeof LearningRewardSchema>;
export type LearningRewardKind = z.infer<typeof LearningRewardKindSchema>;
export type LearningMilestone = z.infer<typeof LearningMilestoneSchema>;
export type LearningReviewItem = z.infer<typeof LearningReviewItemSchema>;
export type LearningReviewSessionCreateRequest = z.infer<typeof LearningReviewSessionCreateRequestSchema>;
export type LearningStepPreferenceRequest = z.infer<typeof LearningStepPreferenceRequestSchema>;
export type LearningTaskOverrideRequest = z.infer<typeof LearningTaskOverrideRequestSchema>;
export type LearningObjective = z.infer<typeof LearningObjectiveSchema>;
export type LearningOptionConfig = z.infer<typeof LearningOptionConfigSchema>;
export type LearningPathCard = z.infer<typeof LearningPathCardSchema>;
export type LearningPathCreateRequest = z.infer<typeof LearningPathCreateRequestSchema>;
export type LearningPathDefinition = z.infer<typeof LearningPathDefinitionSchema>;
export type LearningPathDetail = z.infer<typeof LearningPathDetailSchema>;
export type LearningPathOption = z.infer<typeof LearningPathOptionSchema>;
export type LearningPathOptionDraft = z.infer<typeof LearningPathOptionDraftSchema>;
export type LearningPathStatus = z.infer<typeof LearningPathStatusSchema>;
export type LearningPathStep = z.infer<typeof LearningPathStepSchema>;
export type LearningPathStepDraft = z.infer<typeof LearningPathStepDraftSchema>;
export type LearningStepPurpose = z.infer<typeof LearningStepPurposeSchema>;
export type LearningStepProgressState = z.infer<typeof LearningStepProgressStateSchema>;
export type LearningPathUnit = z.infer<typeof LearningPathUnitSchema>;
export type LearningPathUnitDraft = z.infer<typeof LearningPathUnitDraftSchema>;
export type LearningPathUpdateRequest = z.infer<typeof LearningPathUpdateRequestSchema>;
export type LearningPathValidationIssue = z.infer<typeof LearningPathValidationIssueSchema>;

export type GuidedLearningFailure =
  | "active_attempt"
  | "conflict"
  | "forbidden"
  | "idempotency_conflict"
  | "invalid_state"
  | "not_found"
  | "resource_changed"
  | "version_conflict";
export type GuidedLearningResult<T> =
  | { status: "success"; value: T }
  | { status: GuidedLearningFailure }
  | { issues: LearningPathValidationIssue[]; status: "not_ready" };

export interface GuidedLearningProvider {
  completeAttempt(input: {
    attemptId: string;
    idempotencyKey: string;
    request: LearningAttemptCompleteRequest;
    userId: string;
  }): Promise<GuidedLearningResult<LearningAttemptMutationResponse>>;
  createAttempt(input: {
    idempotencyKey: string;
    request: LearningAttemptCreateRequest;
    userId: string;
  }): Promise<GuidedLearningResult<LearningAttemptMutationResponse>>;
  createEnrollment(input: {
    pathId: string;
    userId: string;
  }): Promise<GuidedLearningResult<LearningEnrollmentResponse>>;
  createPath(input: {
    actorUserId: string;
    draft: LearningPathCreateRequest;
  }): Promise<GuidedLearningResult<LearningPathDetail>>;
  createReviewSession(input: {
    idempotencyKey: string;
    request: LearningReviewSessionCreateRequest;
    userId: string;
  }): Promise<GuidedLearningResult<LearningAttemptMutationResponse>>;
  createVersion(input: {
    actorUserId: string;
    canEditAll: boolean;
    pathId: string;
    releaseNotes: string;
  }): Promise<GuidedLearningResult<LearningPathDetail>>;
  getAttempt(input: {
    attemptId: string;
    userId: string;
  }): Promise<GuidedLearningResult<LearningAttempt>>;
  getAttemptMedia(input: {
    attemptId: string;
    userId: string;
  }): Promise<GuidedLearningResult<LearningAttemptMediaResponse>>;
  getEnrollmentProgress(input: {
    enrollmentId: string;
    userId: string;
  }): Promise<GuidedLearningResult<LearningEnrollmentProgress>>;
  getEnrollmentUpgradePreview(input: {
    enrollmentId: string;
    userId: string;
  }): Promise<GuidedLearningResult<LearningEnrollmentUpgradePreviewResponse>>;
  getHome(input: {
    minutes?: number;
    userId: string;
  }): Promise<LearningHome>;
  getPreferences(input: { userId: string }): Promise<LearningPreferences>;
  getEditorPath(input: {
    actorUserId: string;
    canEditAll: boolean;
    pathId: string;
  }): Promise<GuidedLearningResult<LearningPathDetail>>;
  getPathBySlug(input: { slug: string; userId: string }): Promise<LearningPathDetail | null>;
  listEditorPaths(input: {
    actorUserId: string;
    canEditAll: boolean;
  }): Promise<LearningPathDetail[]>;
  listEditorResources(input: {
    cursor?: string;
    limit: number;
    projection?: LearningProjection;
    q?: string;
    topic?: string;
  }): Promise<LearningEditorResourceCatalogResponse>;
  listLibraryOptions(input: {
    projection: LearningProjection;
    sourceContentId: string;
    userId: string;
  }): Promise<LearningLibraryOption[]>;
  listPublishedPaths(input: {
    cursor?: string;
    limit: number;
    topicId?: string;
    userId: string;
  }): Promise<{ items: LearningPathCard[]; nextCursor: string | null }>;
  recordAttemptResponse(input: {
    attemptId: string;
    idempotencyKey: string;
    request: LearningAttemptResponseRequest;
    userId: string;
  }): Promise<GuidedLearningResult<LearningAttemptMutationResponse>>;
  revealAttemptItem(input: {
    attemptId: string;
    expectedVersion: number;
    idempotencyKey: string;
    itemId: string;
    userId: string;
  }): Promise<GuidedLearningResult<LearningAttemptMutationResponse>>;
  updateAttemptResume(input: {
    attemptId: string;
    idempotencyKey: string;
    request: LearningAttemptResumeRequest;
    userId: string;
  }): Promise<GuidedLearningResult<LearningAttemptMutationResponse>>;
  transitionPath(input: {
    actorUserId: string;
    canPublish: boolean;
    canReview: boolean;
    expectedVersion: number;
    pathId: string;
    status: "in_review" | "changes_requested" | "approved" | "published" | "archived";
  }): Promise<GuidedLearningResult<LearningPathDetail>>;
  updatePreferences(input: {
    idempotencyKey: string;
    request: LearningPreferencesUpdateRequest;
    userId: string;
  }): Promise<GuidedLearningResult<LearningPreferences>>;
  updateStepPreference(input: {
    idempotencyKey: string;
    request: LearningStepPreferenceRequest;
    stepId: string;
    userId: string;
  }): Promise<GuidedLearningResult<LearningEnrollmentProgress>>;
  updateTaskOverride(input: {
    idempotencyKey: string;
    request: LearningTaskOverrideRequest;
    userId: string;
  }): Promise<GuidedLearningResult<{ saved: true }>>;
  updateEnrollment(input: {
    enrollmentId: string;
    expectedVersion: number;
    status: LearningEnrollmentStatus;
    userId: string;
  }): Promise<GuidedLearningResult<LearningEnrollmentResponse>>;
  upgradeEnrollment(input: {
    enrollmentId: string;
    idempotencyKey: string;
    request: LearningEnrollmentUpgradeRequest;
    userId: string;
  }): Promise<GuidedLearningResult<LearningEnrollmentUpgradeResponse>>;
  updatePath(input: {
    actorUserId: string;
    canEditAll: boolean;
    pathId: string;
    update: LearningPathUpdateRequest;
  }): Promise<GuidedLearningResult<LearningPathDetail>>;
  validatePath(input: {
    actorUserId: string;
    canEditAll: boolean;
    pathId: string;
  }): Promise<GuidedLearningResult<{ issues: LearningPathValidationIssue[]; ready: boolean }>>;
}
