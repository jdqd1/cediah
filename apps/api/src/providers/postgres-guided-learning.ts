import { sql, type Selectable, type Transaction } from "kysely";
import {
  ContentDraftSchema,
  LearningCompletionRuleSchema,
  LearningCoverKeySchema,
  LearningEditorResourceCatalogResponseSchema,
  LearningEnrollmentUpgradePreviewResponseSchema,
  LearningEnrollmentUpgradeResponseSchema,
  LearningObjectiveSchema,
  LearningOptionConfigSchema,
  LearningPathDetailSchema,
  type GuidedLearningProvider,
  type GuidedLearningResult,
  type LearningEnrollmentResponse,
  type LearningEnrollmentSummary,
  type LearningEnrollmentUpgradeResponse,
  type LearningEditorResource,
  type LearningPathDefinition,
  type LearningPathDetail,
  type LearningPathOptionDraft,
  type LearningPathValidationIssue,
} from "@cediah/contracts";
import type {
  CediahDatabase,
  ContentItemTable,
  DatabaseClient,
  JsonValue,
  LearningEnrollmentTable,
  LearningPathTable,
  LearningPathVersionTable,
} from "../db/database.js";
import { getLearningAdapter } from "../guided-learning/adapters/registry.js";
import {
  createLearningContentResolver,
  type LearningContentResolver,
} from "../guided-learning/content-resolver.js";
import { defaultCompletionRule, guidedLearningPolicyV1 } from "../guided-learning/policies.js";
import { hashLearningSnapshot } from "../guided-learning/snapshot-hash.js";
import {
  canTransitionLearningPath,
  validateLearningPathDefinition,
} from "../guided-learning/service.js";
import {
  createPostgresLearningActivityMethods,
  readLearningEnrollmentProgress,
} from "./postgres-learning-activities.js";
import {
  createPostgresLearningInsightMethods,
  initializeEnrollmentEvidence,
} from "./postgres-learning-insights.js";
import type { PostgresContentProviderConfiguration } from "./postgres-content.js";
import { withLearningReceipt } from "../guided-learning/mutation-receipt.js";
import { planLearningEnrollmentUpgrade } from "../guided-learning/path-upgrade.js";

type QueryDatabase = DatabaseClient | Transaction<CediahDatabase>;
type PathRow = Selectable<LearningPathTable>;
type VersionRow = Selectable<LearningPathVersionTable>;
type EnrollmentRow = Selectable<LearningEnrollmentTable>;

type ResolvedOption = LearningPathOptionDraft & {
  completionRule: ReturnType<typeof defaultCompletionRule>;
  itemIds: string[];
  resourceRevisionId: string;
  sourceContentId: string;
};
type ResolvedDefinition = Omit<LearningPathDefinition, "units"> & {
  units: Array<Omit<LearningPathDefinition["units"][number], "steps"> & {
    steps: Array<Omit<LearningPathDefinition["units"][number]["steps"][number], "options"> & {
      options: ResolvedOption[];
    }>;
  }>;
};

function toIso(value: Date | string) {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const value = (error as { code?: unknown }).code;
  return typeof value === "string" ? value : null;
}

function asFailure(error: unknown): "conflict" | null {
  return ["23503", "23505", "23514", "23P01"].includes(errorCode(error) ?? "")
    ? "conflict"
    : null;
}

function enrollmentSummary(row: EnrollmentRow): LearningEnrollmentSummary {
  return {
    completedAt: row.completed_at ? toIso(row.completed_at) : null,
    id: row.id,
    pathVersionId: row.path_version_id,
    rowVersion: row.row_version,
    status: row.status,
  };
}

function enrollmentResponse(row: EnrollmentRow, slug: string): LearningEnrollmentResponse {
  return {
    continueHref: `/aprendizaje/rutas/${slug}`,
    enrollment: enrollmentSummary(row),
    pathSlug: slug,
  };
}

async function writeAudit(
  database: QueryDatabase,
  input: {
    action: string;
    actorUserId: string;
    metadata?: JsonValue;
    pathId: string;
  },
) {
  await database.insertInto("audit_log").values({
    action: input.action,
    actor_user_id: input.actorUserId,
    metadata: input.metadata ?? {},
    target_id: input.pathId,
    target_type: "learning_path",
  }).execute();
}

async function resolveDefinition(
  resolver: LearningContentResolver,
  definition: LearningPathDefinition,
): Promise<GuidedLearningResult<ResolvedDefinition>> {
  const units: ResolvedDefinition["units"] = [];
  for (const unit of definition.units) {
    const steps: ResolvedDefinition["units"][number]["steps"] = [];
    for (const step of unit.steps) {
      const options: ResolvedOption[] = [];
      for (let optionPosition = 0; optionPosition < step.options.length; optionPosition += 1) {
        const option = step.options[optionPosition]!;
        const resolution = await resolver.resolvePublishedRevision({
          allowGuidedOnly: true,
          projection: option.projection,
          sourceContentId: option.sourceContentId,
        });
        if (resolution.status === "not_found") return { status: "not_found" };
        if (resolution.status !== "success") return { status: "resource_changed" };
        const adapter = getLearningAdapter(option.projection);
        const items = adapter.items(resolution.value.payload.content);
        options.push({
          ...option,
          completionRule: option.completionRule ?? defaultCompletionRule(option.projection, items.length),
          itemIds: items.map((item) => item.id),
          resourceRevisionId: resolution.value.resourceRevisionId,
          sourceContentId: resolution.value.sourceContentId,
        });
      }
      steps.push({ ...step, options });
    }
    units.push({ ...unit, steps });
  }
  return { status: "success", value: { ...definition, units } };
}

