import { sql, type Selectable, type Transaction } from "kysely";
import { z } from "zod";
import {
  LearningAttemptMutationResponseSchema,
  LearningAttemptResumeSchema,
  LearningAttemptSchema,
  LearningCompletionRuleSchema,
  LearningEnrollmentProgressSchema,
  LearningObjectiveSchema,
  LearningOptionConfigSchema,
  LearningPathStatusSchema,
  type GuidedLearningProvider,
  type GuidedLearningResult,
  type LearningAttempt,
  type LearningAttemptMutationResponse,
  type LearningAttemptResume,
  type LearningEnrollmentProgress,
  type LearningRecallGrade,
  type LearningReward,
} from "@cediah/contracts";
import type {
  CediahDatabase,
  DatabaseClient,
  JsonValue,
  LearningAttemptTable,
} from "../db/database.js";
import {
  createStoredAttemptManifest,
  createStoredReviewAttemptManifest,
  initialAttemptResume,
  manifestCard,
  manifestItemIds,
  manifestQuestion,
  manifestReviewItem,
  parseStoredAttemptManifest,
  toPublicAttemptManifest,
  type StoredAttemptManifest,
  type StoredRouteAttemptManifest,
} from "../guided-learning/attempt-manifest.js";
import { gradeQuizOption } from "../guided-learning/adapters/quiz.js";
import { recomputeObjectiveEvidence } from "../guided-learning/learning-evidence.js";
import { hashLearningSnapshot } from "../guided-learning/snapshot-hash.js";
import {
  filterReviewCandidateOverrides,
  loadReviewCandidates,
  selectReviewCandidates,
  storedReviewItem,
} from "../guided-learning/review-candidates.js";
import {
  reviewSchedulerPolicyVersion,
  scheduleReview,
} from "../guided-learning/review-scheduler.js";
import {
  awardAppliedReview,
  awardCompletedRoute,
  awardCompletedStep,
  awardCompletedUnit,
} from "../guided-learning/rewards.js";
import {
  createContentAssetDownloadUrl,
  type PostgresContentProviderConfiguration,
} from "./postgres-content.js";

type QueryDatabase = DatabaseClient | Transaction<CediahDatabase>;
type AttemptRow = Selectable<LearningAttemptTable>;
type ActivityMethods = Pick<GuidedLearningProvider,
  | "completeAttempt"
  | "createAttempt"
  | "createReviewSession"
  | "getAttempt"
  | "getAttemptMedia"
  | "getEnrollmentProgress"
  | "recordAttemptResponse"
  | "revealAttemptItem"
  | "updateAttemptResume"
>;

const RevisionSnapshotSchema = z.strictObject({
  content: z.unknown(),
  projection: z.enum(["video", "guide", "quiz", "flashcards"]),
  sourceContentId: z.string().uuid(),
  sourceVersion: z.number().int().positive(),
  title: z.string().trim().min(1).max(500),
});
const ObjectiveEvidenceJsonSchema = z.strictObject({
  distinctQuestions: z.number().int().nonnegative(),
  evidenceLimited: z.boolean(),
  historicalState: z.enum(["unassessed", "practicing", "developing", "consolidated"]),
  lastCheckPercent: z.number().int().min(0).max(100).nullable(),
  lastReviewAt: z.string().datetime({ offset: true }).nullable(),
  reviewRecommended: z.boolean(),
});
const failureStatuses = new Set([
  "conflict",
  "forbidden",
  "idempotency_conflict",
  "invalid_state",
  "not_found",
  "resource_changed",
  "version_conflict",
]);

