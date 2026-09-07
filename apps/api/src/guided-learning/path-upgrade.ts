import { z } from "zod";
import type { Transaction } from "kysely";
import {
  LearningEnrollmentUpgradePreviewSchema,
  LearningEnrollmentVersionHistorySchema,
  LearningObjectiveSchema,
  type LearningEnrollmentUpgradePreview,
  type LearningEnrollmentVersionHistory,
} from "@cediah/contracts";
import type { CediahDatabase, DatabaseClient } from "../db/database.js";

type QueryDatabase = DatabaseClient | Transaction<CediahDatabase>;

const ObjectiveIdsSchema = z.array(z.string().uuid());

type StoredProgress = {
  completedAt: Date | string;
  completionMethod: "graded" | "observed" | "rated" | "self_reported";
  evidenceAttemptId: string | null;
  rowVersion: number;
  sourceStepId: string;
  targetStepId: string;
};

type ObjectiveTransfer = {
  objectiveId: string;
};

type VersionSteps = Awaited<ReturnType<typeof readVersionSteps>>;

export type LearningEnrollmentUpgradePlan = {
  currentPathVersionId: string;
  enrollment: {
    completedAt: Date | string | null;
    id: string;
    pathId: string;
    rowVersion: number;
    status: "active" | "paused" | "archived";
  };
  history: LearningEnrollmentVersionHistory[];
  objectiveTransfers: ObjectiveTransfer[];
  pathSlug: string;
  preview: LearningEnrollmentUpgradePreview;
  progressTransfers: StoredProgress[];
  targetPathVersionId: string;
};

export type LearningEnrollmentUpgradePlanningResult =
  | { history: LearningEnrollmentVersionHistory[]; plan: null; status: "success" }
  | { plan: LearningEnrollmentUpgradePlan; status: "success" }
  | { status: "conflict" | "not_found" };

