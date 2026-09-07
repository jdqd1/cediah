import type { Selectable, Transaction } from "kysely";
import { z } from "zod";
import {
  LearningEnrollmentProgressSchema,
  LearningHomeSchema,
  LearningObjectiveSchema,
  LearningPreferencesSchema,
  LearningTaskOverrideResponseSchema,
  type GuidedLearningProvider,
  type LearningEnrollmentProgress,
  type LearningHome,
  type LearningHomeTask,
  type LearningPreferences,
} from "@cediah/contracts";
import type {
  CediahDatabase,
  DatabaseClient,
  JsonValue,
  LearningPreferenceTable,
} from "../db/database.js";
import { recomputeObjectiveEvidence } from "../guided-learning/learning-evidence.js";
import { withLearningReceipt } from "../guided-learning/mutation-receipt.js";
import {
  filterReviewCandidateOverrides,
  loadReviewCandidates,
  selectReviewCandidates,
} from "../guided-learning/review-candidates.js";
import {
  compareLearningTasks,
  recommendationPolicyVersion,
  stepTaskKey,
  type LearningTaskCandidate,
} from "../guided-learning/review-scheduler.js";
import { readLearningRewardSummary } from "../guided-learning/rewards.js";
import { readLearningEnrollmentProgress } from "./postgres-learning-activities.js";

type QueryDatabase = DatabaseClient | Transaction<CediahDatabase>;
type PreferenceRow = Selectable<LearningPreferenceTable>;
type InsightMethods = Pick<GuidedLearningProvider,
  | "getHome"
  | "getPreferences"
  | "updatePreferences"
  | "updateStepPreference"
  | "updateTaskOverride"
>;
type RankedTask = LearningHomeTask & LearningTaskCandidate;