async function insertDefinition(
  transaction: Transaction<CediahDatabase>,
  pathVersionId: string,
  definition: ResolvedDefinition,
) {
  for (let unitPosition = 0; unitPosition < definition.units.length; unitPosition += 1) {
    const unit = definition.units[unitPosition]!;
    const storedUnit = await transaction.insertInto("learning_path_units").values({
      ...(unit.id ? { id: unit.id } : {}),
      objectives_json: unit.objectives as unknown as JsonValue,
      path_version_id: pathVersionId,
      pedagogy_version: unit.pedagogyVersion,
      position: unitPosition,
      stable_key: unit.stableKey,
      title: unit.title,
    }).returning("id").executeTakeFirstOrThrow();

    for (let stepPosition = 0; stepPosition < unit.steps.length; stepPosition += 1) {
      const step = unit.steps[stepPosition]!;
      const storedStep = await transaction.insertInto("learning_path_steps").values({
        ...(step.id ? { id: step.id } : {}),
        is_essential: step.isEssential,
        objective_ids_json: step.objectiveIds as unknown as JsonValue,
        path_version_id: pathVersionId,
        pedagogy_version: step.pedagogyVersion,
        position: stepPosition,
        purpose: step.purpose,
        recommended_after_json: step.recommendedAfter as unknown as JsonValue,
        stable_key: step.stableKey,
        title: step.title,
        unit_id: storedUnit.id,
      }).returning("id").executeTakeFirstOrThrow();

      for (let optionPosition = 0; optionPosition < step.options.length; optionPosition += 1) {
        const option = step.options[optionPosition]!;
        const config = {
          ...option.config,
          selectedItemIds: option.config.selectedItemIds.length > 0
            ? option.config.selectedItemIds
            : option.itemIds,
        };
        await transaction.insertInto("learning_step_options").values({
          ...(option.id ? { id: option.id } : {}),
          completion_rule_json: option.completionRule as unknown as JsonValue,
          config_json: config as unknown as JsonValue,
          estimated_minutes: option.estimatedMinutes,
          is_default: option.isDefault,
          label: option.label,
          path_version_id: pathVersionId,
          position: optionPosition,
          projection: option.projection,
          resource_revision_id: option.resourceRevisionId,
          reward_identity: option.rewardIdentity,
          reward_version: option.rewardVersion,
          source_content_id: option.sourceContentId,
          step_id: storedStep.id,
        }).execute();
      }
    }
  }
}

async function latestVersion(database: QueryDatabase, pathId: string) {
  return database.selectFrom("learning_path_versions")
    .selectAll()
    .where("path_id", "=", pathId)
    .orderBy("version_number", "desc")
    .executeTakeFirst();
}

async function readPathDetail(
  database: QueryDatabase,
  path: PathRow,
  version: VersionRow,
  userId?: string,
): Promise<LearningPathDetail> {
  const topic = await database.selectFrom("content_items")
    .select(["id", "title"])
    .where("id", "=", path.topic_content_id)
    .executeTakeFirstOrThrow();
  const unitRows = await database.selectFrom("learning_path_units")
    .selectAll()
    .where("path_version_id", "=", version.id)
    .orderBy("position", "asc")
    .execute();
  const stepRows = await database.selectFrom("learning_path_steps")
    .selectAll()
    .where("path_version_id", "=", version.id)
    .orderBy("position", "asc")
    .execute();
  const optionRows = await database.selectFrom("learning_step_options")
    .selectAll()
    .where("path_version_id", "=", version.id)
    .orderBy("position", "asc")
    .execute();
  const enrollment = userId
    ? await database.selectFrom("learning_enrollments")
      .selectAll()
      .where("user_id", "=", userId)
      .where("path_id", "=", path.id)
      .executeTakeFirst()
    : undefined;
  const policy = version.policy_json as Record<string, unknown>;

  return LearningPathDetailSchema.parse({
    archivedAt: path.archived_at ? toIso(path.archived_at) : null,
    coverKey: LearningCoverKeySchema.parse(path.cover_key),
    createdBy: path.created_by,
    enrollment: enrollment ? enrollmentSummary(enrollment) : null,
    id: path.id,
    slug: path.slug,
    summary: path.summary,
    title: path.title,
    topic,
    version: {
      editVersion: version.edit_version,
      evidenceLevel: policy.evidenceLevel === "limited" ? "limited" : "standard",
      id: version.id,
      number: version.version_number,
      policyVersion: version.policy_version,
      publishedAt: version.published_at ? toIso(version.published_at) : null,
      releaseNotes: version.release_notes,
      status: version.status,
      units: unitRows.map((unit) => ({
        id: unit.id,
        objectives: LearningObjectiveSchema.array().parse(unit.objectives_json),
        pedagogyVersion: unit.pedagogy_version,
        position: unit.position,
        stableKey: unit.stable_key,
        steps: stepRows.filter((step) => step.unit_id === unit.id).map((step) => ({
          id: step.id,
          isEssential: step.is_essential,
          objectiveIds: LearningObjectiveSchema.shape.id.array().parse(step.objective_ids_json),
          options: optionRows.filter((option) => option.step_id === step.id).map((option) => ({
            completionRule: LearningCompletionRuleSchema.parse(option.completion_rule_json),
            config: LearningOptionConfigSchema.parse(option.config_json),
            estimatedMinutes: option.estimated_minutes,
            id: option.id,
            isDefault: option.is_default,
            label: option.label,
            projection: option.projection,
            resourceRevisionId: option.resource_revision_id,
            rewardIdentity: option.reward_identity,
            rewardVersion: option.reward_version,
            sourceContentId: option.source_content_id,
          })),
          pedagogyVersion: step.pedagogy_version,
          position: step.position,
          purpose: step.purpose,
          recommendedAfter: zStringArray(step.recommended_after_json),
          stableKey: step.stable_key,
          title: step.title,
        })),
        title: unit.title,
      })),
    },
  });
}

function zStringArray(value: JsonValue) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error("Invalid stored string array");
  }
  return value as string[];
}