function toIso(value: Date | string) {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function percentage(completed: number, total: number) {
  if (total === 0) return 0;
  return completed === total ? 100 : Math.min(99, Math.round((completed / total) * 100));
}

function sameStrings(left: string[], right: string[]) {
  const first = [...left].sort();
  const second = [...right].sort();
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

async function readHistory(database: QueryDatabase, enrollmentId: string) {
  const rows = await database.selectFrom("learning_enrollment_versions")
    .innerJoin(
      "learning_path_versions",
      "learning_path_versions.id",
      "learning_enrollment_versions.path_version_id",
    )
    .select([
      "learning_enrollment_versions.adopted_at",
      "learning_enrollment_versions.path_version_id",
      "learning_enrollment_versions.previous_version_id",
      "learning_path_versions.version_number",
    ])
    .where("learning_enrollment_versions.enrollment_id", "=", enrollmentId)
    .orderBy("learning_enrollment_versions.adopted_at", "asc")
    .orderBy("learning_path_versions.version_number", "asc")
    .execute();
  return rows.map((row) => LearningEnrollmentVersionHistorySchema.parse({
    adoptedAt: toIso(row.adopted_at),
    pathVersionId: row.path_version_id,
    previousVersionId: row.previous_version_id,
    versionNumber: row.version_number,
  }));
}

async function readVersionSteps(
  database: QueryDatabase,
  pathVersionId: string,
  enrollmentId: string,
) {
  const [units, steps, options, progress] = await Promise.all([
    database.selectFrom("learning_path_units")
      .select(["id", "objectives_json", "pedagogy_version", "stable_key"])
      .where("path_version_id", "=", pathVersionId)
      .execute(),
    database.selectFrom("learning_path_steps")
      .select([
        "id",
        "is_essential",
        "objective_ids_json",
        "pedagogy_version",
        "position",
        "purpose",
        "stable_key",
        "title",
        "unit_id",
      ])
      .where("path_version_id", "=", pathVersionId)
      .orderBy("position", "asc")
      .execute(),
    database.selectFrom("learning_step_options")
      .select(["projection", "reward_identity", "reward_version", "step_id"])
      .where("path_version_id", "=", pathVersionId)
      .execute(),
    database.selectFrom("learning_step_progress")
      .selectAll()
      .where("enrollment_id", "=", enrollmentId)
      .where("path_version_id", "=", pathVersionId)
      .execute(),
  ]);
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const optionsByStep = new Map<string, string[]>();
  for (const option of options) {
    const signature = `${option.projection}:${option.reward_identity}:${option.reward_version}`;
    optionsByStep.set(option.step_id, [...(optionsByStep.get(option.step_id) ?? []), signature]);
  }
  const progressByStep = new Map(progress.map((entry) => [entry.step_id, entry]));
  return {
    objectives: units.flatMap((unit) => {
      const parsed = z.array(LearningObjectiveSchema).safeParse(unit.objectives_json);
      return (parsed.success ? parsed.data : []).map((objective) => ({
        id: objective.id,
        unitPedagogyVersion: unit.pedagogy_version,
        unitStableKey: unit.stable_key,
      }));
    }),
    steps: steps.map((step) => {
      const unit = unitById.get(step.unit_id);
      const objectiveIds = ObjectiveIdsSchema.safeParse(step.objective_ids_json);
      return {
        id: step.id,
        isEssential: step.is_essential,
        objectiveIds: objectiveIds.success ? objectiveIds.data : [],
        optionSignatures: optionsByStep.get(step.id) ?? [],
        pedagogyVersion: step.pedagogy_version,
        position: step.position,
        progress: progressByStep.get(step.id) ?? null,
        purpose: step.purpose,
        stableKey: step.stable_key,
        title: step.title,
        unitPedagogyVersion: unit?.pedagogy_version ?? -1,
        unitStableKey: unit?.stable_key ?? "",
      };
    }),
  };
}

function equivalentSteps(
  current: VersionSteps["steps"][number],
  target: VersionSteps["steps"][number],
) {
  return current.stableKey === target.stableKey
    && current.pedagogyVersion === target.pedagogyVersion
    && current.unitStableKey === target.unitStableKey
    && current.unitPedagogyVersion === target.unitPedagogyVersion
    && current.purpose === target.purpose
    && current.isEssential === target.isEssential
    && sameStrings(current.objectiveIds, target.objectiveIds)
    && sameStrings(current.optionSignatures, target.optionSignatures);
}

export async function planLearningEnrollmentUpgrade(
  database: QueryDatabase,
  input: {
    enrollmentId: string;
    targetPathVersionId?: string;
    userId: string;
  },
): Promise<LearningEnrollmentUpgradePlanningResult> {
  const enrollment = await database.selectFrom("learning_enrollments")
    .innerJoin("learning_paths", "learning_paths.id", "learning_enrollments.path_id")
    .innerJoin(
      "learning_path_versions as current_version",
      "current_version.id",
      "learning_enrollments.path_version_id",
    )
    .select([
      "learning_enrollments.completed_at",
      "learning_enrollments.id",
      "learning_enrollments.path_id",
      "learning_enrollments.path_version_id",
      "learning_enrollments.row_version",
      "learning_enrollments.status",
      "learning_paths.archived_at",
      "learning_paths.published_version_id",
      "learning_paths.slug",
      "current_version.created_at as current_created_at",
      "current_version.published_at as current_published_at",
      "current_version.release_notes as current_release_notes",
      "current_version.version_number as current_version_number",
    ])
    .where("learning_enrollments.id", "=", input.enrollmentId)
    .where("learning_enrollments.user_id", "=", input.userId)
    .executeTakeFirst();
  if (!enrollment) return { status: "not_found" };

  const history = await readHistory(database, enrollment.id);
  const targetId = input.targetPathVersionId ?? enrollment.published_version_id;
  if (!targetId || targetId === enrollment.path_version_id || enrollment.archived_at) {
    return input.targetPathVersionId
      ? { status: "conflict" }
      : { history, plan: null, status: "success" };
  }

  const target = await database.selectFrom("learning_path_versions")
    .select(["created_at", "id", "published_at", "release_notes", "status", "version_number"])
    .where("id", "=", targetId)
    .where("path_id", "=", enrollment.path_id)
    .executeTakeFirst();
  if (
    !target
    || target.status !== "published"
    || !target.published_at
    || target.version_number <= enrollment.current_version_number
  ) return { status: "conflict" };

  const [current, next, activeAttempt] = await Promise.all([
    readVersionSteps(database, enrollment.path_version_id, enrollment.id),
    readVersionSteps(database, target.id, enrollment.id),
    database.selectFrom("learning_attempts")
      .innerJoin("learning_path_steps", "learning_path_steps.id", "learning_attempts.step_id")
      .select(["learning_attempts.id", "learning_path_steps.title"])
      .where("learning_attempts.enrollment_id", "=", enrollment.id)
      .where("learning_attempts.path_version_id", "=", enrollment.path_version_id)
      .where("learning_attempts.status", "=", "in_progress")
      .orderBy("learning_attempts.updated_at", "desc")
      .executeTakeFirst(),
  ]);

  const currentByKey = new Map(current.steps.map((step) => [step.stableKey, step]));
  const targetKeys = new Set(next.steps.map((step) => step.stableKey));
  const progressTransfers: StoredProgress[] = [];
  const targetChanges = next.steps.map((step) => {
    const previous = currentByKey.get(step.stableKey);
    const equivalent = previous ? equivalentSteps(previous, step) : false;
    const completed = previous?.progress?.state === "completed";
    if (previous && equivalent && completed && previous.progress?.completed_at && previous.progress.completion_method) {
      progressTransfers.push({
        completedAt: previous.progress.completed_at,
        completionMethod: previous.progress.completion_method,
        evidenceAttemptId: previous.progress.evidence_attempt_id,
        rowVersion: previous.progress.row_version,
        sourceStepId: previous.id,
        targetStepId: step.id,
      });
    }
    return {
      completed,
      currentStepId: previous?.id ?? null,
      kind: previous ? equivalent ? "equivalent" as const : "changed" as const : "added" as const,
      stableKey: step.stableKey,
      targetStepId: step.id,
      title: step.title,
      transferable: Boolean(equivalent && completed),
    };
  });
  const removed = current.steps.filter((step) => !targetKeys.has(step.stableKey)).map((step) => ({
    completed: step.progress?.state === "completed",
    currentStepId: step.id,
    kind: "removed" as const,
    stableKey: step.stableKey,
    targetStepId: null,
    title: step.title,
    transferable: false,
  }));

  const currentObjectiveKeys = new Set(current.objectives.map((objective) => (
    `${objective.unitStableKey}:${objective.unitPedagogyVersion}:${objective.id}`
  )));
  const objectiveTransfers = next.objectives.filter((objective) => currentObjectiveKeys.has(
    `${objective.unitStableKey}:${objective.unitPedagogyVersion}:${objective.id}`,
  )).map((objective) => ({ objectiveId: objective.id }));

  const currentEssential = current.steps.filter((step) => step.isEssential);
  const nextEssential = next.steps.filter((step) => step.isEssential);
  const completedCurrent = currentEssential.filter((step) => step.progress?.state === "completed").length;
  const completedTarget = nextEssential.filter((step) => progressTransfers.some(
    (transfer) => transfer.targetStepId === step.id,
  )).length;
  const preview = LearningEnrollmentUpgradePreviewSchema.parse({
    activeAttempt: activeAttempt ? {
      attemptId: activeAttempt.id,
      href: `/aprendizaje/sesiones/${activeAttempt.id}`,
      title: activeAttempt.title,
    } : null,
    currentProgress: {
      completedEssentialSteps: completedCurrent,
      percentage: percentage(completedCurrent, currentEssential.length),
      totalEssentialSteps: currentEssential.length,
    },
    currentVersion: {
      id: enrollment.path_version_id,
      number: enrollment.current_version_number,
      publishedAt: toIso(enrollment.current_published_at ?? enrollment.current_created_at),
      releaseNotes: enrollment.current_release_notes,
    },
    projectedProgress: {
      completedEssentialSteps: completedTarget,
      percentage: percentage(completedTarget, nextEssential.length),
      totalEssentialSteps: nextEssential.length,
    },
    steps: [...targetChanges, ...removed],
    summary: {
      added: targetChanges.filter((step) => step.kind === "added").length,
      changed: targetChanges.filter((step) => step.kind === "changed").length,
      removed: removed.length,
      transferableCompleted: progressTransfers.length,
    },
    targetVersion: {
      id: target.id,
      number: target.version_number,
      publishedAt: toIso(target.published_at),
      releaseNotes: target.release_notes,
    },
  });

  return {
    plan: {
      currentPathVersionId: enrollment.path_version_id,
      enrollment: {
        completedAt: enrollment.completed_at,
        id: enrollment.id,
        pathId: enrollment.path_id,
        rowVersion: enrollment.row_version,
        status: enrollment.status,
      },
      history,
      objectiveTransfers,
      pathSlug: enrollment.slug,
      preview,
      progressTransfers,
      targetPathVersionId: target.id,
    },
    status: "success",
  };
}