const ObjectiveIdsSchema = z.array(z.string().uuid()).max(20);
const ObjectivesSchema = z.array(LearningObjectiveSchema).max(50);
const RecommendedAfterSchema = z.array(z.string().trim().min(1).max(120)).max(20);
const PendingConstancySchema = z.strictObject({
  effectiveOn: z.string().date(),
  timezone: z.string().trim().min(1).max(80),
  weeklyGoalDays: z.union([z.literal(2), z.literal(3), z.literal(5)]).nullable(),
});

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function isTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function localDate(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function nextLocalMonday(now: Date, timezone: string) {
  const today = localDate(now, timezone);
  const date = new Date(`${today}T00:00:00.000Z`);
  const days = date.getUTCDay() === 1 ? 7 : (8 - date.getUTCDay()) % 7;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parsePending(value: JsonValue) {
  const parsed = PendingConstancySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function defaultPreferences(): LearningPreferences {
  return LearningPreferencesSchema.parse({
    examDate: null,
    pendingConstancy: null,
    pinnedEnrollmentId: null,
    rowVersion: 0,
    sessionMinutes: 10,
    timezone: "UTC",
    weeklyGoalDays: null,
  });
}

function preferencesFromRow(row: PreferenceRow, now: Date): LearningPreferences {
  const pending = parsePending(row.pending_preferences_json);
  const effective = pending && pending.effectiveOn <= localDate(now, row.timezone);
  return LearningPreferencesSchema.parse({
    examDate: row.exam_date,
    pendingConstancy: effective ? null : pending,
    pinnedEnrollmentId: row.pinned_enrollment_id,
    rowVersion: row.row_version,
    sessionMinutes: row.session_minutes,
    timezone: effective ? pending.timezone : row.timezone,
    weeklyGoalDays: effective ? pending.weeklyGoalDays : row.weekly_goal_days,
  });
}

async function readPreferences(database: QueryDatabase, userId: string, now: Date) {
  const row = await database.selectFrom("learning_preferences").selectAll()
    .where("user_id", "=", userId).executeTakeFirst();
  return row ? preferencesFromRow(row, now) : defaultPreferences();
}

function daysUntil(examDate: string | null, currentLocalDate: string) {
  if (!examDate || examDate < currentLocalDate) return null;
  const exam = Date.parse(`${examDate}T00:00:00.000Z`);
  const current = Date.parse(`${currentLocalDate}T00:00:00.000Z`);
  return Math.round((exam - current) / 86_400_000);
}

function isHiddenOverride(
  override: { action: "snooze" | "dismiss" | "pin"; snoozed_until: Date | string | null } | undefined,
  now: Date,
) {
  return override?.action === "dismiss" || (override?.action === "snooze" &&
    override.snoozed_until !== null && asDate(override.snoozed_until).getTime() > now.getTime());
}

function publicTask(task: RankedTask): LearningHomeTask {
  return {
    band: task.band,
    dueAt: task.dueAt,
    enrollmentId: task.enrollmentId,
    estimatedMinutes: task.estimatedMinutes,
    href: task.href,
    importance: task.importance,
    itemCount: task.itemCount,
    key: task.key,
    kind: task.kind,
    reason: task.reason,
    taskKeys: task.taskKeys,
    title: task.title,
  };
}

export function createPostgresLearningInsightMethods(
  database: DatabaseClient,
  configuration: { clock?: () => Date } = {},
): InsightMethods {
  const clock = configuration.clock ?? (() => new Date());
  return {
    async getHome(input): Promise<LearningHome> {
      const now = clock();
      const preferences = await readPreferences(database, input.userId, now);
      const sessionMinutes = input.minutes ?? preferences.sessionMinutes;
      const enrollments = await database.selectFrom("learning_enrollments")
        .innerJoin("learning_paths", "learning_paths.id", "learning_enrollments.path_id")
        .innerJoin("learning_path_versions", "learning_path_versions.id", "learning_enrollments.path_version_id")
        .select([
          "learning_enrollments.id",
          "learning_enrollments.last_activity_at",
          "learning_enrollments.path_version_id",
          "learning_paths.slug",
          "learning_paths.title",
        ])
        .where("learning_enrollments.user_id", "=", input.userId)
        .where("learning_enrollments.status", "=", "active")
        .where("learning_paths.archived_at", "is", null)
        .where("learning_path_versions.status", "=", "published")
        .orderBy("learning_enrollments.last_activity_at", "desc")
        .orderBy("learning_enrollments.id", "asc")
        .limit(50)
        .execute();
      const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
      const versionIds = [...new Set(enrollments.map((enrollment) => enrollment.path_version_id))];
      const [steps, progressRows, attempts, overrideRows, rawReviews, eventRows, rewardSummary] = await Promise.all([
        versionIds.length > 0
          ? database.selectFrom("learning_path_steps")
            .innerJoin("learning_path_units", "learning_path_units.id", "learning_path_steps.unit_id")
            .leftJoin("learning_step_options", (join) => join
              .onRef("learning_step_options.step_id", "=", "learning_path_steps.id")
              .on("learning_step_options.is_default", "=", true))
            .leftJoin("learning_resource_revisions", "learning_resource_revisions.id", "learning_step_options.resource_revision_id")
            .leftJoin("learning_resources", "learning_resources.id", "learning_resource_revisions.resource_id")
            .leftJoin("content_items", "content_items.id", "learning_resources.source_content_id")
            .select([
              "learning_path_steps.id",
              "learning_path_steps.is_essential",
              "learning_path_steps.objective_ids_json",
              "learning_path_steps.path_version_id",
              "learning_path_steps.pedagogy_version",
              "learning_path_steps.position",
              "learning_path_steps.purpose",
              "learning_path_steps.recommended_after_json",
              "learning_path_steps.stable_key",
              "learning_path_steps.title",
              "learning_path_steps.unit_id",
              "learning_path_units.objectives_json",
              "learning_path_units.position as unit_position",
              "learning_step_options.estimated_minutes",
              "learning_step_options.id as option_id",
              "learning_resources.retired_at as option_retired_at",
              "content_items.status as option_source_status",
            ])
            .where("learning_path_steps.path_version_id", "in", versionIds)
            .orderBy("learning_path_units.position", "asc")
            .orderBy("learning_path_steps.position", "asc")
            .execute()
          : Promise.resolve([]),
        enrollmentIds.length > 0
          ? database.selectFrom("learning_step_progress").selectAll()
            .where("enrollment_id", "in", enrollmentIds).execute()
          : Promise.resolve([]),
        enrollmentIds.length > 0
          ? database.selectFrom("learning_attempts")
            .innerJoin("learning_step_options", "learning_step_options.id", "learning_attempts.step_option_id")
            .innerJoin("learning_resource_revisions", "learning_resource_revisions.id", "learning_step_options.resource_revision_id")
            .innerJoin("learning_resources", "learning_resources.id", "learning_resource_revisions.resource_id")
            .innerJoin("content_items", "content_items.id", "learning_resources.source_content_id")
            .select([
              "learning_attempts.enrollment_id as enrollment_id",
              "learning_attempts.id as id",
              "learning_attempts.step_id as step_id",
              "learning_attempts.step_option_id as step_option_id",
              "learning_attempts.updated_at as updated_at",
            ])
            .where("learning_attempts.enrollment_id", "in", enrollmentIds)
            .where("learning_attempts.status", "=", "in_progress")
            .where("learning_resources.retired_at", "is", null)
            .where("content_items.status", "=", "published")
            .orderBy("learning_attempts.updated_at", "desc")
            .execute()
          : Promise.resolve([]),
        database.selectFrom("learning_task_overrides").selectAll()
          .where("user_id", "=", input.userId).limit(2_000).execute(),
        loadReviewCandidates(database, { now, userId: input.userId }),
        database.selectFrom("learning_events").select(["event_type", "occurred_at"])
          .where("user_id", "=", input.userId)
          .where("occurred_at", ">=", new Date(now.getTime() - 14 * 86_400_000))
          .where("event_type", "in", ["step_completed", "review_applied"])
          .execute(),
        readLearningRewardSummary(database, input.userId),
      ]);
      const reviews = await filterReviewCandidateOverrides(database, {
        candidates: rawReviews,
        now,
        userId: input.userId,
      });
      const overrides = new Map(overrideRows.map((override) => [override.task_key, override]));
      const progressByEnrollmentStep = new Map(progressRows.map((progress) =>
        [`${progress.enrollment_id}:${progress.step_id}`, progress]));
      const tasks: RankedTask[] = [];
      const currentLocalDate = localDate(now, preferences.timezone);
      const examDays = daysUntil(preferences.examDate, currentLocalDate);

      if (reviews.length > 0) {
        const sessionLimit = sessionMinutes === 5 ? 5 : 10;
        const selectedKeys = selectReviewCandidates(reviews, sessionLimit)
          .map((candidate) => candidate.taskKey);
        const enrollmentSet = new Set(reviews.map((candidate) => candidate.enrollmentId));
        const importance = reviews.reduce<1 | 2 | 3>((value, candidate) =>
          Math.max(value, candidate.importance) as 1 | 2 | 3, 1);
        tasks.push({
          band: importance === 3 ? 0 : 1,
          dueAt: reviews[0]!.dueAt.toISOString(),
          dueAtMs: reviews[0]!.dueAt.getTime(),
          editorialPosition: 0,
          enrollmentId: enrollmentSet.size === 1 ? reviews[0]!.enrollmentId : null,
          estimatedMinutes: sessionMinutes,
          examDays,
          href: `/aprendizaje/repaso?minutos=${sessionMinutes}`,
          importance,
          itemCount: reviews.length,
          key: selectedKeys[0]!,
          kind: "review",
          pinnedPath: reviews.some((candidate) => candidate.enrollmentId === preferences.pinnedEnrollmentId),
          reason: importance === 3 ? "Repaso prioritario" : "Repaso recomendado",
          taskKeys: selectedKeys,
          title: `Repaso recomendado · ${sessionMinutes} min`,
        });
      }

      const latestAttemptByStep = new Map<string, typeof attempts[number]>();
      for (const attempt of attempts) {
        if (attempt.enrollment_id && attempt.step_id) {
          const key = `${attempt.enrollment_id}:${attempt.step_id}`;
          if (!latestAttemptByStep.has(key)) latestAttemptByStep.set(key, attempt);
        }
      }
      let pendingEssentialSteps = 0;
      const progressSummaries = new Map<string, Awaited<ReturnType<typeof readLearningEnrollmentProgress>>>();
      for (const enrollment of enrollments) {
        const progress = await readLearningEnrollmentProgress(database, enrollment.id, input.userId);
        progressSummaries.set(enrollment.id, progress);
        if (progress) pendingEssentialSteps += progress.totalEssentialSteps - progress.completedEssentialSteps;
        const routeSteps = steps.filter((step) => step.path_version_id === enrollment.path_version_id);
        const stepAvailable = (step: typeof routeSteps[number]) => Boolean(step.option_id &&
          !step.option_retired_at && step.option_source_status === "published");
        const completedKeys = new Set(routeSteps.filter((step) =>
          progressByEnrollmentStep.get(`${enrollment.id}:${step.id}`)?.state === "completed")
          .map((step) => step.stable_key));
        const remainingEssential = routeSteps.filter((step) => {
          const state = progressByEnrollmentStep.get(`${enrollment.id}:${step.id}`)?.state;
          return step.is_essential && state !== "completed" && state !== "skipped" && stepAvailable(step);
        });

        for (const step of routeSteps) {
          const attempt = latestAttemptByStep.get(`${enrollment.id}:${step.id}`);
          const state = progressByEnrollmentStep.get(`${enrollment.id}:${step.id}`)?.state;
          if (!attempt || !attempt.step_option_id || state === "skipped") continue;
          const key = stepTaskKey(enrollment.id, step.stable_key, step.pedagogy_version);
          const override = overrides.get(key);
          if (isHiddenOverride(override, now)) continue;
          tasks.push({
            band: 2,
            dueAt: null,
            dueAtMs: null,
            editorialPosition: step.unit_position * 1_000 + step.position,
            enrollmentId: enrollment.id,
            estimatedMinutes: step.estimated_minutes,
            examDays,
            href: `/aprendizaje/rutas/${enrollment.slug}/actividades/${step.id}?opcion=${attempt.step_option_id}`,
            importance: 2,
            itemCount: 1,
            key,
            kind: "resume",
            pinnedPath: enrollment.id === preferences.pinnedEnrollmentId || override?.action === "pin",
            reason: "Donde lo dejaste",
            taskKeys: [key],
            title: step.title,
          });
        }

        const preferred = remainingEssential.find((step) => {
          const recommended = RecommendedAfterSchema.safeParse(step.recommended_after_json);
          return !recommended.success || recommended.data.every((stableKey) => completedKeys.has(stableKey));
        });
        const next = preferred ?? remainingEssential[0];
        if (next?.option_id) {
          const key = stepTaskKey(enrollment.id, next.stable_key, next.pedagogy_version);
          const override = overrides.get(key);
          const alreadyResume = tasks.some((task) => task.key === key && task.kind === "resume");
          if (!alreadyResume && !isHiddenOverride(override, now)) {
            tasks.push({
              band: 3,
              dueAt: null,
              dueAtMs: null,
              editorialPosition: next.unit_position * 1_000 + next.position,
              enrollmentId: enrollment.id,
              estimatedMinutes: next.estimated_minutes,
              examDays,
              href: `/aprendizaje/rutas/${enrollment.slug}/actividades/${next.id}?opcion=${next.option_id}`,
              importance: 2,
              itemCount: 1,
              key,
              kind: "step",
              pinnedPath: enrollment.id === preferences.pinnedEnrollmentId || override?.action === "pin",
              reason: preferred ? "Siguiente paso" : "Siguiente paso · quizá convenga revisar la introducción",
              taskKeys: [key],
              title: next.title,
            });
          }
        }

        const optional = routeSteps.find((step) => {
          const state = progressByEnrollmentStep.get(`${enrollment.id}:${step.id}`)?.state;
          return !step.is_essential && state !== "completed" && state !== "skipped" && stepAvailable(step);
        });
        if (optional?.option_id) {
          const key = stepTaskKey(enrollment.id, optional.stable_key, optional.pedagogy_version);
          const override = overrides.get(key);
          if (!isHiddenOverride(override, now)) tasks.push({
            band: 4,
            dueAt: null,
            dueAtMs: null,
            editorialPosition: optional.unit_position * 1_000 + optional.position,
            enrollmentId: enrollment.id,
            estimatedMinutes: optional.estimated_minutes,
            examDays,
            href: `/aprendizaje/rutas/${enrollment.slug}/actividades/${optional.id}?opcion=${optional.option_id}`,
            importance: 1,
            itemCount: 1,
            key,
            kind: "explore",
            pinnedPath: enrollment.id === preferences.pinnedEnrollmentId || override?.action === "pin",
            reason: "Para profundizar",
            taskKeys: [key],
            title: optional.title,
          });
        }

        for (const unit of progress?.units ?? []) {
          const unitDefinition = routeSteps.find((step) => step.unit_id === unit.id)?.objectives_json;
          const definitions = ObjectivesSchema.safeParse(unitDefinition);
          for (const objective of unit.objectives) {
            if (objective.lastCheckPercent === null || objective.lastCheckPercent >= 60 ||
              !objective.lastAssessedAt || now.getTime() - Date.parse(objective.lastAssessedAt) < 20 * 60_000) continue;
            const definition = definitions.success
              ? definitions.data.find((entry) => entry.id === objective.id)
              : null;
            const reinforcementStep = routeSteps.find((step) => {
              const state = progressByEnrollmentStep.get(`${enrollment.id}:${step.id}`)?.state;
              const ids = ObjectiveIdsSchema.safeParse(step.objective_ids_json);
              return step.purpose !== "check" && state !== "skipped" && stepAvailable(step) &&
                ids.success && ids.data.includes(objective.id);
            });
            if (!reinforcementStep?.option_id) continue;
            const key = `reinforcement:${enrollment.id}:${objective.id}:${objective.lastAssessedAt}`;
            const override = overrides.get(key);
            if (isHiddenOverride(override, now)) continue;
            tasks.push({
              band: 0,
              dueAt: objective.lastAssessedAt,
              dueAtMs: Date.parse(objective.lastAssessedAt),
              editorialPosition: reinforcementStep.unit_position * 1_000 + reinforcementStep.position,
              enrollmentId: enrollment.id,
              estimatedMinutes: reinforcementStep.estimated_minutes,
              examDays,
              href: `/aprendizaje/rutas/${enrollment.slug}/actividades/${reinforcementStep.id}?opcion=${reinforcementStep.option_id}`,
              importance: (definition?.importance ?? 1) as 1 | 2 | 3,
              itemCount: 1,
              key,
              kind: "reinforcement",
              pinnedPath: enrollment.id === preferences.pinnedEnrollmentId || override?.action === "pin",
              reason: "Refuerza este punto",
              taskKeys: [key],
              title: `Refuerza: ${objective.title}`,
            });
          }
        }
      }

      const uniqueTasks = new Map<string, RankedTask>();
      for (const task of tasks) if (!uniqueTasks.has(task.key)) uniqueTasks.set(task.key, task);
      const ordered = [...uniqueTasks.values()]
        .sort((left, right) => compareLearningTasks(left, right, sessionMinutes))
        .slice(0, 20);
      const activeEnrollment = enrollments.find((enrollment) => enrollment.id === preferences.pinnedEnrollmentId)
        ?? enrollments[0]
        ?? null;
      const activeProgress = activeEnrollment ? progressSummaries.get(activeEnrollment.id) ?? null : null;
      const continueTask = activeEnrollment
        ? ordered.find((task) => task.enrollmentId === activeEnrollment.id)
        : null;
      const today = new Date(`${currentLocalDate}T00:00:00.000Z`);
      const day = today.getUTCDay();
      today.setUTCDate(today.getUTCDate() - (day === 0 ? 6 : day - 1));
      const weekStart = today.toISOString().slice(0, 10);
      const activeDays = new Set(eventRows.map((event) => localDate(asDate(event.occurred_at), preferences.timezone))
        .filter((date) => date >= weekStart && date <= currentLocalDate));
      return LearningHomeSchema.parse({
        activePath: activeEnrollment && activeProgress && activeProgress.totalEssentialSteps > 0 ? {
          completedSteps: activeProgress.completedEssentialSteps,
          continueHref: continueTask?.href ?? `/aprendizaje/rutas/${activeEnrollment.slug}`,
          enrollmentId: activeEnrollment.id,
          progressPercent: activeProgress.percentage,
          title: activeEnrollment.title,
          totalSteps: activeProgress.totalEssentialSteps,
        } : null,
        constancy: {
          activeDaysThisWeek: activeDays.size,
          weeklyGoalDays: preferences.weeklyGoalDays,
        },
        counts: {
          activePaths: enrollments.length,
          dueReviews: reviews.length,
          pendingEssentialSteps,
        },
        generatedAt: now.toISOString(),
        milestones: rewardSummary.milestones,
        points: rewardSummary.points,
        policyVersion: recommendationPolicyVersion,
        preferences,
        tasks: ordered.map(publicTask),
      });
    },

    getPreferences(input) {
      return readPreferences(database, input.userId, clock());
    },

    async updatePreferences(input) {
      return database.transaction().execute((transaction) => withLearningReceipt<LearningPreferences>(transaction, {
        idempotencyKey: input.idempotencyKey,
        request: { operation: "update_preferences", ...input.request },
        responseSchema: LearningPreferencesSchema,
        userId: input.userId,
      }, async () => {
        const now = clock();
        const row = await transaction.selectFrom("learning_preferences").selectAll()
          .where("user_id", "=", input.userId).forUpdate().executeTakeFirst();
        if ((row?.row_version ?? 0) !== input.request.expectedVersion) return { status: "version_conflict" };
        if (input.request.timezone !== undefined && !isTimezone(input.request.timezone)) {
          return { status: "invalid_state" };
        }
        if (input.request.pinnedEnrollmentId) {
          const enrollment = await transaction.selectFrom("learning_enrollments").select("id")
            .where("id", "=", input.request.pinnedEnrollmentId)
            .where("user_id", "=", input.userId)
            .where("status", "=", "active")
            .executeTakeFirst();
          if (!enrollment) return { status: "not_found" };
        }
        const current = row ? preferencesFromRow(row, now) : defaultPreferences();
        const existingPending = row ? parsePending(row.pending_preferences_json) : null;
        const pendingStillFuture = existingPending && existingPending.effectiveOn > localDate(now, row?.timezone ?? "UTC")
          ? existingPending
          : null;
        const constancyChanged = input.request.timezone !== undefined ||
          Object.prototype.hasOwnProperty.call(input.request, "weeklyGoalDays");
        const targetTimezone = input.request.timezone ?? pendingStillFuture?.timezone ?? current.timezone;
        const targetGoal = Object.prototype.hasOwnProperty.call(input.request, "weeklyGoalDays")
          ? input.request.weeklyGoalDays ?? null
          : pendingStillFuture?.weeklyGoalDays ?? current.weeklyGoalDays;
        const pending = constancyChanged ? {
          effectiveOn: nextLocalMonday(now, current.timezone),
          timezone: targetTimezone,
          weeklyGoalDays: targetGoal,
        } : pendingStillFuture;
        let saved: PreferenceRow;
        if (!row) {
          saved = await transaction.insertInto("learning_preferences").values({
            exam_date: input.request.examDate ?? null,
            pending_preferences_json: (pending ?? {}) as JsonValue,
            pinned_enrollment_id: input.request.pinnedEnrollmentId ?? null,
            session_minutes: input.request.sessionMinutes ?? 10,
            timezone: "UTC",
            user_id: input.userId,
            weekly_goal_days: null,
          }).returningAll().executeTakeFirstOrThrow();
        } else {
          saved = await transaction.updateTable("learning_preferences").set({
            exam_date: input.request.examDate === undefined ? row.exam_date : input.request.examDate,
            pending_preferences_json: (pending ?? {}) as JsonValue,
            pinned_enrollment_id: input.request.pinnedEnrollmentId === undefined
              ? row.pinned_enrollment_id
              : input.request.pinnedEnrollmentId,
            row_version: row.row_version + 1,
            session_minutes: input.request.sessionMinutes ?? row.session_minutes,
            timezone: current.timezone,
            weekly_goal_days: current.weeklyGoalDays,
          }).where("user_id", "=", input.userId)
            .where("row_version", "=", row.row_version)
            .returningAll().executeTakeFirstOrThrow();
        }
        return { status: "success", value: preferencesFromRow(saved, now) };
      }));
    },

    async updateStepPreference(input) {
      return database.transaction().execute((transaction) => withLearningReceipt<LearningEnrollmentProgress>(transaction, {
        idempotencyKey: input.idempotencyKey,
        request: { operation: "update_step_preference", stepId: input.stepId, ...input.request },
        responseSchema: LearningEnrollmentProgressSchema,
        userId: input.userId,
      }, async () => {
        const enrollment = await transaction.selectFrom("learning_enrollments")
          .select(["id", "path_version_id"])
          .where("id", "=", input.request.enrollmentId)
          .where("user_id", "=", input.userId)
          .forUpdate()
          .executeTakeFirst();
        if (!enrollment) return { status: "not_found" };
        const step = await transaction.selectFrom("learning_path_steps").select("id")
          .where("id", "=", input.stepId)
          .where("path_version_id", "=", enrollment.path_version_id)
          .executeTakeFirst();
        if (!step) return { status: "not_found" };
        const current = await transaction.selectFrom("learning_step_progress").selectAll()
          .where("enrollment_id", "=", enrollment.id)
          .where("step_id", "=", input.stepId)
          .forUpdate()
          .executeTakeFirst();
        if ((current?.row_version ?? 0) !== input.request.expectedVersion) {
          return { status: "version_conflict" };
        }
        if (current?.state === "completed") return { status: "invalid_state" };
        if (!current) {
          if (input.request.action !== "skip") return { status: "invalid_state" };
          await transaction.insertInto("learning_step_progress").values({
            completed_at: null,
            completion_method: null,
            enrollment_id: enrollment.id,
            evidence_attempt_id: null,
            path_version_id: enrollment.path_version_id,
            state: "skipped",
            step_id: input.stepId,
          }).execute();
        } else if (input.request.action === "skip" && current.state !== "skipped") {
          await transaction.updateTable("learning_step_progress").set({
            completed_at: null,
            completion_method: null,
            evidence_attempt_id: null,
            row_version: current.row_version + 1,
            state: "skipped",
          }).where("enrollment_id", "=", enrollment.id)
            .where("step_id", "=", input.stepId)
            .where("row_version", "=", current.row_version)
            .executeTakeFirstOrThrow();
        } else if (input.request.action === "unskip" && current.state === "skipped") {
          await transaction.updateTable("learning_step_progress").set({
            completed_at: null,
            completion_method: null,
            evidence_attempt_id: null,
            row_version: current.row_version + 1,
            state: "not_started",
          }).where("enrollment_id", "=", enrollment.id)
            .where("step_id", "=", input.stepId)
            .where("row_version", "=", current.row_version)
            .executeTakeFirstOrThrow();
        } else {
          return { status: "invalid_state" };
        }
        const progress = await readLearningEnrollmentProgress(transaction, enrollment.id, input.userId);
        return progress ? { status: "success", value: progress } : { status: "not_found" };
      }));
    },

    async updateTaskOverride(input) {
      return database.transaction().execute((transaction) => withLearningReceipt<{ saved: true }>(transaction, {
        idempotencyKey: input.idempotencyKey,
        request: { operation: "update_task_override", ...input.request },
        responseSchema: LearningTaskOverrideResponseSchema,
        userId: input.userId,
      }, async () => {
        const now = clock();
        const snoozedUntil = input.request.snoozedUntil
          ? new Date(input.request.snoozedUntil)
          : null;
        if (input.request.action === "snooze" &&
          (!snoozedUntil || snoozedUntil.getTime() <= now.getTime())) return { status: "invalid_state" };
        for (const taskKey of [...input.request.taskKeys].sort()) {
          await transaction.insertInto("learning_task_overrides").values({
            action: input.request.action,
            enrollment_id: null,
            snoozed_until: snoozedUntil,
            task_key: taskKey,
            user_id: input.userId,
          }).onConflict((conflict) => conflict.columns(["user_id", "task_key"]).doUpdateSet({
            action: input.request.action,
            snoozed_until: snoozedUntil,
          })).execute();
        }
        return { status: "success", value: { saved: true as const } };
      }));
    },
  };
}

export async function initializeEnrollmentEvidence(
  transaction: Transaction<CediahDatabase>,
  input: { enrollmentId: string; now: Date; pathVersionId: string; userId: string },
) {
  await recomputeObjectiveEvidence(transaction, input);
}