function toIso(value: Date | string) {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function parseRecord(value: JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function responseReviewState(grading: Record<string, unknown>) {
  const value = grading.reviewState;
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function reviewStateSummary(row: {
  lapses: number;
  next_due_at: Date | string;
  policy_version: string;
  row_version: number;
  stage: number;
}) {
  return {
    lapses: row.lapses,
    nextDueAt: toIso(row.next_due_at),
    policyVersion: row.policy_version,
    rowVersion: row.row_version,
    stage: row.stage,
  };
}

function parseReceipt(value: JsonValue | null): GuidedLearningResult<LearningAttemptMutationResponse> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "conflict" };
  const record = value as Record<string, unknown>;
  if (record.status === "success") {
    const parsed = LearningAttemptMutationResponseSchema.safeParse(record.value);
    return parsed.success ? { status: "success", value: parsed.data } : { status: "conflict" };
  }
  return typeof record.status === "string" && failureStatuses.has(record.status)
    ? { status: record.status as Exclude<GuidedLearningResult<never>["status"], "success" | "not_ready"> }
    : { status: "conflict" };
}

function resultHttpStatus(result: GuidedLearningResult<LearningAttemptMutationResponse>) {
  if (result.status === "success") return 200;
  if (result.status === "not_found") return 404;
  if (result.status === "forbidden") return 403;
  return result.status === "not_ready" ? 422 : 409;
}

async function withReceipt(
  transaction: Transaction<CediahDatabase>,
  input: { idempotencyKey: string; request: unknown; userId: string },
  mutate: () => Promise<GuidedLearningResult<LearningAttemptMutationResponse>>,
) {
  const requestHash = hashLearningSnapshot(input.request);
  const inserted = await transaction.insertInto("learning_mutation_receipts").values({
    http_status: null,
    idempotency_key: input.idempotencyKey,
    request_hash: requestHash,
    response_json: null,
    user_id: input.userId,
  }).onConflict((conflict) => conflict.columns(["user_id", "idempotency_key"]).doNothing())
    .returning("idempotency_key").executeTakeFirst();
  if (!inserted) {
    const receipt = await transaction.selectFrom("learning_mutation_receipts")
      .select(["request_hash", "response_json"])
      .where("user_id", "=", input.userId)
      .where("idempotency_key", "=", input.idempotencyKey)
      .executeTakeFirstOrThrow();
    if (receipt.request_hash !== requestHash) return { status: "idempotency_conflict" } as const;
    return parseReceipt(receipt.response_json);
  }

  const result = await mutate();
  await transaction.updateTable("learning_mutation_receipts").set({
    http_status: resultHttpStatus(result),
    response_json: result as unknown as JsonValue,
  }).where("user_id", "=", input.userId)
    .where("idempotency_key", "=", input.idempotencyKey).executeTakeFirstOrThrow();
  return result;
}

async function readAttempt(
  database: QueryDatabase,
  row: AttemptRow,
): Promise<LearningAttempt> {
  const manifest = parseStoredAttemptManifest(row.manifest_json);
  const resume = LearningAttemptResumeSchema.parse(row.resume_json);
  const [responseRows, path] = await Promise.all([
    database.selectFrom("learning_responses")
      .selectAll().where("attempt_id", "=", row.id)
      .orderBy("answered_at", "asc").orderBy("id", "asc").execute(),
    row.enrollment_id ? database.selectFrom("learning_enrollments")
      .innerJoin("learning_paths", "learning_paths.id", "learning_enrollments.path_id")
      .select("learning_paths.slug")
      .where("learning_enrollments.id", "=", row.enrollment_id).executeTakeFirst() : Promise.resolve(undefined),
  ]);
  const responses = responseRows.map((response) => {
    const grading = parseRecord(response.grading_json);
    return {
    answer: parseRecord(response.answer_json),
    answeredAt: toIso(response.answered_at),
    grading,
    itemId: response.item_id,
    memoryVersion: response.memory_version,
    reviewState: responseReviewState(grading),
    round: response.round,
    scheduleApplied: response.schedule_applied,
  }; });
  const revealedCards = resume.revealedItemIds.flatMap((itemId) => {
    const card = manifestCard(manifest, itemId);
    return card ? [{ back: card.back, itemId }] : [];
  });
  return LearningAttemptSchema.parse({
    clientAttemptId: row.client_attempt_id,
    enrollmentId: row.enrollment_id,
    id: row.id,
    manifest: toPublicAttemptManifest(manifest),
    pathSlug: path?.slug ?? null,
    pathVersionId: row.path_version_id,
    responses,
    resume,
    revealedCards,
    rowVersion: row.row_version,
    score: row.score_json,
    startedAt: toIso(row.started_at),
    status: row.status,
    stepId: row.step_id,
    stepOptionId: row.step_option_id,
    submittedAt: row.submitted_at ? toIso(row.submitted_at) : null,
  });
}

export async function readLearningEnrollmentProgress(
  database: QueryDatabase,
  enrollmentId: string,
  userId: string,
): Promise<LearningEnrollmentProgress | null> {
  const enrollment = await database.selectFrom("learning_enrollments")
    .select(["id", "path_version_id"])
    .where("id", "=", enrollmentId).where("user_id", "=", userId).executeTakeFirst();
  if (!enrollment) return null;
  const [units, steps, progressRows, attemptRows, objectiveRows] = await Promise.all([
    database.selectFrom("learning_path_units").select(["id", "objectives_json", "position", "title"])
      .where("path_version_id", "=", enrollment.path_version_id).orderBy("position", "asc").execute(),
    database.selectFrom("learning_path_steps").select(["id", "is_essential", "position", "title", "unit_id"])
      .where("path_version_id", "=", enrollment.path_version_id).orderBy("position", "asc").execute(),
    database.selectFrom("learning_step_progress").selectAll()
      .where("enrollment_id", "=", enrollment.id)
      .where("path_version_id", "=", enrollment.path_version_id).execute(),
    database.selectFrom("learning_attempts").select(["id", "step_id", "updated_at"])
      .where("enrollment_id", "=", enrollment.id)
      .where("path_version_id", "=", enrollment.path_version_id)
      .where("status", "=", "in_progress").orderBy("updated_at", "desc").execute(),
    database.selectFrom("learning_objective_progress").selectAll()
      .where("enrollment_id", "=", enrollment.id)
      .where("path_version_id", "=", enrollment.path_version_id)
      .execute(),
  ]);
  const progressByStep = new Map(progressRows.map((entry) => [entry.step_id, entry]));
  const attemptByStep = new Map<string, string>();
  for (const attempt of attemptRows) {
    if (attempt.step_id && !attemptByStep.has(attempt.step_id)) attemptByStep.set(attempt.step_id, attempt.id);
  }
  const objectiveProgress = new Map(objectiveRows.map((entry) => [entry.objective_id, entry]));
  let totalEssentialSteps = 0;
  let completedEssentialSteps = 0;
  const unitProgress = units.map((unit) => {
    const unitSteps = steps.filter((step) => step.unit_id === unit.id).map((step) => {
      const progress = progressByStep.get(step.id);
      const state = progress?.state ?? "not_started";
      if (step.is_essential) {
        totalEssentialSteps += 1;
        if (state === "completed") completedEssentialSteps += 1;
      }
      return {
        attemptId: attemptByStep.get(step.id) ?? null,
        completedAt: progress?.completed_at ? toIso(progress.completed_at) : null,
        completionMethod: progress?.completion_method ?? null,
        isEssential: step.is_essential,
        rowVersion: progress?.row_version ?? 0,
        state,
        stepId: step.id,
        title: step.title,
      };
    });
    const essential = unitSteps.filter((step) => step.isEssential);
    const objectives = z.array(LearningObjectiveSchema).safeParse(unit.objectives_json);
    return {
      completedEssentialSteps: essential.filter((step) => step.state === "completed").length,
      id: unit.id,
      objectives: (objectives.success ? objectives.data : []).map((objective) => {
        const stored = objectiveProgress.get(objective.id);
        const evidence = stored ? ObjectiveEvidenceJsonSchema.safeParse(stored.evidence_json) : null;
        const details = evidence?.success ? evidence.data : null;
        return {
          distinctQuestions: details?.distinctQuestions ?? 0,
          evidenceLimited: details?.evidenceLimited ?? false,
          id: objective.id,
          lastAssessedAt: stored?.last_assessed_at ? toIso(stored.last_assessed_at) : null,
          lastCheckPercent: details?.lastCheckPercent ?? null,
          lastReviewAt: details?.lastReviewAt ?? null,
          reviewRecommended: details?.reviewRecommended ?? false,
          state: stored?.evidence_state ?? "unassessed",
          title: objective.title,
        };
      }),
      steps: unitSteps,
      title: unit.title,
      totalEssentialSteps: essential.length,
    };
  });
  const percentage = totalEssentialSteps === 0 ? 0
    : completedEssentialSteps === totalEssentialSteps ? 100
      : Math.min(99, Math.round((completedEssentialSteps / totalEssentialSteps) * 100));
  return LearningEnrollmentProgressSchema.parse({
    completedEssentialSteps,
    enrollmentId: enrollment.id,
    pathVersionId: enrollment.path_version_id,
    percentage,
    totalEssentialSteps,
    units: unitProgress,
  });
}

async function mutationResponse(
  transaction: Transaction<CediahDatabase>,
  row: AttemptRow,
  userId: string,
  feedback: LearningAttemptMutationResponse["feedback"] = null,
  awards: LearningReward[] = [],
) {
  const progress = row.enrollment_id
    ? await readLearningEnrollmentProgress(transaction, row.enrollment_id, userId)
    : null;
  if (row.enrollment_id && !progress) return { status: "not_found" } as const;
  return {
    status: "success" as const,
    value: LearningAttemptMutationResponseSchema.parse({
      attempt: await readAttempt(transaction, row),
      awards,
      feedback,
      progress,
      saved: true,
    }),
  };
}

async function available(
  transaction: Transaction<CediahDatabase>,
  manifest: StoredAttemptManifest,
) {
  if (manifest.projection === "review") {
    const sources = [...new Map(manifest.items.map((item) => [item.resourceRevisionId, item])).values()];
    for (const item of sources) {
      const resource = await transaction.selectFrom("learning_resource_revisions")
        .innerJoin("learning_resources", "learning_resources.id", "learning_resource_revisions.resource_id")
        .innerJoin("content_items", "content_items.id", "learning_resources.source_content_id")
        .select(["content_items.status", "learning_resource_revisions.payload_hash", "learning_resources.retired_at"])
        .where("learning_resource_revisions.id", "=", item.resourceRevisionId)
        .where("learning_resources.source_content_id", "=", item.sourceContentId)
        .forShare()
        .executeTakeFirst();
      if (!resource || resource.retired_at || resource.status !== "published" ||
        resource.payload_hash !== item.payloadHash) return false;
    }
    return true;
  }
  const resource = await transaction.selectFrom("learning_resource_revisions")
    .innerJoin("learning_resources", "learning_resources.id", "learning_resource_revisions.resource_id")
    .innerJoin("content_items", "content_items.id", "learning_resources.source_content_id")
    .select(["content_items.status", "learning_resource_revisions.payload_hash", "learning_resources.retired_at"])
    .where("learning_resource_revisions.id", "=", manifest.resourceRevisionId)
    .where("learning_resources.source_content_id", "=", manifest.sourceContentId)
    .forShare()
    .executeTakeFirst();
  return Boolean(resource && !resource.retired_at && resource.status === "published" &&
    resource.payload_hash === manifest.payloadHash);
}

async function markStepStarted(
  transaction: Transaction<CediahDatabase>,
  row: AttemptRow,
) {
  if (!row.enrollment_id || !row.path_version_id || !row.step_id) return;
  const current = await transaction.selectFrom("learning_step_progress").selectAll()
    .where("enrollment_id", "=", row.enrollment_id).where("step_id", "=", row.step_id)
    .forUpdate().executeTakeFirst();
  if (!current) {
    await transaction.insertInto("learning_step_progress").values({
      completed_at: null,
      completion_method: null,
      enrollment_id: row.enrollment_id,
      evidence_attempt_id: null,
      path_version_id: row.path_version_id,
      state: "in_progress",
      step_id: row.step_id,
    }).execute();
  } else if (current.state !== "completed" && current.state !== "in_progress") {
    await transaction.updateTable("learning_step_progress").set({
      completed_at: null,
      completion_method: null,
      evidence_attempt_id: null,
      row_version: current.row_version + 1,
      state: "in_progress",
    }).where("enrollment_id", "=", row.enrollment_id).where("step_id", "=", row.step_id)
      .where("row_version", "=", current.row_version).executeTakeFirstOrThrow();
  }
}

function mergeRanges(
  current: Array<{ endSeconds: number; startSeconds: number }>,
  incoming: Array<{ endSeconds: number; startSeconds: number }>,
  bounds: { endSeconds: number; startSeconds: number },
) {
  const clipped = [...current, ...incoming].map((range) => ({
    endSeconds: Math.min(bounds.endSeconds, Math.max(bounds.startSeconds, range.endSeconds)),
    startSeconds: Math.min(bounds.endSeconds, Math.max(bounds.startSeconds, range.startSeconds)),
  })).filter((range) => range.endSeconds > range.startSeconds)
    .sort((left, right) => left.startSeconds - right.startSeconds || left.endSeconds - right.endSeconds);
  const merged: typeof clipped = [];
  for (const range of clipped) {
    const previous = merged.at(-1);
    if (previous && range.startSeconds <= previous.endSeconds + 0.25) {
      previous.endSeconds = Math.max(previous.endSeconds, range.endSeconds);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function videoBounds(manifest: StoredAttemptManifest) {
  if (manifest.projection !== "video") return null;
  const publicManifest = toPublicAttemptManifest(manifest);
  if (publicManifest.projection !== "video" || !publicManifest.durationSeconds) return null;
  return publicManifest.range ?? { endSeconds: publicManifest.durationSeconds, startSeconds: 0 };
}

function videoCoverage(manifest: StoredAttemptManifest, resume: LearningAttemptResume) {
  const bounds = videoBounds(manifest);
  if (!bounds) return 0;
  const covered = mergeRanges([], resume.observedRanges, bounds)
    .reduce((sum, range) => sum + range.endSeconds - range.startSeconds, 0);
  return covered / (bounds.endSeconds - bounds.startSeconds);
}

async function finishAttempt(
  transaction: Transaction<CediahDatabase>,
  row: AttemptRow,
  manifest: StoredRouteAttemptManifest,
  resume: LearningAttemptResume,
  method: "graded" | "observed" | "rated" | "self_reported",
  acceptedAt: Date,
) {
  if (!row.enrollment_id || !row.path_version_id || !row.step_id) throw new Error("Missing route context");
  if (!row.step_option_id) throw new Error("Missing route option context");
  const responses = await transaction.selectFrom("learning_responses")
    .select("grading_json").where("attempt_id", "=", row.id).execute();
  const total = manifestItemIds(manifest).length;
  const correct = manifest.projection === "quiz"
    ? responses.filter((response) => parseRecord(response.grading_json).correct === true).length
    : 0;
  const score = manifest.projection === "quiz" ? {
    answered: responses.length,
    correct,
    percent: total === 0 ? 0 : Math.round((correct / total) * 100),
    total,
  } : null;
  const completed = await transaction.updateTable("learning_attempts").set({
    resume_json: resume as unknown as JsonValue,
    row_version: row.row_version + 1,
    score_json: score as unknown as JsonValue,
    status: "completed",
    submitted_at: acceptedAt,
  }).where("id", "=", row.id).where("user_id", "=", row.user_id)
    .where("row_version", "=", row.row_version).returningAll().executeTakeFirstOrThrow();

  const stepProgress = await transaction.selectFrom("learning_step_progress").selectAll()
    .where("enrollment_id", "=", row.enrollment_id).where("step_id", "=", row.step_id)
    .forUpdate().executeTakeFirst();
  const stepNewlyCompleted = !stepProgress || stepProgress.state !== "completed";
  if (!stepProgress) {
    await transaction.insertInto("learning_step_progress").values({
      completed_at: acceptedAt, completion_method: method, enrollment_id: row.enrollment_id,
      evidence_attempt_id: row.id, path_version_id: row.path_version_id,
      state: "completed", step_id: row.step_id,
    }).execute();
  } else if (stepProgress.state !== "completed") {
    await transaction.updateTable("learning_step_progress").set({
      completed_at: acceptedAt, completion_method: method, evidence_attempt_id: row.id,
      row_version: stepProgress.row_version + 1, state: "completed",
    }).where("enrollment_id", "=", row.enrollment_id).where("step_id", "=", row.step_id)
      .where("row_version", "=", stepProgress.row_version).executeTakeFirstOrThrow();
  }

  await transaction.insertInto("learning_events").values({
    attempt_id: row.id,
    enrollment_id: row.enrollment_id,
    event_type: "activity_completed",
    local_date: acceptedAt.toISOString().slice(0, 10),
    occurred_at: acceptedAt,
    payload_json: { completionMethod: method, projection: manifest.projection },
    semantic_key: `activity_completed:${row.id}`,
    timezone: "UTC",
    user_id: row.user_id,
  }).onConflict((conflict) => conflict.columns(["user_id", "semantic_key"]).doNothing()).execute();
  const stepEvent = await transaction.insertInto("learning_events").values({
    attempt_id: row.id,
    enrollment_id: row.enrollment_id,
    event_type: "step_completed",
    local_date: acceptedAt.toISOString().slice(0, 10),
    occurred_at: acceptedAt,
    payload_json: { stepId: row.step_id },
    semantic_key: `step_completed:${row.enrollment_id}:${row.step_id}`,
    timezone: "UTC",
    user_id: row.user_id,
  }).onConflict((conflict) => conflict.columns(["user_id", "semantic_key"]).doNothing())
    .returning("id").executeTakeFirst();

  const completionContext = await transaction.selectFrom("learning_path_steps")
    .innerJoin("learning_path_units", "learning_path_units.id", "learning_path_steps.unit_id")
    .innerJoin("learning_step_options", (join) => join
      .on("learning_step_options.id", "=", row.step_option_id!))
    .innerJoin("learning_enrollments", (join) => join
      .on("learning_enrollments.id", "=", row.enrollment_id!))
    .select([
      "learning_enrollments.completed_at as enrollment_completed_at",
      "learning_enrollments.path_id",
      "learning_path_steps.is_essential",
      "learning_path_steps.purpose",
      "learning_path_steps.unit_id",
      "learning_path_units.pedagogy_version as unit_pedagogy_version",
      "learning_path_units.stable_key as unit_stable_key",
      "learning_step_options.reward_identity",
      "learning_step_options.reward_version",
    ])
    .where("learning_path_steps.id", "=", row.step_id)
    .where("learning_step_options.step_id", "=", row.step_id)
    .where("learning_enrollments.user_id", "=", row.user_id)
    .executeTakeFirstOrThrow();
  const awards: LearningReward[] = [];
  if (stepNewlyCompleted && stepEvent) {
    awards.push(...await awardCompletedStep(transaction, {
      acceptedAt,
      eventId: stepEvent.id,
      isEssential: completionContext.is_essential,
      projection: manifest.projection,
      purpose: completionContext.purpose,
      rewardIdentity: completionContext.reward_identity,
      rewardVersion: completionContext.reward_version,
      userId: row.user_id,
    }));
  }

  const totalUnitRow = await transaction.selectFrom("learning_path_steps")
    .select((expression) => expression.fn.countAll<number>().as("count"))
    .where("unit_id", "=", completionContext.unit_id)
    .where("is_essential", "=", true)
    .executeTakeFirstOrThrow();
  const completedUnitRow = await transaction.selectFrom("learning_step_progress")
    .innerJoin("learning_path_steps", "learning_path_steps.id", "learning_step_progress.step_id")
    .select((expression) => expression.fn.countAll<number>().as("count"))
    .where("learning_step_progress.enrollment_id", "=", row.enrollment_id)
    .where("learning_step_progress.state", "=", "completed")
    .where("learning_path_steps.unit_id", "=", completionContext.unit_id)
    .where("learning_path_steps.is_essential", "=", true)
    .executeTakeFirstOrThrow();
  const unitComplete = Number(totalUnitRow.count) > 0 &&
    Number(completedUnitRow.count) === Number(totalUnitRow.count);
  if (stepNewlyCompleted && unitComplete) {
    const unitEvent = await transaction.insertInto("learning_events").values({
      attempt_id: row.id,
      enrollment_id: row.enrollment_id,
      event_type: "unit_completed",
      local_date: acceptedAt.toISOString().slice(0, 10),
      occurred_at: acceptedAt,
      payload_json: { unitId: completionContext.unit_id },
      semantic_key: `unit_completed:${row.enrollment_id}:${completionContext.unit_stable_key}:${completionContext.unit_pedagogy_version}`,
      timezone: "UTC",
      user_id: row.user_id,
    }).onConflict((conflict) => conflict.columns(["user_id", "semantic_key"]).doNothing())
      .returning("id").executeTakeFirst();
    if (unitEvent) awards.push(...await awardCompletedUnit(transaction, {
      acceptedAt,
      eventId: unitEvent.id,
      pathId: completionContext.path_id,
      pedagogyVersion: completionContext.unit_pedagogy_version,
      stableKey: completionContext.unit_stable_key,
      userId: row.user_id,
    }));
  }

  const totalRow = await transaction.selectFrom("learning_path_steps")
    .select((expression) => expression.fn.countAll<number>().as("count"))
    .where("path_version_id", "=", row.path_version_id).where("is_essential", "=", true)
    .executeTakeFirstOrThrow();
  const completedRow = await transaction.selectFrom("learning_step_progress")
    .innerJoin("learning_path_steps", "learning_path_steps.id", "learning_step_progress.step_id")
    .select((expression) => expression.fn.countAll<number>().as("count"))
    .where("learning_step_progress.enrollment_id", "=", row.enrollment_id)
    .where("learning_step_progress.path_version_id", "=", row.path_version_id)
    .where("learning_step_progress.state", "=", "completed")
    .where("learning_path_steps.is_essential", "=", true).executeTakeFirstOrThrow();
  const routeComplete = Number(totalRow.count) > 0 && Number(completedRow.count) === Number(totalRow.count);
  const routeNewlyComplete = routeComplete && !completionContext.enrollment_completed_at;
  await transaction.updateTable("learning_enrollments").set({
    ...(routeComplete ? { completed_at: sql<Date>`coalesce(completed_at, ${acceptedAt})` } : {}),
    last_activity_at: acceptedAt,
  }).where("id", "=", row.enrollment_id).where("user_id", "=", row.user_id).execute();
  if (routeNewlyComplete) {
    const routeEvent = await transaction.insertInto("learning_events").values({
      attempt_id: row.id,
      enrollment_id: row.enrollment_id,
      event_type: "route_completed",
      local_date: acceptedAt.toISOString().slice(0, 10),
      occurred_at: acceptedAt,
      payload_json: { pathVersionId: row.path_version_id },
      semantic_key: `route_completed:${row.enrollment_id}:${row.path_version_id}`,
      timezone: "UTC",
      user_id: row.user_id,
    }).onConflict((conflict) => conflict.columns(["user_id", "semantic_key"]).doNothing())
      .returning("id").executeTakeFirst();
    if (routeEvent) awards.push(...await awardCompletedRoute(transaction, {
      acceptedAt,
      eventId: routeEvent.id,
      pathId: completionContext.path_id,
      pathVersionId: row.path_version_id,
      userId: row.user_id,
    }));
  }
  await recomputeObjectiveEvidence(transaction, {
    enrollmentId: row.enrollment_id,
    now: acceptedAt,
    pathVersionId: row.path_version_id,
    userId: row.user_id,
  });
  return { awards, row: completed };
}

async function finishReviewAttempt(
  transaction: Transaction<CediahDatabase>,
  row: AttemptRow,
  manifest: Extract<StoredAttemptManifest, { projection: "review" }>,
  resume: LearningAttemptResume,
  acceptedAt: Date,
) {
  const completed = await transaction.updateTable("learning_attempts").set({
    resume_json: resume as unknown as JsonValue,
    row_version: row.row_version + 1,
    status: "completed",
    submitted_at: acceptedAt,
  }).where("id", "=", row.id).where("user_id", "=", row.user_id)
    .where("row_version", "=", row.row_version).returningAll().executeTakeFirstOrThrow();
  await transaction.insertInto("learning_events").values({
    attempt_id: row.id,
    enrollment_id: null,
    event_type: "review_session_completed",
    local_date: acceptedAt.toISOString().slice(0, 10),
    occurred_at: acceptedAt,
    payload_json: { itemCount: resume.answeredItemIds.length + resume.ratedItemIds.length },
    semantic_key: `review_session_completed:${row.id}`,
    timezone: "UTC",
    user_id: row.user_id,
  }).onConflict((conflict) => conflict.columns(["user_id", "semantic_key"]).doNothing()).execute();
  const enrollmentIds = [...new Set(manifest.items.flatMap((item) => item.evidenceEnrollmentIds))].sort();
  for (const enrollmentId of enrollmentIds) {
    const enrollment = await transaction.selectFrom("learning_enrollments")
      .select("path_version_id")
      .where("id", "=", enrollmentId)
      .where("user_id", "=", row.user_id)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (enrollment) await recomputeObjectiveEvidence(transaction, {
      enrollmentId,
      now: acceptedAt,
      pathVersionId: enrollment.path_version_id,
      userId: row.user_id,
    });
  }
  return completed;
}

async function lockedAttempt(
  transaction: Transaction<CediahDatabase>,
  attemptId: string,
  userId: string,
) {
  return transaction.selectFrom("learning_attempts").selectAll()
    .where("id", "=", attemptId).where("user_id", "=", userId).forUpdate().executeTakeFirst();
}

export function createPostgresLearningActivityMethods(
  database: DatabaseClient,
  configuration: {
    assetStorage?: PostgresContentProviderConfiguration["assetStorage"];
    clock?: () => Date;
  } = {},
): ActivityMethods {
  const clock = configuration.clock ?? (() => new Date());
  return {
    async createReviewSession(input) {
      return database.transaction().execute((transaction) => withReceipt(transaction, {
        idempotencyKey: input.idempotencyKey,
        request: { operation: "create_review_session", ...input.request },
        userId: input.userId,
      }, async () => {
        const acceptedAt = clock();
        const loaded = await loadReviewCandidates(transaction, {
          enrollmentId: input.request.enrollmentId,
          now: acceptedAt,
          userId: input.userId,
        });
        const visible = await filterReviewCandidateOverrides(transaction, {
          candidates: loaded,
          now: acceptedAt,
          userId: input.userId,
        });
        const sessionMinutes = input.request.sessionMinutes ?? 10;
        const limit = sessionMinutes === 5 ? 5 : 10;
        const candidates = selectReviewCandidates(visible, limit);
        if (candidates.length === 0) return { status: "invalid_state" };

        const enrollmentIds = [...new Set(candidates.map((candidate) => candidate.enrollmentId))].sort();
        const activeEnrollments = await transaction.selectFrom("learning_enrollments")
          .select("id")
          .where("id", "in", enrollmentIds)
          .where("user_id", "=", input.userId)
          .where("status", "=", "active")
          .orderBy("id", "asc")
          .forUpdate()
          .execute();
        if (activeEnrollments.length !== enrollmentIds.length) return { status: "resource_changed" };

        for (const candidate of [...candidates].sort((left, right) =>
          left.itemId.localeCompare(right.itemId) || left.memoryVersion - right.memoryVersion)) {
          const state = await transaction.selectFrom("learning_review_states")
            .select(["next_due_at", "row_version"])
            .where("user_id", "=", input.userId)
            .where("item_id", "=", candidate.itemId)
            .where("memory_version", "=", candidate.memoryVersion)
            .forUpdate()
            .executeTakeFirst();
          if (!state || state.row_version !== candidate.reviewStateVersion ||
            new Date(state.next_due_at).getTime() > acceptedAt.getTime()) {
            return { status: "version_conflict" };
          }
        }

        const manifest = createStoredReviewAttemptManifest(candidates.map(storedReviewItem));
        if (!(await available(transaction, manifest))) return { status: "resource_changed" };
        let row = await transaction.insertInto("learning_attempts").values({
          client_attempt_id: input.request.clientAttemptId,
          enrollment_id: null,
          manifest_json: manifest as unknown as JsonValue,
          path_version_id: null,
          projection: "review",
          purpose: "recall",
          resume_json: initialAttemptResume() as unknown as JsonValue,
          score_json: null,
          started_at: acceptedAt,
          step_id: null,
          step_option_id: null,
          user_id: input.userId,
        }).onConflict((conflict) => conflict.columns(["user_id", "client_attempt_id"]).doNothing())
          .returningAll().executeTakeFirst();
        if (!row) {
          row = await transaction.selectFrom("learning_attempts").selectAll()
            .where("user_id", "=", input.userId)
            .where("client_attempt_id", "=", input.request.clientAttemptId)
            .executeTakeFirstOrThrow();
          if (row.projection !== "review") return { status: "conflict" };
        } else {
          await transaction.insertInto("learning_events").values({
            attempt_id: row.id,
            enrollment_id: null,
            event_type: "review_session_started",
            local_date: acceptedAt.toISOString().slice(0, 10),
            occurred_at: acceptedAt,
            payload_json: { itemCount: candidates.length, sessionMinutes },
            semantic_key: `review_session_started:${row.client_attempt_id}`,
            timezone: "UTC",
            user_id: input.userId,
          }).onConflict((conflict) => conflict.columns(["user_id", "semantic_key"]).doNothing()).execute();
        }
        return mutationResponse(transaction, row, input.userId);
      }));
    },

    async createAttempt(input) {
      return database.transaction().execute((transaction) => withReceipt(transaction, {
        idempotencyKey: input.idempotencyKey,
        request: { operation: "create_attempt", ...input.request },
        userId: input.userId,
      }, async () => {
        const acceptedAt = clock();
        const option = await transaction.selectFrom("learning_step_options")
          .innerJoin("learning_path_steps", "learning_path_steps.id", "learning_step_options.step_id")
          .innerJoin("learning_path_versions", "learning_path_versions.id", "learning_step_options.path_version_id")
          .innerJoin("learning_paths", "learning_paths.id", "learning_path_versions.path_id")
          .innerJoin("learning_enrollments", (join) => join
            .onRef("learning_enrollments.path_id", "=", "learning_paths.id")
            .onRef("learning_enrollments.path_version_id", "=", "learning_path_versions.id")
            .on("learning_enrollments.user_id", "=", input.userId))
          .innerJoin("learning_resource_revisions", "learning_resource_revisions.id", "learning_step_options.resource_revision_id")
          .innerJoin("learning_resources", "learning_resources.id", "learning_resource_revisions.resource_id")
          .innerJoin("content_items", "content_items.id", "learning_resources.source_content_id")
          .select([
            "learning_step_options.completion_rule_json", "learning_step_options.config_json",
            "learning_step_options.id", "learning_step_options.path_version_id",
            "learning_step_options.projection", "learning_step_options.resource_revision_id",
            "learning_step_options.source_content_id", "learning_path_steps.id as step_id",
            "learning_path_steps.purpose", "learning_enrollments.id as enrollment_id",
            "learning_resource_revisions.payload_hash", "learning_resource_revisions.payload_json",
            "learning_resources.retired_at", "content_items.status as source_status",
          ]).where("learning_step_options.id", "=", input.request.stepOptionId)
          .where("learning_path_versions.status", "=", LearningPathStatusSchema.enum.published)
          .where("learning_paths.archived_at", "is", null)
          .where("learning_enrollments.status", "=", "active").executeTakeFirst();
        if (!option) return { status: "not_found" };
        if (option.retired_at || option.source_status !== "published") return { status: "resource_changed" };
        if (hashLearningSnapshot(option.payload_json) !== option.payload_hash) return { status: "resource_changed" };
        const snapshot = RevisionSnapshotSchema.safeParse(option.payload_json);
        if (!snapshot.success || snapshot.data.projection !== option.projection ||
          snapshot.data.sourceContentId !== option.source_content_id) return { status: "resource_changed" };
        let manifest: StoredAttemptManifest;
        try {
          manifest = createStoredAttemptManifest({
            completionRule: LearningCompletionRuleSchema.parse(option.completion_rule_json),
            config: LearningOptionConfigSchema.parse(option.config_json),
            content: snapshot.data.content,
            payloadHash: option.payload_hash,
            projection: option.projection,
            resourceRevisionId: option.resource_revision_id,
            sourceContentId: option.source_content_id,
            title: snapshot.data.title,
          });
          if (["quiz", "flashcards"].includes(manifest.projection) && manifestItemIds(manifest).length === 0) {
            return { status: "resource_changed" };
          }
        } catch {
          return { status: "resource_changed" };
        }

        let row = await transaction.insertInto("learning_attempts").values({
          client_attempt_id: input.request.clientAttemptId,
          enrollment_id: option.enrollment_id,
          manifest_json: manifest as unknown as JsonValue,
          path_version_id: option.path_version_id,
          projection: option.projection,
          purpose: option.purpose,
          resume_json: initialAttemptResume() as unknown as JsonValue,
          score_json: null,
          started_at: acceptedAt,
          step_id: option.step_id,
          step_option_id: option.id,
          user_id: input.userId,
        }).onConflict((conflict) => conflict.columns(["user_id", "client_attempt_id"]).doNothing())
          .returningAll().executeTakeFirst();
        if (!row) {
          row = await transaction.selectFrom("learning_attempts").selectAll()
            .where("user_id", "=", input.userId)
            .where("client_attempt_id", "=", input.request.clientAttemptId).executeTakeFirstOrThrow();
          if (row.step_option_id !== option.id) return { status: "conflict" };
        } else {
          await markStepStarted(transaction, row);
          await transaction.insertInto("learning_events").values({
            attempt_id: row.id, enrollment_id: row.enrollment_id, event_type: "activity_started",
            local_date: acceptedAt.toISOString().slice(0, 10), occurred_at: acceptedAt,
            payload_json: { projection: row.projection }, semantic_key: `activity_started:${row.client_attempt_id}`,
            timezone: "UTC", user_id: input.userId,
          }).onConflict((conflict) => conflict.columns(["user_id", "semantic_key"]).doNothing()).execute();
        }
        return mutationResponse(transaction, row, input.userId);
      }));
    },

    async getAttempt(input) {
      const row = await database.selectFrom("learning_attempts").selectAll()
        .where("id", "=", input.attemptId).where("user_id", "=", input.userId).executeTakeFirst();
      return row ? { status: "success", value: await readAttempt(database, row) } : { status: "not_found" };
    },

    async getAttemptMedia(input) {
      const attempt = await database.selectFrom("learning_attempts").select(["manifest_json", "projection"])
        .where("id", "=", input.attemptId).where("user_id", "=", input.userId).executeTakeFirst();
      if (!attempt || attempt.projection !== "video") return { status: "not_found" };
      const manifest = parseStoredAttemptManifest(attempt.manifest_json);
      if (manifest.projection === "review") return { status: "not_found" };
      const publicManifest = toPublicAttemptManifest(manifest);
      if (publicManifest.projection !== "video" || publicManifest.externalUrl) return { status: "not_found" };
      const resource = await database.selectFrom("learning_resource_revisions")
        .innerJoin("learning_resources", "learning_resources.id", "learning_resource_revisions.resource_id")
        .innerJoin("content_items", "content_items.id", "learning_resources.source_content_id")
        .select(["content_items.status", "learning_resources.retired_at"])
        .where("learning_resource_revisions.id", "=", manifest.resourceRevisionId)
        .where("learning_resources.source_content_id", "=", manifest.sourceContentId)
        .executeTakeFirst();
      if (!resource || resource.retired_at || resource.status !== "published") return { status: "resource_changed" };
      const asset = await database.selectFrom("content_assets")
        .select(["status", "storage_bucket", "storage_path"])
        .where("content_item_id", "=", manifest.sourceContentId)
        .where("kind", "=", "video").where("status", "=", "ready")
        .orderBy("created_at", "desc").executeTakeFirst();
      if (!asset) return { status: "resource_changed" };
      const lifetimeSeconds = 10 * 60;
      const downloadUrl = await createContentAssetDownloadUrl(
        asset,
        configuration.assetStorage,
        lifetimeSeconds,
      );
      return downloadUrl ? {
        status: "success",
        value: {
          downloadUrl,
          expiresAt: new Date(Date.now() + lifetimeSeconds * 1_000).toISOString(),
        },
      } : { status: "resource_changed" };
    },

    async getEnrollmentProgress(input) {
      const progress = await readLearningEnrollmentProgress(database, input.enrollmentId, input.userId);
      return progress ? { status: "success", value: progress } : { status: "not_found" };
    },

    async updateAttemptResume(input) {
      return database.transaction().execute((transaction) => withReceipt(transaction, {
        idempotencyKey: input.idempotencyKey,
        request: { attemptId: input.attemptId, operation: "resume", ...input.request },
        userId: input.userId,
      }, async () => {
        const acceptedAt = clock();
        const row = await lockedAttempt(transaction, input.attemptId, input.userId);
        if (!row) return { status: "not_found" };
        if (row.status !== "in_progress") return { status: "invalid_state" };
        if (row.row_version !== input.request.expectedVersion) return { status: "version_conflict" };
        const manifest = parseStoredAttemptManifest(row.manifest_json);
        if (manifest.projection === "review") return { status: "invalid_state" };
        const resume = LearningAttemptResumeSchema.parse(row.resume_json);
        if (input.request.kind === "guide") {
          if (manifest.projection !== "guide") return { status: "invalid_state" };
          const publicManifest = toPublicAttemptManifest(manifest);
          if (publicManifest.projection !== "guide" || input.request.sectionIndex >= publicManifest.sections.length) {
            return { status: "invalid_state" };
          }
          resume.guidePosition = {
            offsetPercent: input.request.offsetPercent,
            sectionIndex: input.request.sectionIndex,
          };
        } else {
          if (manifest.projection !== "video") return { status: "invalid_state" };
          const bounds = videoBounds(manifest);
          const publicManifest = toPublicAttemptManifest(manifest);
          if (!bounds || publicManifest.projection !== "video" ||
            input.request.positionSeconds > (publicManifest.durationSeconds ?? 0) ||
            input.request.observedRanges.some((range) => range.endSeconds - range.startSeconds > 30) ||
            input.request.observedRanges.reduce((sum, range) => sum + range.endSeconds - range.startSeconds, 0) > 45) {
            return { status: "invalid_state" };
          }
          resume.videoPositionSeconds = input.request.positionSeconds;
          resume.observedRanges = mergeRanges(resume.observedRanges, input.request.observedRanges, bounds);
          const rule = manifest.completionRule;
          if (rule.type === "video" && publicManifest.projection === "video" &&
            publicManifest.externalUrl === null &&
            videoCoverage(manifest, resume) >= rule.minimumCoveragePercent / 100) {
            const completed = await finishAttempt(transaction, row, manifest, resume, "observed", acceptedAt);
            return mutationResponse(transaction, completed.row, input.userId, null, completed.awards);
          }
        }
        const updated = await transaction.updateTable("learning_attempts").set({
          resume_json: resume as unknown as JsonValue,
          row_version: row.row_version + 1,
        }).where("id", "=", row.id).where("row_version", "=", row.row_version)
          .returningAll().executeTakeFirst();
        return updated ? mutationResponse(transaction, updated, input.userId) : { status: "version_conflict" };
      }));
    },

    async revealAttemptItem(input) {
      return database.transaction().execute((transaction) => withReceipt(transaction, {
        idempotencyKey: input.idempotencyKey,
        request: { attemptId: input.attemptId, expectedVersion: input.expectedVersion, itemId: input.itemId, operation: "reveal" },
        userId: input.userId,
      }, async () => {
        const row = await lockedAttempt(transaction, input.attemptId, input.userId);
        if (!row) return { status: "not_found" };
        if (row.status !== "in_progress") return { status: "invalid_state" };
        if (row.row_version !== input.expectedVersion) return { status: "version_conflict" };
        const manifest = parseStoredAttemptManifest(row.manifest_json);
        if (!(await available(transaction, manifest))) return { status: "resource_changed" };
        if (!manifestCard(manifest, input.itemId)) return { status: "not_found" };
        const resume = LearningAttemptResumeSchema.parse(row.resume_json);
        if (resume.revealedItemIds.includes(input.itemId)) return mutationResponse(transaction, row, input.userId);
        resume.revealedItemIds = [...resume.revealedItemIds, input.itemId];
        const updated = await transaction.updateTable("learning_attempts").set({
          resume_json: resume as unknown as JsonValue,
          row_version: row.row_version + 1,
        }).where("id", "=", row.id).where("row_version", "=", row.row_version)
          .returningAll().executeTakeFirst();
        return updated ? mutationResponse(transaction, updated, input.userId) : { status: "version_conflict" };
      }));
    },

    async recordAttemptResponse(input) {
      return database.transaction().execute((transaction) => withReceipt(transaction, {
        idempotencyKey: input.idempotencyKey,
        request: { attemptId: input.attemptId, operation: "response", ...input.request },
        userId: input.userId,
      }, async () => {
        const acceptedAt = clock();
        const row = await lockedAttempt(transaction, input.attemptId, input.userId);
        if (!row) return { status: "not_found" };
        if (row.status !== "in_progress") return { status: "invalid_state" };
        if (row.row_version !== input.request.expectedVersion) return { status: "version_conflict" };
        const manifest = parseStoredAttemptManifest(row.manifest_json);
        const isReview = manifest.projection === "review";
        if ((!isReview && input.request.round !== 1) || (isReview && input.request.round > 3)) {
          return { status: "invalid_state" };
        }
        if (!(await available(transaction, manifest))) return { status: "resource_changed" };
        const resume = LearningAttemptResumeSchema.parse(row.resume_json);
        const reviewItem = manifestReviewItem(manifest, input.request.itemId);
        if (isReview && (!reviewItem || reviewItem.kind !== input.request.kind ||
          input.request.expectedReviewVersion === undefined)) return { status: "invalid_state" };
        if (isReview && input.request.round === 1 &&
          input.request.expectedReviewVersion !== reviewItem?.reviewStateVersion) {
          return { status: "invalid_state" };
        }

        const existingResponse = await transaction.selectFrom("learning_responses")
          .select("id")
          .where("attempt_id", "=", row.id)
          .where("item_id", "=", input.request.itemId)
          .where("round", "=", input.request.round)
          .executeTakeFirst();
        if (existingResponse) return { status: "conflict" };
        if (isReview && input.request.round > 1) {
          const previous = await transaction.selectFrom("learning_responses")
            .select(["grading_json", "schedule_applied"])
            .where("attempt_id", "=", row.id)
            .where("item_id", "=", input.request.itemId)
            .where("round", "=", input.request.round - 1)
            .executeTakeFirst();
          const previousGrading = previous ? parseRecord(previous.grading_json) : {};
          const previousWasAgain = previousGrading.recallGrade === "again" || previousGrading.correct === false;
          if (!previous || !previous.schedule_applied || !previousWasAgain) return { status: "invalid_state" };
        }

        let answer: Record<string, unknown>;
        let grading: Record<string, unknown>;
        let grade: LearningRecallGrade;
        let memoryVersion: number;
        if (input.request.kind === "quiz") {
          const question = manifestQuestion(manifest, input.request.itemId);
          if (!question || (!isReview && manifest.projection !== "quiz")) return { status: "not_found" };
          const result = gradeQuizOption(question, input.request.optionId);
          if (!result) return { status: "invalid_state" };
          answer = { optionId: input.request.optionId };
          grading = { ...result, selectedOptionId: input.request.optionId };
          grade = result.correct ? "good" : "again";
          memoryVersion = question.memoryVersion ?? 1;
        } else {
          const card = manifestCard(manifest, input.request.itemId);
          if (!card || (!isReview && manifest.projection !== "flashcards")) return { status: "not_found" };
          if (!resume.revealedItemIds.includes(input.request.itemId)) return { status: "invalid_state" };
          answer = { recallGrade: input.request.recallGrade };
          grading = { recallGrade: input.request.recallGrade };
          grade = input.request.recallGrade;
          memoryVersion = card.memoryVersion ?? 1;
        }

        await transaction.insertInto("learning_review_states").values({
          item_id: input.request.itemId,
          last_reviewed_at: null,
          memory_version: memoryVersion,
          next_due_at: acceptedAt,
          user_id: input.userId,
        }).onConflict((conflict) => conflict.columns(["user_id", "item_id", "memory_version"]).doNothing())
          .execute();
        const currentReviewState = await transaction.selectFrom("learning_review_states")
          .selectAll()
          .where("user_id", "=", input.userId)
          .where("item_id", "=", input.request.itemId)
          .where("memory_version", "=", memoryVersion)
          .forUpdate()
          .executeTakeFirstOrThrow();
        if (currentReviewState.policy_version !== reviewSchedulerPolicyVersion) return { status: "conflict" };
        if (!(await available(transaction, manifest))) return { status: "resource_changed" };
        const reviewVersionMatches = !isReview ||
          input.request.expectedReviewVersion === currentReviewState.row_version;
        const isDue = new Date(currentReviewState.next_due_at).getTime() <= acceptedAt.getTime();
        const scheduleApplied = reviewVersionMatches &&
          (currentReviewState.last_reviewed_at === null || isDue || (isReview && input.request.round > 1));
        let nextReviewState = currentReviewState;
        if (scheduleApplied) {
          const scheduled = scheduleReview(
            currentReviewState,
            grade,
            acceptedAt,
            isReview ? input.request.round - 1 : 0,
          );
          nextReviewState = {
            ...currentReviewState,
            lapses: scheduled.lapses,
            last_reviewed_at: acceptedAt,
            next_due_at: scheduled.nextDueAt,
            row_version: currentReviewState.row_version + 1,
            stage: scheduled.stage,
          };
        }
        const reviewState = reviewStateSummary(nextReviewState);
        const sessionRetry = isReview && scheduleApplied && grade === "again" && input.request.round < 3;
        grading = { ...grading, reviewState, ...(isReview ? { sessionRetry } : {}) };
        const inserted = await transaction.insertInto("learning_responses").values({
          answer_json: answer as JsonValue,
          answered_at: acceptedAt,
          attempt_id: row.id,
          grading_json: grading as JsonValue,
          item_id: input.request.itemId,
          memory_version: memoryVersion,
          round: input.request.round,
          schedule_applied: scheduleApplied,
        }).onConflict((conflict) => conflict.columns(["attempt_id", "item_id", "round"]).doNothing())
          .returningAll().executeTakeFirst();
        if (!inserted) return { status: "conflict" };
        if (scheduleApplied) {
          const updatedState = await transaction.updateTable("learning_review_states").set({
            lapses: nextReviewState.lapses,
            last_reviewed_at: acceptedAt,
            next_due_at: nextReviewState.next_due_at,
            row_version: nextReviewState.row_version,
            stage: nextReviewState.stage,
          }).where("user_id", "=", input.userId)
            .where("item_id", "=", input.request.itemId)
            .where("memory_version", "=", memoryVersion)
            .where("row_version", "=", currentReviewState.row_version)
            .returning("row_version")
            .executeTakeFirst();
          if (!updatedState) throw new Error("Review state changed while locked");
        }
        const awards: LearningReward[] = [];
        if (isReview && scheduleApplied) {
          const reviewEvent = await transaction.insertInto("learning_events").values({
            attempt_id: row.id,
            enrollment_id: null,
            event_type: "review_applied",
            local_date: acceptedAt.toISOString().slice(0, 10),
            occurred_at: acceptedAt,
            payload_json: {
              itemId: input.request.itemId,
              memoryVersion,
              round: input.request.round,
            },
            semantic_key: `review_applied:${inserted.id}`,
            timezone: "UTC",
            user_id: input.userId,
          }).returning("id").executeTakeFirstOrThrow();
          if (input.request.round === 1) awards.push(...await awardAppliedReview(transaction, {
            acceptedAt,
            eventId: reviewEvent.id,
            itemId: input.request.itemId,
            memoryVersion,
            previousStateVersion: currentReviewState.row_version,
            userId: input.userId,
          }));
        }
        const answeredAt = toIso(inserted.answered_at);
        const feedback = {
          answer,
          answeredAt,
          grading,
          itemId: inserted.item_id,
          memoryVersion: inserted.memory_version,
          reviewState,
          round: inserted.round,
          scheduleApplied: inserted.schedule_applied,
        };
        const collection = input.request.kind === "quiz" ? resume.answeredItemIds : resume.ratedItemIds;
        if (!sessionRetry && !collection.includes(input.request.itemId)) collection.push(input.request.itemId);
        const required = manifestItemIds(manifest);
        const finalized = isReview
          ? new Set([...resume.answeredItemIds, ...resume.ratedItemIds])
          : new Set(collection);
        const completed = required.every((itemId) => finalized.has(itemId));
        resume.currentIndex = completed
          ? required.length
          : Math.max(0, required.findIndex((itemId) => !finalized.has(itemId)));
        if (completed) {
          if (isReview) {
            const next = await finishReviewAttempt(transaction, row, manifest, resume, acceptedAt);
            return mutationResponse(transaction, next, input.userId, feedback, awards);
          }
          const next = await finishAttempt(
              transaction,
              row,
              manifest,
              resume,
              input.request.kind === "quiz" ? "graded" : "rated",
              acceptedAt,
            );
          return mutationResponse(transaction, next.row, input.userId, feedback, [...awards, ...next.awards]);
        }
        const updated = await transaction.updateTable("learning_attempts").set({
          resume_json: resume as unknown as JsonValue,
          row_version: row.row_version + 1,
        }).where("id", "=", row.id).where("row_version", "=", row.row_version)
          .returningAll().executeTakeFirstOrThrow();
        return mutationResponse(transaction, updated, input.userId, feedback, awards);
      }));
    },

    async completeAttempt(input) {
      return database.transaction().execute((transaction) => withReceipt(transaction, {
        idempotencyKey: input.idempotencyKey,
        request: { attemptId: input.attemptId, operation: "complete", ...input.request },
        userId: input.userId,
      }, async () => {
        const acceptedAt = clock();
        const row = await lockedAttempt(transaction, input.attemptId, input.userId);
        if (!row) return { status: "not_found" };
        if (row.status !== "in_progress") return { status: "invalid_state" };
        if (row.row_version !== input.request.expectedVersion) return { status: "version_conflict" };
        const manifest = parseStoredAttemptManifest(row.manifest_json);
        if (manifest.projection === "review") return { status: "invalid_state" };
        if (!(await available(transaction, manifest))) return { status: "resource_changed" };
        const resume = LearningAttemptResumeSchema.parse(row.resume_json);
        let method: "graded" | "observed" | "rated" | "self_reported";
        if (manifest.projection === "quiz") {
          if (!manifestItemIds(manifest).every((itemId) => resume.answeredItemIds.includes(itemId))) {
            return { status: "invalid_state" };
          }
          method = "graded";
        } else if (manifest.projection === "flashcards") {
          if (!manifestItemIds(manifest).every((itemId) => resume.ratedItemIds.includes(itemId))) {
            return { status: "invalid_state" };
          }
          method = "rated";
        } else if (manifest.projection === "guide") {
          if (input.request.confirmation !== true) return { status: "invalid_state" };
          method = "self_reported";
        } else {
          const publicManifest = toPublicAttemptManifest(manifest);
          const rule = manifest.completionRule;
          if (publicManifest.projection !== "video" || rule.type !== "video") return { status: "invalid_state" };
          const requiresDeclaration = publicManifest.externalUrl !== null || publicManifest.durationSeconds === null;
          if (requiresDeclaration) {
            if (input.request.confirmation !== true) return { status: "invalid_state" };
            method = "self_reported";
          } else {
            if (videoCoverage(manifest, resume) < rule.minimumCoveragePercent / 100) {
              return { status: "invalid_state" };
            }
            method = "observed";
          }
        }
        const completed = await finishAttempt(transaction, row, manifest, resume, method, acceptedAt);
        return mutationResponse(transaction, completed.row, input.userId, null, completed.awards);
      }));
    },
  };
}