async function storedValidation(
  database: QueryDatabase,
  path: LearningPathDetail,
): Promise<LearningPathValidationIssue[]> {
  const revisionIds = [...new Set(path.version.units.flatMap((unit) => unit.steps)
    .flatMap((step) => step.options).map((option) => option.resourceRevisionId))];
  const resourceItems = new Map<string, Array<{ explanation?: string; id: string; kind: string }>>();
  if (revisionIds.length > 0) {
    const revisions = await database.selectFrom("learning_resource_revisions")
      .innerJoin("learning_resources", "learning_resources.id", "learning_resource_revisions.resource_id")
      .innerJoin("content_items", "content_items.id", "learning_resources.source_content_id")
      .select([
        "learning_resource_revisions.id",
        "learning_resource_revisions.payload_hash",
        "learning_resource_revisions.payload_json",
        "learning_resources.retired_at",
        "content_items.status as source_status",
      ])
      .where("learning_resource_revisions.id", "in", revisionIds)
      .execute();
    for (const revision of revisions) {
      const snapshot = revision.payload_json as unknown as {
        content: unknown;
        projection: "video" | "guide" | "quiz" | "flashcards";
      };
      const adapter = getLearningAdapter(snapshot.projection);
      const items = adapter.items(snapshot.content);
      const questions = snapshot.projection === "quiz"
        ? (snapshot.content as { questions?: Array<{ explanation?: string; id?: string }> }).questions ?? []
        : [];
      resourceItems.set(revision.id, items.map((item) => ({
        explanation: questions.find((question) => question.id === item.id)?.explanation,
        id: item.id,
        kind: item.kind,
      })));
      if (revision.retired_at || revision.source_status !== "published") {
        resourceItems.delete(revision.id);
      }
      if (hashLearningSnapshot(revision.payload_json) !== revision.payload_hash) {
        resourceItems.delete(revision.id);
      }
    }
  }

  const issues = validateLearningPathDefinition(path, resourceItems);
  for (const revisionId of revisionIds) {
    if (!resourceItems.has(revisionId)) {
      issues.push({
        code: "resource_unavailable",
        message: "El recurso está retirado, archivado o su snapshot no es válido.",
        path: `resource.${revisionId}`,
        severity: "error",
      });
    }
  }
  const topic = await database.selectFrom("content_items")
    .select(["kind", "status"])
    .where("id", "=", path.topic.id)
    .executeTakeFirst();
  if (!topic || topic.kind !== "topic" || topic.status !== "published") {
    issues.push({
      code: "topic_unavailable",
      message: "La ruta necesita un tema publicado.",
      path: "topicContentId",
      severity: "error",
    });
  }
  return issues;
}

function toDefinition(detail: LearningPathDetail, releaseNotes?: string): LearningPathDefinition {
  return {
    evidenceLevel: detail.version.evidenceLevel,
    policyVersion: detail.version.policyVersion,
    releaseNotes: releaseNotes ?? detail.version.releaseNotes,
    units: detail.version.units.map((unit) => ({
      objectives: unit.objectives,
      pedagogyVersion: unit.pedagogyVersion,
      stableKey: unit.stableKey,
      steps: unit.steps.map((step) => ({
        isEssential: step.isEssential,
        objectiveIds: step.objectiveIds,
        options: step.options.map((option) => ({
          completionRule: option.completionRule,
          config: option.config,
          estimatedMinutes: option.estimatedMinutes,
          isDefault: option.isDefault,
          label: option.label,
          projection: option.projection,
          rewardIdentity: option.rewardIdentity,
          rewardVersion: option.rewardVersion,
          sourceContentId: option.sourceContentId,
        })),
        pedagogyVersion: step.pedagogyVersion,
        purpose: step.purpose,
        recommendedAfter: step.recommendedAfter,
        stableKey: step.stableKey,
        title: step.title,
      })),
      title: unit.title,
    })),
  };
}

function explanationCoverage(questions: Array<{ explanation?: string }>) {
  if (questions.length === 0) return "missing" as const;
  const explained = questions.filter((question) => question.explanation?.trim()).length;
  return explained === questions.length ? "complete" as const
    : explained === 0 ? "missing" as const : "partial" as const;
}

function editorResource(row: Selectable<ContentItemTable>): LearningEditorResource {
  const parsed = ContentDraftSchema.safeParse({
    catalogVisibility: row.catalog_visibility,
    content: row.content,
    estimatedMinutes: row.estimated_minutes,
    featured: row.is_featured,
    kind: row.kind,
    slug: row.slug,
    subjectIds: [],
    summary: row.summary,
    title: row.title,
    topic: row.topic,
  });
  if (!parsed.success || parsed.data.kind === "topic") {
    return {
      catalogVisibility: row.catalog_visibility,
      estimatedMinutes: row.estimated_minutes,
      id: row.id,
      issues: ["El material publicado necesita corrección antes de usarse en una ruta."],
      kind: row.kind === "topic" ? "guide" : row.kind,
      projections: [],
      title: row.title,
      topic: row.topic,
      version: row.version,
    };
  }

  const projections: LearningEditorResource["projections"] = [];
  const issues: string[] = [];
  const addQuestionProjections = (questions: Array<{ explanation?: string; id?: string }>) => {
    if (questions.length === 0) return;
    const coverage = explanationCoverage(questions);
    const itemIds = questions.flatMap((question) => question.id ? [question.id] : []);
    projections.push({ explanationCoverage: coverage, itemCount: questions.length, itemIds, projection: "quiz" });
    projections.push({ explanationCoverage: coverage, itemCount: questions.length, itemIds, projection: "flashcards" });
    const missing = questions.filter((question) => !question.explanation?.trim()).length;
    if (missing > 0) {
      issues.push(`${missing} ${missing === 1 ? "pregunta no tiene" : "preguntas no tienen"} explicación.`);
    }
  };

  if (parsed.data.kind === "video") {
    projections.push({ explanationCoverage: "not_applicable", itemCount: 0, itemIds: [], projection: "video" });
    projections.push({
      explanationCoverage: "not_applicable",
      itemCount: parsed.data.content.guide.sections.length,
      itemIds: [],
      projection: "guide",
    });
    addQuestionProjections(parsed.data.content.quiz.questions);
  } else if (parsed.data.kind === "guide") {
    projections.push({
      explanationCoverage: "not_applicable",
      itemCount: parsed.data.content.sections.length,
      itemIds: [],
      projection: "guide",
    });
    addQuestionProjections(parsed.data.content.quiz.questions);
  } else if (parsed.data.kind === "quiz") {
    addQuestionProjections(parsed.data.content.questions);
  } else {
    projections.push({
      explanationCoverage: "not_applicable",
      itemCount: parsed.data.content.cards.length,
      itemIds: parsed.data.content.cards.flatMap((card) => card.id ? [card.id] : []),
      projection: "flashcards",
    });
  }

  return {
    catalogVisibility: row.catalog_visibility,
    estimatedMinutes: row.estimated_minutes,
    id: row.id,
    issues,
    kind: parsed.data.kind,
    projections,
    title: row.title,
    topic: row.topic,
    version: row.version,
  };
}

