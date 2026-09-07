import { z } from "zod";
import {
  LearningObjectiveSchema,
  LearningOptionConfigSchema,
} from "@cediah/contracts";
import type { Transaction } from "kysely";
import type { CediahDatabase, DatabaseClient, JsonValue } from "../db/database.js";
import { flashcardAdapter, type ExecutableCard } from "./adapters/flashcards.js";
import { quizAdapter, type ExecutableQuestion } from "./adapters/quiz.js";
import type { StoredReviewItem } from "./attempt-manifest.js";
import { reviewTaskKey } from "./review-scheduler.js";
import { hashLearningSnapshot } from "./snapshot-hash.js";

const RevisionSnapshotSchema = z.strictObject({
  content: z.unknown(),
  projection: z.enum(["quiz", "flashcards"]),
  sourceContentId: z.string().uuid(),
  sourceVersion: z.number().int().positive(),
  title: z.string().trim().min(1).max(500),
});
const ObjectiveIdsSchema = z.array(z.string().uuid()).max(20);

export type ReviewCandidate = {
  dueAt: Date;
  enrollmentId: string;
  evidenceEnrollmentIds: string[];
  importance: 1 | 2 | 3;
  item: ExecutableCard | ExecutableQuestion;
  itemId: string;
  kind: "flashcards" | "quiz";
  lapses: number;
  memoryVersion: number;
  objectiveIds: string[];
  pathSlug: string;
  pathTitle: string;
  payloadHash: string;
  resourceRevisionId: string;
  reviewStateVersion: number;
  sourceContentId: string;
  stage: number;
  taskKey: string;
  unitId: string;
};

type QueryDatabase = DatabaseClient | Transaction<CediahDatabase>;

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function objectiveImportance(value: JsonValue, objectiveIds: string[]): 1 | 2 | 3 {
  const parsed = z.array(LearningObjectiveSchema).safeParse(value);
  if (!parsed.success) return 1;
  const wanted = new Set(objectiveIds);
  return parsed.data.reduce<1 | 2 | 3>((importance, objective) =>
    wanted.has(objective.id) ? Math.max(importance, objective.importance) as 1 | 2 | 3 : importance, 1);
}

