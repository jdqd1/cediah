import type { Transaction } from "kysely";
import { z } from "zod";
import {
  LearningObjectiveSchema,
  LearningOptionConfigSchema,
} from "@cediah/contracts";
import type { CediahDatabase, JsonValue } from "../db/database.js";
import { parseStoredAttemptManifest } from "./attempt-manifest.js";
import { quizAdapter } from "./adapters/quiz.js";
import { evaluateObjectiveEvidence, type ObjectiveAssessment } from "./objective-evidence.js";

export const objectiveEvidencePolicyVersion = "evidence-v1" as const;

const ObjectivesSchema = z.array(LearningObjectiveSchema).max(50);
const ObjectiveIdsSchema = z.array(z.string().uuid()).max(20);
const QuizRevisionSchema = z.strictObject({
  content: z.unknown(),
  projection: z.literal("quiz"),
  sourceContentId: z.string().uuid(),
  sourceVersion: z.number().int().positive(),
  title: z.string().trim().min(1).max(500),
});

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

export async function recomputeObjectiveEvidence(
  transaction: Transaction<CediahDatabase>,
  input: { enrollmentId: string; now: Date; pathVersionId: string; userId: string },
) {
  const [units, attempts, options] = await Promise.all([
    transaction.selectFrom("learning_path_units")
      .select(["id", "objectives_json"])
      .where("path_version_id", "=", input.pathVersionId)
      .orderBy("position", "asc")
      .execute(),
    transaction.selectFrom("learning_attempts")
      .select(["id", "manifest_json", "submitted_at"])
      .where("enrollment_id", "=", input.enrollmentId)
      .where("path_version_id", "=", input.pathVersionId)
      .where("purpose", "=", "check")
      .where("projection", "=", "quiz")
      .where("status", "=", "completed")
      .where("submitted_at", "is not", null)
      .orderBy("submitted_at", "asc")
      .execute(),
    transaction.selectFrom("learning_step_options")
      .innerJoin("learning_path_steps", "learning_path_steps.id", "learning_step_options.step_id")
      .innerJoin("learning_resource_revisions", "learning_resource_revisions.id", "learning_step_options.resource_revision_id")
      .select([
        "learning_step_options.config_json",
        "learning_path_steps.objective_ids_json",
        "learning_resource_revisions.payload_json",
      ])
      .where("learning_step_options.path_version_id", "=", input.pathVersionId)
      .where("learning_step_options.projection", "=", "quiz")
      .execute(),
  ]);
  const objectives = units.flatMap((unit) => {
    const parsed = ObjectivesSchema.safeParse(unit.objectives_json);
    return parsed.success ? parsed.data : [];
  });
  if (objectives.length === 0) return;

  const bankByObjective = new Map<string, Set<string>>(
    objectives.map((objective) => [objective.id, new Set<string>()]),
  );
  for (const option of options) {
    const config = LearningOptionConfigSchema.safeParse(option.config_json);
    const snapshot = QuizRevisionSchema.safeParse(option.payload_json);
    const stepObjectives = ObjectiveIdsSchema.safeParse(option.objective_ids_json);
    if (!config.success || !snapshot.success) continue;
    try {
      const questions = quizAdapter.parse(snapshot.data.content).questions;
      const selected = config.data.selectedItemIds.length > 0
        ? new Set(config.data.selectedItemIds)
        : null;
      const mapped = new Map(config.data.objectiveMappings.map((mapping) => [mapping.itemId, mapping.objectiveIds]));
      for (const question of questions) {
        if (selected && !selected.has(question.id)) continue;
        const objectiveIds = mapped.get(question.id) ?? (stepObjectives.success ? stepObjectives.data : []);
        for (const objectiveId of objectiveIds) bankByObjective.get(objectiveId)?.add(question.id);
      }
    } catch {
      // Invalid snapshots are handled by editorial validation; they cannot create evidence.
    }
  }

  const attemptIds = attempts.map((attempt) => attempt.id);
  const responses = attemptIds.length > 0
    ? await transaction.selectFrom("learning_responses")
      .select(["attempt_id", "grading_json", "item_id"])
      .where("attempt_id", "in", attemptIds)
      .where("round", "=", 1)
      .execute()
    : [];
  const responseByAttempt = new Map<string, typeof responses>();
  for (const response of responses) {
    const collection = responseByAttempt.get(response.attempt_id) ?? [];
    collection.push(response);
    responseByAttempt.set(response.attempt_id, collection);
  }
  const assessmentsByObjective = new Map<string, ObjectiveAssessment[]>(
    objectives.map((objective) => [objective.id, []]),
  );
  for (const attempt of attempts) {
    let manifest;
    try {
      manifest = parseStoredAttemptManifest(attempt.manifest_json);
    } catch {
      continue;
    }
    if (manifest.projection !== "quiz" || !attempt.submitted_at) continue;
    const publicQuestions = quizAdapter.parse(manifest.content).questions;
    const objectiveMap = new Map(manifest.config.objectiveMappings.map((mapping) => [mapping.itemId, mapping.objectiveIds]));
    const grading = new Map((responseByAttempt.get(attempt.id) ?? []).map((response) => {
      const record = response.grading_json && typeof response.grading_json === "object" &&
        !Array.isArray(response.grading_json) ? response.grading_json as Record<string, unknown> : {};
      return [response.item_id, record.correct === true] as const;
    }));
    for (const objective of objectives) {
      const itemIds = publicQuestions.filter((question) =>
        (objectiveMap.get(question.id) ?? []).includes(objective.id))
        .map((question) => question.id);
      if (itemIds.length === 0) continue;
      const correct = itemIds.filter((itemId) => grading.get(itemId) === true).length;
      assessmentsByObjective.get(objective.id)?.push({
        assessedAt: asDate(attempt.submitted_at),
        itemIds,
        percent: Math.round((correct / itemIds.length) * 100),
      });
    }
  }

  for (const objective of objectives) {
    const bank = bankByObjective.get(objective.id) ?? new Set<string>();
    const evidence = evaluateObjectiveEvidence(
      assessmentsByObjective.get(objective.id) ?? [],
      bank.size,
      input.now,
    );
    const reviewRows = bank.size > 0
      ? await transaction.selectFrom("learning_review_states")
        .select("last_reviewed_at")
        .where("user_id", "=", input.userId)
        .where("item_id", "in", [...bank])
        .where("last_reviewed_at", "is not", null)
        .orderBy("last_reviewed_at", "desc")
        .limit(1)
        .execute()
      : [];
    const lastReviewAt = reviewRows[0]?.last_reviewed_at ?? null;
    const evidenceJson: JsonValue = {
      distinctQuestions: evidence.distinctQuestions,
      evidenceLimited: evidence.evidenceLimited,
      historicalState: evidence.historicalState,
      lastCheckPercent: evidence.lastCheckPercent,
      lastReviewAt: lastReviewAt ? asDate(lastReviewAt).toISOString() : null,
      reviewRecommended: evidence.reviewRecommended,
    };
    await transaction.insertInto("learning_objective_progress").values({
      enrollment_id: input.enrollmentId,
      evidence_json: evidenceJson,
      evidence_state: evidence.state,
      last_assessed_at: evidence.lastAssessedAt,
      objective_id: objective.id,
      path_version_id: input.pathVersionId,
      policy_version: objectiveEvidencePolicyVersion,
    }).onConflict((conflict) => conflict
      .columns(["enrollment_id", "path_version_id", "objective_id"])
      .doUpdateSet({
        evidence_json: evidenceJson,
        evidence_state: evidence.state,
        last_assessed_at: evidence.lastAssessedAt,
        policy_version: objectiveEvidencePolicyVersion,
      }))
      .execute();
  }
}