export function createPostgresGuidedLearningProvider(
  database: DatabaseClient,
  configuration: {
    assetStorage?: PostgresContentProviderConfiguration["assetStorage"];
    clock?: () => Date;
    resolver?: LearningContentResolver;
  } = {},
): GuidedLearningProvider {
  const resolver = configuration.resolver ?? createLearningContentResolver(database);

  async function editorPath(input: {
    actorUserId: string;
    canEditAll: boolean;
    pathId: string;
  }): Promise<GuidedLearningResult<LearningPathDetail>> {
    const path = await database.selectFrom("learning_paths").selectAll()
      .where("id", "=", input.pathId).executeTakeFirst();
    if (!path || (!input.canEditAll && path.created_by !== input.actorUserId)) {
      return { status: "not_found" };
    }
    const version = await latestVersion(database, path.id);
    return version
      ? { status: "success", value: await readPathDetail(database, path, version) }
      : { status: "not_found" };
  }

  return {
    ...createPostgresLearningActivityMethods(database, {
      assetStorage: configuration.assetStorage,
      clock: configuration.clock,
    }),
    ...createPostgresLearningInsightMethods(database, { clock: configuration.clock }),
    async createEnrollment(input) {
      return database.transaction().execute(async (transaction) => {
        const path = await transaction.selectFrom("learning_paths")
          .select(["id", "published_version_id", "slug"])
          .where("id", "=", input.pathId)
          .where("archived_at", "is", null)
          .forShare()
          .executeTakeFirst();
        if (!path?.published_version_id) return { status: "not_found" };

        let enrollment = await transaction.insertInto("learning_enrollments").values({
          path_id: path.id,
          path_version_id: path.published_version_id,
          user_id: input.userId,
        }).onConflict((conflict) => conflict.columns(["user_id", "path_id"]).doNothing())
          .returningAll().executeTakeFirst();
        if (enrollment) {
          await transaction.insertInto("learning_enrollment_versions").values({
            enrollment_id: enrollment.id,
            mapping_json: {},
            path_id: path.id,
            path_version_id: path.published_version_id,
            previous_version_id: null,
          }).execute();
        } else {
          enrollment = await transaction.selectFrom("learning_enrollments").selectAll()
            .where("user_id", "=", input.userId).where("path_id", "=", path.id)
            .executeTakeFirstOrThrow();
        }
        await initializeEnrollmentEvidence(transaction, {
          enrollmentId: enrollment.id,
          now: configuration.clock?.() ?? new Date(),
          pathVersionId: enrollment.path_version_id,
          userId: input.userId,
        });
        return { status: "success", value: enrollmentResponse(enrollment, path.slug) };
      });
    },

    async createPath(input) {
      const resolved = await resolveDefinition(resolver, input.draft.definition);
      if (resolved.status !== "success") return resolved;
      try {
        const ids = await database.transaction().execute(async (transaction) => {
          const topic = await transaction.selectFrom("content_items").select("id")
            .where("id", "=", input.draft.topicContentId).where("kind", "=", "topic")
            .executeTakeFirst();
          if (!topic) return null;
          const path = await transaction.insertInto("learning_paths").values({
            cover_asset_id: null,
            cover_key: input.draft.coverKey,
            created_by: input.actorUserId,
            published_version_id: null,
            slug: input.draft.slug,
            summary: input.draft.summary,
            title: input.draft.title,
            topic_content_id: input.draft.topicContentId,
          }).returningAll().executeTakeFirstOrThrow();
          const version = await transaction.insertInto("learning_path_versions").values({
            path_id: path.id,
            policy_json: {
              ...guidedLearningPolicyV1,
              evidenceLevel: resolved.value.evidenceLevel,
            } as unknown as JsonValue,
            policy_version: resolved.value.policyVersion,
            release_notes: resolved.value.releaseNotes,
            version_number: 1,
          }).returningAll().executeTakeFirstOrThrow();
          await insertDefinition(transaction, version.id, resolved.value);
          await writeAudit(transaction, {
            action: "learning_path_created",
            actorUserId: input.actorUserId,
            metadata: { versionId: version.id, versionNumber: 1 },
            pathId: path.id,
          });
          return { path, version };
        });
        if (!ids) return { status: "not_found" };
        return { status: "success", value: await readPathDetail(database, ids.path, ids.version) };
      } catch (error) {
        const failure = asFailure(error);
        if (failure) return { status: failure };
        throw error;
      }
    },

    async createVersion(input) {
      const access = await editorPath(input);
      if (access.status !== "success") return access;
      const path = access.value;
      if (path.version.status !== "published" || path.archivedAt) return { status: "conflict" };
      const definition = toDefinition(path, input.releaseNotes);
      const resolved = await resolveDefinition(resolver, definition);
      if (resolved.status !== "success") return resolved;
      try {
        const version = await database.transaction().execute(async (transaction) => {
          const lockedPath = await transaction.selectFrom("learning_paths").selectAll()
            .where("id", "=", path.id).forUpdate().executeTakeFirstOrThrow();
          if (lockedPath.published_version_id !== path.version.id) return null;
          const existingDraft = await transaction.selectFrom("learning_path_versions").select("id")
            .where("path_id", "=", path.id).where("status", "!=", "published")
            .where("status", "!=", "archived").executeTakeFirst();
          if (existingDraft) return null;
          const created = await transaction.insertInto("learning_path_versions").values({
            path_id: path.id,
            policy_json: {
              ...guidedLearningPolicyV1,
              evidenceLevel: resolved.value.evidenceLevel,
            } as unknown as JsonValue,
            policy_version: resolved.value.policyVersion,
            release_notes: resolved.value.releaseNotes,
            version_number: path.version.number + 1,
          }).returningAll().executeTakeFirstOrThrow();
          await insertDefinition(transaction, created.id, resolved.value);
          await writeAudit(transaction, {
            action: "learning_path_version_created",
            actorUserId: input.actorUserId,
            metadata: { sourceVersionId: path.version.id, versionId: created.id },
            pathId: path.id,
          });
          return { created, lockedPath };
        });
        return version
          ? { status: "success", value: await readPathDetail(database, version.lockedPath, version.created) }
          : { status: "conflict" };
      } catch (error) {
        const failure = asFailure(error);
        if (failure) return { status: failure };
        throw error;
      }
    },

    getEditorPath: editorPath,

    async getEnrollmentUpgradePreview(input) {
      const planning = await planLearningEnrollmentUpgrade(database, input);
      if (planning.status !== "success") return { status: planning.status };
      const history = planning.plan ? planning.plan.history : planning.history;
      return {
        status: "success",
        value: LearningEnrollmentUpgradePreviewResponseSchema.parse({
          history,
          upgrade: planning.plan?.preview ?? null,
        }),
      };
    },

    async getPathBySlug(input) {
      const path = await database.selectFrom("learning_paths").selectAll()
        .where("slug", "=", input.slug).executeTakeFirst();
      if (!path) return null;
      const enrollment = await database.selectFrom("learning_enrollments").selectAll()
        .where("path_id", "=", path.id).where("user_id", "=", input.userId)
        .executeTakeFirst();
      if ((!path.published_version_id || path.archived_at) && !enrollment) return null;
      const versionId = enrollment?.path_version_id ?? path.published_version_id;
      if (!versionId) return null;
      const version = await database.selectFrom("learning_path_versions").selectAll()
        .where("id", "=", versionId).where("path_id", "=", path.id).executeTakeFirst();
      return version ? readPathDetail(database, path, version, input.userId) : null;
    },

    async listEditorPaths(input) {
      const rows = await database.selectFrom("learning_paths").selectAll()
        .$if(!input.canEditAll, (query) => query.where("created_by", "=", input.actorUserId))
        .orderBy("updated_at", "desc").limit(200).execute();
      const paths: LearningPathDetail[] = [];
      for (const path of rows) {
        const version = await latestVersion(database, path.id);
        if (version) paths.push(await readPathDetail(database, path, version));
      }
      return paths;
    },

    async listEditorResources(input) {
      const projectionKinds: Array<Selectable<ContentItemTable>["kind"]> = input.projection === "video"
        ? ["video"]
        : input.projection === "guide"
          ? ["video", "guide"]
          : input.projection === "quiz"
            ? ["video", "guide", "quiz"]
            : input.projection === "flashcards"
              ? ["video", "guide", "quiz", "flashcards"]
              : ["video", "guide", "quiz", "flashcards"];
      const rows = await database.selectFrom("content_items").selectAll()
        .where("status", "=", "published")
        .where("kind", "in", projectionKinds)
        .$if(Boolean(input.cursor), (query) => query.where("id", ">", input.cursor ?? ""))
        .$if(Boolean(input.q?.trim()), (query) => query.where(
          sql<boolean>`lower(content_items.title) like ${`%${input.q!.trim().toLowerCase()}%`}`,
        ))
        .$if(Boolean(input.topic), (query) => query.where("topic", "=", input.topic ?? ""))
        .orderBy("id", "asc")
        .limit(input.limit + 1)
        .execute();
      const page = rows.slice(0, input.limit);
      const retiredRows = page.length > 0
        ? await database.selectFrom("learning_resources")
          .select(["projection", "source_content_id"])
          .where("source_content_id", "in", page.map((row) => row.id))
          .where("retired_at", "is not", null)
          .execute()
        : [];
      const retired = new Set(retiredRows.map((row) => `${row.source_content_id}:${row.projection}`));
      const visible = page.map(editorResource).map((resource) => {
        const unavailable = resource.projections.filter((projection) => retired.has(
          `${resource.id}:${projection.projection}`,
        ));
        return unavailable.length === 0 ? resource : {
          ...resource,
          issues: [
            ...resource.issues,
            ...unavailable.map((projection) => `La proyección ${projection.projection} está retirada.`),
          ],
          projections: resource.projections.filter((projection) => !retired.has(
            `${resource.id}:${projection.projection}`,
          )),
        };
      })
        .filter((resource) => !input.projection || resource.projections.some(
          (projection) => projection.projection === input.projection,
        ));
      const [topics, resourceTopicRows] = await Promise.all([
        database.selectFrom("content_items")
          .select(["id", "title"])
          .where("status", "=", "published")
          .where("kind", "=", "topic")
          .orderBy("title", "asc")
          .limit(500)
          .execute(),
        database.selectFrom("content_items")
          .select("topic")
          .where("status", "=", "published")
          .where("kind", "in", ["video", "guide", "quiz", "flashcards"])
          .where("topic", "!=", "")
          .groupBy("topic")
          .orderBy("topic", "asc")
          .limit(500)
          .execute(),
      ]);
      return LearningEditorResourceCatalogResponseSchema.parse({
        items: visible,
        nextCursor: rows.length > input.limit ? rows[input.limit - 1]?.id ?? null : null,
        resourceTopics: resourceTopicRows.map((row) => row.topic),
        topics,
      });
    },

    async listLibraryOptions(input) {
      const rows = await database.selectFrom("learning_step_options")
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
          "learning_step_options.id as option_id",
          "learning_step_options.label",
          "learning_step_options.projection",
          "learning_path_steps.id as step_id",
          "learning_path_steps.title as step_title",
          "learning_paths.slug as path_slug",
          "learning_paths.title as path_title",
        ])
        .where("learning_enrollments.status", "=", "active")
        .where("learning_path_versions.status", "=", "published")
        .where("learning_paths.archived_at", "is", null)
        .where("learning_resources.retired_at", "is", null)
        .where("content_items.status", "=", "published")
        .where("learning_step_options.source_content_id", "=", input.sourceContentId)
        .where("learning_step_options.projection", "=", input.projection)
        .whereRef("learning_resource_revisions.source_version", "=", "content_items.version")
        .where(sql<boolean>`not exists (
          select 1 from public.learning_resource_revisions newer
          where newer.resource_id = learning_resource_revisions.resource_id
            and newer.revision_number > learning_resource_revisions.revision_number
        )`)
        .orderBy("learning_paths.title", "asc")
        .orderBy("learning_path_steps.position", "asc")
        .limit(20)
        .execute();
      return rows.map((row) => ({
        href: `/aprendizaje/rutas/${row.path_slug}/actividades/${row.step_id}?opcion=${row.option_id}`,
        label: row.label,
        optionId: row.option_id,
        pathTitle: row.path_title,
        projection: row.projection,
        stepTitle: row.step_title,
      }));
    },

    async listPublishedPaths(input) {
      const rows = await database.selectFrom("learning_paths")
        .innerJoin("learning_path_versions", "learning_path_versions.id", "learning_paths.published_version_id")
        .innerJoin("content_items", "content_items.id", "learning_paths.topic_content_id")
        .leftJoin("learning_enrollments", (join) => join
          .onRef("learning_enrollments.path_id", "=", "learning_paths.id")
          .on("learning_enrollments.user_id", "=", input.userId))
        .select([
          "learning_paths.cover_key",
          "learning_paths.id",
          "learning_paths.slug",
          "learning_paths.summary",
          "learning_paths.title",
          "learning_paths.topic_content_id",
          "learning_path_versions.id as version_id",
          "content_items.title as topic_title",
          "learning_enrollments.completed_at",
          "learning_enrollments.id as enrollment_id",
          "learning_enrollments.path_version_id as enrollment_version_id",
          "learning_enrollments.row_version",
          "learning_enrollments.status as enrollment_status",
        ])
        .where("learning_paths.archived_at", "is", null)
        .$if(Boolean(input.topicId), (query) => query.where("learning_paths.topic_content_id", "=", input.topicId ?? ""))
        .$if(Boolean(input.cursor), (query) => query.where("learning_paths.id", ">", input.cursor ?? ""))
        .orderBy("learning_paths.id", "asc")
        .limit(input.limit + 1)
        .execute();
      const visible = rows.slice(0, input.limit);
      const versionIds = visible.map((row) => row.version_id);
      const aggregate = versionIds.length > 0
        ? await database.selectFrom("learning_path_units")
          .leftJoin("learning_path_steps", "learning_path_steps.unit_id", "learning_path_units.id")
          .leftJoin("learning_step_options", (join) => join
            .onRef("learning_step_options.step_id", "=", "learning_path_steps.id")
            .on("learning_step_options.is_default", "=", true))
          .select([
            "learning_path_units.path_version_id",
            sql<number>`count(distinct learning_path_units.id)::integer`.as("unit_count"),
            sql<number>`coalesce(sum(learning_step_options.estimated_minutes), 0)::integer`.as("minutes"),
          ])
          .where("learning_path_units.path_version_id", "in", versionIds)
          .groupBy("learning_path_units.path_version_id").execute()
        : [];
      return {
        items: visible.map((row) => {
          const counts = aggregate.find((value) => value.path_version_id === row.version_id);
          return {
            coverKey: LearningCoverKeySchema.parse(row.cover_key),
            enrollment: row.enrollment_id ? {
              completedAt: row.completed_at ? toIso(row.completed_at) : null,
              id: row.enrollment_id,
              pathVersionId: row.enrollment_version_id!,
              rowVersion: row.row_version!,
              status: row.enrollment_status!,
            } : null,
            estimatedMinutes: counts?.minutes ?? 0,
            id: row.id,
            slug: row.slug,
            summary: row.summary,
            title: row.title,
            topic: { id: row.topic_content_id, title: row.topic_title },
            unitCount: counts?.unit_count ?? 0,
          };
        }),
        nextCursor: rows.length > input.limit ? visible.at(-1)?.id ?? null : null,
      };
    },

    async transitionPath(input) {
      const access = await editorPath({
        actorUserId: input.actorUserId,
        canEditAll: input.canReview,
        pathId: input.pathId,
      });
      if (access.status !== "success") return access;
      if (!canTransitionLearningPath({
        actorUserId: input.actorUserId,
        canPublish: input.canPublish,
        canReview: input.canReview,
        createdBy: access.value.createdBy,
        currentStatus: access.value.version.status,
        targetStatus: input.status,
      })) return { status: "forbidden" };
      if (access.value.version.editVersion !== input.expectedVersion) return { status: "version_conflict" };

      let issues: LearningPathValidationIssue[] = [];
      if (["in_review", "approved", "published"].includes(input.status)) {
        issues = await storedValidation(database, access.value);
        if (issues.some((entry) => entry.severity === "error")) return { issues, status: "not_ready" };
      }
      try {
        const updated = await database.transaction().execute(async (transaction) => {
          const version = await transaction.selectFrom("learning_path_versions").selectAll()
            .where("id", "=", access.value.version.id).where("edit_version", "=", input.expectedVersion)
            .forUpdate().executeTakeFirst();
          if (!version) return null;
          const path = await transaction.selectFrom("learning_paths").selectAll()
            .where("id", "=", input.pathId).forUpdate().executeTakeFirstOrThrow();
          if (input.status === "archived") {
            const archivedPath = await transaction.updateTable("learning_paths")
              .set({ archived_at: new Date() }).where("id", "=", path.id)
              .returningAll().executeTakeFirstOrThrow();
            await writeAudit(transaction, {
              action: "learning_path_archived",
              actorUserId: input.actorUserId,
              pathId: path.id,
            });
            return { path: archivedPath, version };
          }
          const now = new Date();
          const nextVersion = await transaction.updateTable("learning_path_versions").set({
            edit_version: version.edit_version + 1,
            published_at: input.status === "published" ? now : version.published_at,
            published_by: input.status === "published" ? input.actorUserId : version.published_by,
            status: input.status,
          }).where("id", "=", version.id).where("edit_version", "=", version.edit_version)
            .returningAll().executeTakeFirst();
          if (!nextVersion) return null;
          let nextPath = path;
          if (input.status === "published") {
            nextPath = await transaction.updateTable("learning_paths")
              .set({ published_version_id: version.id })
              .where("id", "=", path.id).returningAll().executeTakeFirstOrThrow();
          }
          await writeAudit(transaction, {
            action: `learning_path_${input.status}`,
            actorUserId: input.actorUserId,
            metadata: { versionId: version.id },
            pathId: path.id,
          });
          return { path: nextPath, version: nextVersion };
        });
        return updated
          ? { status: "success", value: await readPathDetail(database, updated.path, updated.version) }
          : { status: "version_conflict" };
      } catch (error) {
        const failure = asFailure(error);
        if (failure) return { status: failure };
        throw error;
      }
    },

    async updateEnrollment(input) {
      const result = await database.transaction().execute(async (transaction) => {
        const current = await transaction.selectFrom("learning_enrollments")
          .innerJoin("learning_paths", "learning_paths.id", "learning_enrollments.path_id")
          .selectAll("learning_enrollments").select("learning_paths.slug")
          .where("learning_enrollments.id", "=", input.enrollmentId)
          .where("learning_enrollments.user_id", "=", input.userId)
          .forUpdate().executeTakeFirst();
        if (!current) return { kind: "not_found" as const };
        if (current.row_version !== input.expectedVersion) return { kind: "version_conflict" as const };
        const row = await transaction.updateTable("learning_enrollments").set({
          paused_at: input.status === "paused" ? new Date() : null,
          row_version: current.row_version + 1,
          status: input.status,
        }).where("id", "=", input.enrollmentId).where("row_version", "=", current.row_version)
          .returningAll().executeTakeFirst();
        return row
          ? { kind: "success" as const, row, slug: current.slug }
          : { kind: "version_conflict" as const };
      });
      if (result.kind !== "success") return { status: result.kind };
      return { status: "success", value: enrollmentResponse(result.row, result.slug) };
    },

    async upgradeEnrollment(input) {
      try {
        return await database.transaction().execute(async (transaction) => withLearningReceipt<LearningEnrollmentUpgradeResponse>(
          transaction,
          {
            idempotencyKey: input.idempotencyKey,
            request: {
              enrollmentId: input.enrollmentId,
              operation: "upgrade_enrollment",
              ...input.request,
            },
            responseSchema: LearningEnrollmentUpgradeResponseSchema,
            userId: input.userId,
          },
          async () => {
            const locked = await transaction.selectFrom("learning_enrollments")
              .selectAll()
              .where("id", "=", input.enrollmentId)
              .where("user_id", "=", input.userId)
              .forUpdate()
              .executeTakeFirst();
            if (!locked) return { status: "not_found" };
            if (locked.row_version !== input.request.expectedVersion) return { status: "version_conflict" };
            if (locked.status === "archived") return { status: "invalid_state" };

            const planning = await planLearningEnrollmentUpgrade(transaction, {
              enrollmentId: input.enrollmentId,
              targetPathVersionId: input.request.targetPathVersionId,
              userId: input.userId,
            });
            if (planning.status !== "success") return { status: planning.status };
            if (!planning.plan) return { status: "conflict" };
            const plan = planning.plan;
            if (plan.currentPathVersionId !== locked.path_version_id) return { status: "version_conflict" };
            if (plan.preview.activeAttempt) return { status: "active_attempt" };

            const adoptedAt = configuration.clock?.() ?? new Date();
            const mapping = {
              adoptedAt: adoptedAt.toISOString(),
              fromPathVersionId: plan.currentPathVersionId,
              objectiveMappings: plan.objectiveTransfers.map((entry) => ({
                currentObjectiveId: entry.objectiveId,
                targetObjectiveId: entry.objectiveId,
              })),
              schemaVersion: 1,
              stepMappings: plan.preview.steps.filter((step) => (
                step.kind === "equivalent" && step.currentStepId && step.targetStepId
              )).map((step) => ({
                currentStepId: step.currentStepId!,
                stableKey: step.stableKey,
                targetStepId: step.targetStepId!,
                transferred: step.transferable,
              })),
              toPathVersionId: plan.targetPathVersionId,
            };
            await transaction.insertInto("learning_enrollment_versions").values({
              adopted_at: adoptedAt,
              enrollment_id: locked.id,
              mapping_json: mapping as unknown as JsonValue,
              path_id: locked.path_id,
              path_version_id: plan.targetPathVersionId,
              previous_version_id: plan.currentPathVersionId,
            }).execute();

            if (plan.progressTransfers.length > 0) {
              await transaction.insertInto("learning_step_progress").values(
                plan.progressTransfers.map((transfer) => ({
                  completed_at: transfer.completedAt,
                  completion_method: transfer.completionMethod,
                  enrollment_id: locked.id,
                  evidence_attempt_id: transfer.evidenceAttemptId,
                  path_version_id: plan.targetPathVersionId,
                  row_version: transfer.rowVersion,
                  state: "completed" as const,
                  step_id: transfer.targetStepId,
                })),
              ).execute();
            }

            const objectiveIds = plan.objectiveTransfers.map((entry) => entry.objectiveId);
            if (objectiveIds.length > 0) {
              const objectiveRows = await transaction.selectFrom("learning_objective_progress")
                .selectAll()
                .where("enrollment_id", "=", locked.id)
                .where("path_version_id", "=", plan.currentPathVersionId)
                .where("objective_id", "in", objectiveIds)
                .execute();
              if (objectiveRows.length > 0) {
                await transaction.insertInto("learning_objective_progress").values(objectiveRows.map((row) => ({
                  enrollment_id: locked.id,
                  evidence_json: row.evidence_json,
                  evidence_state: row.evidence_state,
                  last_assessed_at: row.last_assessed_at,
                  objective_id: row.objective_id,
                  path_version_id: plan.targetPathVersionId,
                  policy_version: row.policy_version,
                }))).execute();
              }
            }

            const targetIsComplete = plan.preview.projectedProgress.totalEssentialSteps > 0
              && plan.preview.projectedProgress.percentage === 100;
            const enrollment = await transaction.updateTable("learning_enrollments").set({
              completed_at: targetIsComplete ? locked.completed_at ?? adoptedAt : null,
              path_version_id: plan.targetPathVersionId,
              row_version: locked.row_version + 1,
            }).where("id", "=", locked.id)
              .where("row_version", "=", locked.row_version)
              .returningAll()
              .executeTakeFirst();
            if (!enrollment) return { status: "version_conflict" };
            const progress = await readLearningEnrollmentProgress(transaction, locked.id, input.userId);
            if (!progress) return { status: "not_found" };
            return {
              status: "success",
              value: LearningEnrollmentUpgradeResponseSchema.parse({
                enrollment: enrollmentSummary(enrollment),
                pathSlug: plan.pathSlug,
                progress,
                transferredSteps: plan.progressTransfers.length,
              }),
            };
          },
        ));
      } catch (error) {
        const failure = asFailure(error);
        if (failure) return { status: failure };
        throw error;
      }
    },

    async updatePath(input) {
      const resolved = await resolveDefinition(resolver, input.update.definition);
      if (resolved.status !== "success") return resolved;
      try {
        const updated = await database.transaction().execute(async (transaction) => {
          const path = await transaction.selectFrom("learning_paths").selectAll()
            .where("id", "=", input.pathId).forUpdate().executeTakeFirst();
          if (!path || (!input.canEditAll && path.created_by !== input.actorUserId)) return { kind: "not_found" as const };
          const version = await latestVersion(transaction, path.id);
          if (!version) return { kind: "not_found" as const };
          if (!["draft", "changes_requested"].includes(version.status)) return { kind: "conflict" as const };
          if (version.edit_version !== input.update.expectedVersion) return { kind: "version_conflict" as const };
          const topic = await transaction.selectFrom("content_items").select("id")
            .where("id", "=", input.update.topicContentId).where("kind", "=", "topic")
            .executeTakeFirst();
          if (!topic) return { kind: "not_found" as const };
          const nextPath = await transaction.updateTable("learning_paths").set({
            cover_asset_id: null,
            cover_key: input.update.coverKey,
            slug: input.update.slug,
            summary: input.update.summary,
            title: input.update.title,
            topic_content_id: input.update.topicContentId,
          }).where("id", "=", path.id).returningAll().executeTakeFirstOrThrow();
          await transaction.deleteFrom("learning_path_units").where("path_version_id", "=", version.id).execute();
          await insertDefinition(transaction, version.id, resolved.value);
          const nextVersion = await transaction.updateTable("learning_path_versions").set({
            edit_version: version.edit_version + 1,
            policy_json: {
              ...guidedLearningPolicyV1,
              evidenceLevel: resolved.value.evidenceLevel,
            } as unknown as JsonValue,
            policy_version: resolved.value.policyVersion,
            release_notes: resolved.value.releaseNotes,
            status: "draft",
          }).where("id", "=", version.id).where("edit_version", "=", version.edit_version)
            .returningAll().executeTakeFirst();
          if (!nextVersion) return { kind: "version_conflict" as const };
          await writeAudit(transaction, {
            action: "learning_path_updated",
            actorUserId: input.actorUserId,
            metadata: { editVersion: nextVersion.edit_version, versionId: version.id },
            pathId: path.id,
          });
          return { kind: "success" as const, path: nextPath, version: nextVersion };
        });
        if (updated.kind !== "success") return { status: updated.kind };
        return { status: "success", value: await readPathDetail(database, updated.path, updated.version) };
      } catch (error) {
        const failure = asFailure(error);
        if (failure) return { status: failure };
        throw error;
      }
    },

    async validatePath(input) {
      const access = await editorPath(input);
      if (access.status !== "success") return access;
      const issues = await storedValidation(database, access.value);
      return {
        status: "success",
        value: { issues, ready: !issues.some((entry) => entry.severity === "error") },
      };
    },
  };
}