export async function loadReviewCandidates(
  database: QueryDatabase,
  input: { enrollmentId?: string; now: Date; userId: string },
) {
  const states = await database.selectFrom("learning_review_states")
    .selectAll()
    .where("user_id", "=", input.userId)
    .where("next_due_at", "<=", input.now)
    .orderBy("next_due_at", "asc")
    .orderBy("item_id", "asc")
    .limit(500)
    .execute();
  if (states.length === 0) return [];
  const options = await database.selectFrom("learning_step_options")
    .innerJoin("learning_path_steps", "learning_path_steps.id", "learning_step_options.step_id")
    .innerJoin("learning_path_units", "learning_path_units.id", "learning_path_steps.unit_id")
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
      "learning_enrollments.id as enrollment_id",
      "learning_path_steps.objective_ids_json",
      "learning_path_steps.position as step_position",
      "learning_path_units.objectives_json",
      "learning_path_units.id as unit_id",
      "learning_path_units.position as unit_position",
      "learning_step_options.config_json",
      "learning_step_options.id as option_id",
      "learning_step_options.projection",
      "learning_step_options.resource_revision_id",
      "learning_step_options.source_content_id",
      "learning_resource_revisions.payload_hash",
      "learning_resource_revisions.payload_json",
      "learning_paths.slug as path_slug",
      "learning_paths.title as path_title",
    ])
    .where("learning_enrollments.status", "=", "active")
    .$if(Boolean(input.enrollmentId), (query) => query.where("learning_enrollments.id", "=", input.enrollmentId!))
    .where("learning_path_versions.status", "=", "published")
    .where("learning_paths.archived_at", "is", null)
    .where("learning_resources.retired_at", "is", null)
    .where("content_items.status", "=", "published")
    .where("learning_step_options.projection", "in", ["quiz", "flashcards"])
    .orderBy("learning_path_units.position", "asc")
    .orderBy("learning_path_steps.position", "asc")
    .orderBy("learning_step_options.position", "asc")
    .limit(2_000)
    .execute();

  const candidates: ReviewCandidate[] = [];
  for (const option of options) {
    const config = LearningOptionConfigSchema.safeParse(option.config_json);
    const snapshot = RevisionSnapshotSchema.safeParse(option.payload_json);
    if (!config.success || !snapshot.success || hashLearningSnapshot(option.payload_json) !== option.payload_hash ||
      snapshot.data.projection !== option.projection ||
      snapshot.data.sourceContentId !== option.source_content_id) continue;
    const mappedObjectives = new Map(config.data.objectiveMappings.map((mapping) => [mapping.itemId, mapping.objectiveIds]));
    const stepObjectives = ObjectiveIdsSchema.safeParse(option.objective_ids_json);
    const selected = config.data.selectedItemIds.length > 0 ? new Set(config.data.selectedItemIds) : null;
    let questions: ExecutableQuestion[] = [];
    let cards: ExecutableCard[] = [];
    try {
      questions = option.projection === "quiz" ? quizAdapter.parse(snapshot.data.content).questions : [];
      cards = option.projection === "flashcards" ? flashcardAdapter.parse(snapshot.data.content).cards : [];
    } catch {
      continue;
    }
    for (const state of states) {
      const item = option.projection === "quiz"
        ? questions.find((question) => question.id === state.item_id)
        : cards.find((card) => card.id === state.item_id);
      if (selected && !selected.has(state.item_id)) continue;
      if (!item || (item.memoryVersion ?? 1) !== state.memory_version) continue;
      const objectiveIds = mappedObjectives.get(state.item_id) ?? (stepObjectives.success ? stepObjectives.data : []);
      candidates.push({
        dueAt: asDate(state.next_due_at),
        enrollmentId: option.enrollment_id,
        evidenceEnrollmentIds: [option.enrollment_id],
        importance: objectiveImportance(option.objectives_json, objectiveIds),
        item,
        itemId: state.item_id,
        kind: option.projection,
        lapses: state.lapses,
        memoryVersion: state.memory_version,
        objectiveIds,
        pathSlug: option.path_slug,
        pathTitle: option.path_title,
        payloadHash: option.payload_hash,
        resourceRevisionId: option.resource_revision_id,
        reviewStateVersion: state.row_version,
        sourceContentId: option.source_content_id,
        stage: state.stage,
        taskKey: reviewTaskKey(state.item_id, state.memory_version, state.row_version),
        unitId: option.unit_id,
      });
    }
  }
  const ordered = candidates.sort((left, right) =>
    right.importance - left.importance
    || left.dueAt.getTime() - right.dueAt.getTime()
    || left.pathSlug.localeCompare(right.pathSlug)
    || left.itemId.localeCompare(right.itemId)
    || left.kind.localeCompare(right.kind));
  const grouped = new Map<string, ReviewCandidate[]>();
  for (const candidate of ordered) {
    const key = `${candidate.itemId}:${candidate.memoryVersion}`;
    const group = grouped.get(key) ?? [];
    group.push(candidate);
    grouped.set(key, group);
  }
  const unique: ReviewCandidate[] = [];
  let previousKind: ReviewCandidate["kind"] | null = null;
  for (const group of grouped.values()) {
    const candidate = group.find((entry) => entry.kind !== previousKind) ?? group[0];
    if (!candidate) continue;
    unique.push({
      ...candidate,
      evidenceEnrollmentIds: [...new Set(group.map((entry) => entry.enrollmentId))].sort(),
    });
    previousKind = candidate.kind;
  }
  return unique;
}

export async function filterReviewCandidateOverrides(
  database: QueryDatabase,
  input: { candidates: ReviewCandidate[]; now: Date; userId: string },
) {
  if (input.candidates.length === 0) return [];
  const keys = input.candidates.map((candidate) => candidate.taskKey);
  const overrides = await database.selectFrom("learning_task_overrides")
    .select(["action", "snoozed_until", "task_key"])
    .where("user_id", "=", input.userId)
    .where("task_key", "in", keys)
    .execute();
  const hidden = new Set(overrides.filter((override) => override.action === "dismiss" ||
    (override.action === "snooze" && override.snoozed_until &&
      asDate(override.snoozed_until).getTime() > input.now.getTime()))
    .map((override) => override.task_key));
  return input.candidates.filter((candidate) => !hidden.has(candidate.taskKey));
}

/** Keeps priority groups stable while avoiding a single unit monopolising a mixed session. */
export function selectReviewCandidates(candidates: ReviewCandidate[], limit: number) {
  const selected: ReviewCandidate[] = [];
  for (const importance of [3, 2, 1] as const) {
    const remaining = candidates.filter((candidate) => candidate.importance === importance);
    let previousUnitId: string | null = null;
    while (remaining.length > 0 && selected.length < limit) {
      const alternative = remaining.findIndex((candidate) => candidate.unitId !== previousUnitId);
      const index = alternative >= 0 ? alternative : 0;
      const [candidate] = remaining.splice(index, 1);
      if (!candidate) break;
      selected.push(candidate);
      previousUnitId = candidate.unitId;
    }
    if (selected.length >= limit) break;
  }
  return selected;
}

export function storedReviewItem(candidate: ReviewCandidate): StoredReviewItem {
  return {
    content: candidate.item,
    evidenceEnrollmentIds: candidate.evidenceEnrollmentIds,
    kind: candidate.kind,
    objectiveIds: candidate.objectiveIds,
    payloadHash: candidate.payloadHash,
    resourceRevisionId: candidate.resourceRevisionId,
    reviewStateVersion: candidate.reviewStateVersion,
    sourceContentId: candidate.sourceContentId,
  };
}
