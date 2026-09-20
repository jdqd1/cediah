import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type QueryResult,
} from "kysely";
import type { LearningPathCreateRequest, LearningPathDefinition, LearningPathDetail } from "@cediah/contracts";
import type { CediahDatabase } from "../src/db/database.js";
import { createPostgresGuidedLearningProvider } from "../src/providers/postgres-guided-learning.js";

const pg = new PGlite();
const creatorId = "81000000-0000-4000-8000-000000000001";
const otherCreatorId = "81000000-0000-4000-8000-000000000002";
const topicId = "81000000-0000-4000-8000-000000000003";
const materialId = "81000000-0000-4000-8000-000000000004";
const objectiveId = "81000000-0000-4000-8000-000000000005";

const connection: DatabaseConnection = {
  async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
    const result = await pg.query<R>(query.sql, [...query.parameters]);
    return { rows: result.rows, numAffectedRows: BigInt(result.affectedRows ?? 0) };
  },
  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    yield { rows: [] };
  },
};

const database = new Kysely<CediahDatabase>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createIntrospector: (db) => new PostgresIntrospector(db),
    createQueryCompiler: () => new PostgresQueryCompiler(),
    createDriver: () => ({
      acquireConnection: async () => connection,
      beginTransaction: async () => { await pg.exec("begin"); },
      commitTransaction: async () => { await pg.exec("commit"); },
      destroy: async () => {},
      init: async () => {},
      releaseConnection: async () => {},
      rollbackTransaction: async () => { await pg.exec("rollback"); },
    }),
  },
});

async function applyMigration(file: string) {
  const migration = await readFile(new URL(`../../../database/migrations/${file}`, import.meta.url), "utf8");
  await pg.exec(`begin;\n${migration}\ncommit;`);
}

function definition(itemIds: string[]): LearningPathDefinition {
  return {
    evidenceLevel: "standard",
    policyVersion: "guided-v1",
    releaseNotes: "",
    units: [{
      objectives: [{ id: objectiveId, importance: 3, title: "Identificar estructuras" }],
      pedagogyVersion: 3,
      stableKey: "unidad-torax",
      steps: [
        {
          isEssential: true,
          objectiveIds: [objectiveId],
          options: [{
            config: { objectiveMappings: [], selectedItemIds: [] },
            estimatedMinutes: 10,
            isDefault: true,
            label: "Ver video",
            projection: "video",
            rewardIdentity: "81000000-0000-4000-8000-000000000006",
            rewardVersion: 2,
            sourceContentId: materialId,
          }],
          pedagogyVersion: 4,
          purpose: "understand",
          recommendedAfter: [],
          stableKey: "actividad-comprender",
          title: "Comprender",
        },
        {
          isEssential: true,
          objectiveIds: [objectiveId],
          options: [{
            completionRule: { completion: "submitted", type: "quiz" },
            config: {
              objectiveMappings: itemIds.map((itemId) => ({ itemId, objectiveIds: [objectiveId] })),
              selectedItemIds: itemIds,
            },
            estimatedMinutes: 12,
            isDefault: true,
            label: "Responder cuestionario",
            projection: "quiz",
            rewardIdentity: "81000000-0000-4000-8000-000000000007",
            rewardVersion: 5,
            sourceContentId: materialId,
          }],
          pedagogyVersion: 6,
          purpose: "check",
          recommendedAfter: ["actividad-comprender"],
          stableKey: "actividad-practicar",
          title: "Practicar",
        },
      ],
      title: "Tórax",
    }],
  };
}

function updateDefinition(detail: LearningPathDetail): LearningPathDefinition {
  return {
    evidenceLevel: detail.version.evidenceLevel,
    policyVersion: detail.version.policyVersion,
    releaseNotes: detail.version.releaseNotes,
    units: detail.version.units.map((unit) => ({
      id: unit.id,
      objectives: unit.objectives,
      pedagogyVersion: unit.pedagogyVersion,
      stableKey: unit.stableKey,
      steps: unit.steps.map((step) => ({
        id: step.id,
        isEssential: step.isEssential,
        objectiveIds: step.objectiveIds,
        options: step.options.map((option) => ({
          completionRule: option.completionRule,
          config: option.config,
          estimatedMinutes: option.estimatedMinutes,
          id: option.id,
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

function updateRequest(detail: LearningPathDetail, nextDefinition = updateDefinition(detail)) {
  return {
    coverKey: detail.coverKey,
    definition: nextDefinition,
    expectedVersion: detail.version.editVersion,
    slug: detail.slug,
    summary: detail.summary,
    title: detail.title,
    topicContentId: detail.topic.id,
  };
}

const provider = createPostgresGuidedLearningProvider(database);
let itemIds: string[] = [];

beforeAll(async () => {
  await pg.exec(
    "create role cediah_runtime; create role anon; create role authenticated; "
      + "alter default privileges in schema public grant all on tables to anon, authenticated;",
  );
  for (const file of [
    "0001_auth.sql",
    "0002_platform.sql",
    "0003_content.sql",
    "0004_subjects.sql",
    "0006_simplify_platform_roles.sql",
    "0007_content_views.sql",
    "0008_content_reactions.sql",
  ]) await applyMigration(file);

  for (const [id, email] of [
    [creatorId, "editor.storage@example.test"],
    [otherCreatorId, "other.storage@example.test"],
  ]) {
    await pg.query("insert into auth_users (id, name, email) values ($1, 'Test', $2)", [id, email]);
  }
  await pg.query(
    `insert into content_items
      (id, kind, slug, title, summary, topic, content, author_user_id, status, published_by, published_at)
     values ($1, 'topic', 'tema-storage', 'Tema storage', 'Tema ficticio', 'Tórax', $2, $3, 'published', $3, now())`,
    [topicId, { introduction: "Tema", objectives: [], regions: ["Tórax"] }, creatorId],
  );
  const questions = Array.from({ length: 5 }, (_, index) => ({
    correctOptionIndex: 0,
    explanation: `Explicación ${index + 1}`,
    options: ["Correcta", "Distractor"],
    prompt: `Pregunta ${index + 1}`,
  }));
  await pg.query(
    `insert into content_items
      (id, kind, slug, title, summary, topic, content, estimated_minutes, author_user_id, status, published_by, published_at)
     values ($1, 'video', 'material-storage', 'Material storage', 'Material ficticio', 'Tórax', $2, 10, $3, 'published', $3, now())`,
    [materialId, {
      description: "Material",
      durationSeconds: 300,
      externalUrl: null,
      guide: { document: null, sections: [{ body: "Contenido", heading: "Sección" }] },
      keyPoints: ["Punto"],
      quiz: { questions },
      regions: ["Tórax"],
    }, creatorId],
  );
  await applyMigration("0009_learning_content_identity.sql");
  await applyMigration("0010_guided_learning_catalog.sql");
  await applyMigration("0011_guided_learning_attempts.sql");
  await applyMigration("0012_guided_learning_evidence.sql");
  await applyMigration("0013_guided_learning_rewards.sql");
  await applyMigration("0014_guided_learning_observability.sql");
  await applyMigration("0015_guided_learning_foreign_key_indexes.sql");
  await applyMigration("0016_learning_maps.sql");
  const normalized = await pg.query<{ content: { quiz: { questions: Array<{ id: string }> } } }>(
    "select content from content_items where id = $1",
    [materialId],
  );
  itemIds = normalized.rows[0]!.content.quiz.questions.map((question) => question.id);
}, 30_000);

afterAll(async () => {
  await database.destroy();
  await pg.close();
});

async function createReadyPath(slug: string) {
  const draft: LearningPathCreateRequest = {
    coverKey: "lungs",
    definition: definition(itemIds),
    slug,
    summary: "Ruta ficticia para probar conservación de revisiones.",
    title: "Ruta de almacenamiento",
    topicContentId: topicId,
  };
  const created = await provider.createPath({ actorUserId: creatorId, draft });
  if (created.status !== "success") throw new Error(`Expected path creation, received ${created.status}`);
  return created.value;
}

async function publish(detail: LearningPathDetail) {
  const review = await provider.transitionPath({
    actorUserId: creatorId,
    canPublish: false,
    canReview: false,
    expectedVersion: detail.version.editVersion,
    pathId: detail.id,
    status: "in_review",
  });
  if (review.status !== "success") throw new Error("Expected review transition");
  const approved = await provider.transitionPath({
    actorUserId: creatorId,
    canPublish: true,
    canReview: true,
    expectedVersion: review.value.version.editVersion,
    pathId: detail.id,
    status: "approved",
  });
  if (approved.status !== "success") throw new Error("Expected approval transition");
  const published = await provider.transitionPath({
    actorUserId: creatorId,
    canPublish: true,
    canReview: true,
    expectedVersion: approved.value.version.editVersion,
    pathId: detail.id,
    status: "published",
  });
  if (published.status !== "success") throw new Error("Expected publication transition");
  return published.value;
}

describe("guided-learning editor snapshot storage", () => {
  it("deletes an owned unpublished route without deleting shared materials", async () => {
    const created = await createReadyPath("storage-delete-draft");
    expect(await provider.deletePath({
      actorUserId: otherCreatorId,
      canEditAll: false,
      expectedVersion: created.version.editVersion,
      pathId: created.id,
    })).toEqual({ status: "not_found" });
    expect(await provider.deletePath({
      actorUserId: creatorId,
      canEditAll: false,
      expectedVersion: created.version.editVersion + 1,
      pathId: created.id,
    })).toEqual({ status: "version_conflict" });

    expect(await provider.deletePath({
      actorUserId: creatorId,
      canEditAll: false,
      expectedVersion: created.version.editVersion,
      pathId: created.id,
    })).toEqual({ status: "success", value: { id: created.id } });
    expect(await provider.getEditorPath({
      actorUserId: creatorId,
      canEditAll: false,
      pathId: created.id,
    })).toEqual({ status: "not_found" });
    expect((await pg.query<{ count: string }>(
      "select count(*)::text as count from content_items where id = $1",
      [materialId],
    )).rows[0]!.count).toBe("1");
    expect((await pg.query<{ action: string }>(
      "select action from audit_log where target_id = $1 order by occurred_at desc limit 1",
      [created.id],
    )).rows[0]!.action).toBe("learning_path_deleted");
  });

  it("does not delete a route after it has been published", async () => {
    const published = await publish(await createReadyPath("storage-delete-published"));
    expect(await provider.deletePath({
      actorUserId: creatorId,
      canEditAll: false,
      expectedVersion: published.version.editVersion,
      pathId: published.id,
    })).toEqual({ status: "conflict" });
    expect((await provider.getEditorPath({
      actorUserId: creatorId,
      canEditAll: false,
      pathId: published.id,
    })).status).toBe("success");
  });

  it("reads current and fixed material details without creating revisions or items", async () => {
    const countsBefore = await pg.query<{ items: string; revisions: string }>(
      `select
        (select count(*)::text from learning_items) as items,
        (select count(*)::text from learning_resource_revisions) as revisions`,
    );
    const current = await provider.getEditorMaterialDetail({
      actorUserId: creatorId,
      canEditAll: false,
      contentId: materialId,
      projection: "quiz",
    });
    expect(current).toMatchObject({
      status: "success",
      value: {
        currentSourceVersion: expect.any(Number),
        items: expect.arrayContaining([expect.objectContaining({ kind: "question", prompt: "Pregunta 1" })]),
        resourceRevisionId: null,
        status: "ready",
      },
    });
    const countsAfterCurrent = await pg.query<{ items: string; revisions: string }>(
      `select
        (select count(*)::text from learning_items) as items,
        (select count(*)::text from learning_resource_revisions) as revisions`,
    );
    expect(countsAfterCurrent.rows[0]).toEqual(countsBefore.rows[0]);

    const created = await createReadyPath("storage-readonly-detail");
    const fixedOption = created.version.units[0]!.steps[1]!.options[0]!;
    const fixedSourceVersion = current.status === "success" && current.value.status === "ready"
      ? current.value.sourceVersion
      : 1;
    await pg.query(
      "update content_items set version = version + 1, title = 'Título actual distinto' where id = $1",
      [materialId],
    );
    const countsBeforeFixed = await pg.query<{ items: string; revisions: string }>(
      `select
        (select count(*)::text from learning_items) as items,
        (select count(*)::text from learning_resource_revisions) as revisions`,
    );
    const fixed = await provider.getEditorOptionMaterialDetail({
      actorUserId: creatorId,
      canEditAll: false,
      optionId: fixedOption.id,
      pathId: created.id,
    });
    expect(fixed).toMatchObject({
      status: "success",
      value: {
        currentSourceVersion: fixedSourceVersion + 1,
        resourceRevisionId: fixedOption.resourceRevisionId,
        sourceVersion: fixedSourceVersion,
        status: "ready",
        title: "Material storage",
      },
    });
    const countsAfterFixed = await pg.query<{ items: string; revisions: string }>(
      `select
        (select count(*)::text from learning_items) as items,
        (select count(*)::text from learning_resource_revisions) as revisions`,
    );
    expect(countsAfterFixed.rows[0]).toEqual(countsBeforeFixed.rows[0]);
  });

  it("does not expose an option from another route and never reads unpublished current content", async () => {
    const first = await createReadyPath("storage-option-owner-a");
    const second = await createReadyPath("storage-option-owner-b");
    const foreignOption = first.version.units[0]!.steps[0]!.options[0]!;
    expect(await provider.getEditorOptionMaterialDetail({
      actorUserId: creatorId,
      canEditAll: false,
      optionId: foreignOption.id,
      pathId: second.id,
    })).toEqual({ status: "not_found" });

    await pg.query("update content_items set status = 'draft', published_at = null, published_by = null where id = $1", [materialId]);
    expect(await provider.getEditorMaterialDetail({
      actorUserId: creatorId,
      canEditAll: true,
      contentId: materialId,
      projection: "quiz",
    })).toEqual({ status: "not_found" });
    await pg.query("update content_items set status = 'published', published_at = now(), published_by = $2 where id = $1", [materialId, creatorId]);
  });

  it("reports a retired fixed material without exposing or rebuilding its snapshot", async () => {
    const created = await createReadyPath("storage-retired-fixed-detail");
    const fixedOption = created.version.units[0]!.steps[1]!.options[0]!;
    const countsBefore = await pg.query<{ items: string; revisions: string }>(
      `select
        (select count(*)::text from learning_items) as items,
        (select count(*)::text from learning_resource_revisions) as revisions`,
    );
    await pg.query(
      `update learning_resources
       set retired_at = now()
       where id = (select resource_id from learning_resource_revisions where id = $1)`,
      [fixedOption.resourceRevisionId],
    );

    const detail = await provider.getEditorOptionMaterialDetail({
      actorUserId: creatorId,
      canEditAll: false,
      optionId: fixedOption.id,
      pathId: created.id,
    });
    expect(detail).toEqual({
      status: "success",
      value: {
        reason: "retired",
        sourceContentId: materialId,
        status: "unavailable",
        title: "Título actual distinto",
      },
    });
    const countsAfter = await pg.query<{ items: string; revisions: string }>(
      `select
        (select count(*)::text from learning_items) as items,
        (select count(*)::text from learning_resource_revisions) as revisions`,
    );
    expect(countsAfter.rows[0]).toEqual(countsBefore.rows[0]);
    await pg.query(
      `update learning_resources
       set retired_at = null
       where id = (select resource_id from learning_resource_revisions where id = $1)`,
      [fixedOption.resourceRevisionId],
    );
  });

  it("preserves fixed revisions and custom config through cosmetic updates and version cloning", async () => {
    const created = await createReadyPath("storage-preserve");
    const originalOptions = created.version.units.flatMap((unit) => unit.steps).flatMap((step) => step.options);
    const originalRevisionIds = originalOptions.map((option) => option.resourceRevisionId);
    const originalQuiz = originalOptions.find((option) => option.projection === "quiz")!;

    await pg.query("update content_items set version = version + 1, title = 'Material storage actualizado' where id = $1", [materialId]);
    const cosmeticDefinition = updateDefinition(created);
    cosmeticDefinition.units[0]!.steps[1]!.options[0]!.label = "Etiqueta cosmética";
    const cosmetic = await provider.updatePath({
      actorUserId: creatorId,
      canEditAll: false,
      pathId: created.id,
      update: { ...updateRequest(created, cosmeticDefinition), title: "Ruta renombrada" },
    });
    expect(cosmetic.status).toBe("success");
    if (cosmetic.status !== "success") return;
    const cosmeticOptions = cosmetic.value.version.units.flatMap((unit) => unit.steps).flatMap((step) => step.options);
    expect(cosmeticOptions.map((option) => option.resourceRevisionId)).toEqual(originalRevisionIds);
    expect(cosmeticOptions.find((option) => option.projection === "quiz")!.config).toEqual(originalQuiz.config);
    expect(cosmeticOptions.find((option) => option.projection === "quiz")!.completionRule).toEqual(originalQuiz.completionRule);

    const published = await publish(cosmetic.value);
    const clone = await provider.createVersion({
      actorUserId: creatorId,
      canEditAll: false,
      pathId: published.id,
      releaseNotes: "Nueva versión sin actualizar materiales",
    });
    expect(clone.status).toBe("success");
    if (clone.status !== "success") return;
    const clonedOptions = clone.value.version.units.flatMap((unit) => unit.steps).flatMap((step) => step.options);
    expect(clonedOptions.map((option) => option.resourceRevisionId)).toEqual(originalRevisionIds);
    expect(clone.value.version.units[0]!.id).not.toBe(published.version.units[0]!.id);
    expect(clone.value.version.units[0]!.steps[0]!.id).not.toBe(published.version.units[0]!.steps[0]!.id);
    expect(clonedOptions[0]!.id).not.toBe(published.version.units[0]!.steps[0]!.options[0]!.id);
    expect(clone.value.version.units[0]!.stableKey).toBe(published.version.units[0]!.stableKey);
    expect(clonedOptions[1]!.rewardIdentity).toBe(originalQuiz.rewardIdentity);
  }, 30_000);

  it("removes a unit only from the new draft and preserves the published version and learning records", async () => {
    const created = await createReadyPath("storage-delete-unit-versioned");
    const published = await publish(created);
    const enrollment = await provider.createEnrollment({
      pathId: published.id,
      userId: otherCreatorId,
    });
    expect(enrollment.status).toBe("success");
    const countsBefore = await pg.query<{ attempts: string; enrollments: string; rewards: string }>(
      `select
        (select count(*)::text from learning_attempts) as attempts,
        (select count(*)::text from learning_enrollments) as enrollments,
        (select count(*)::text from learning_rewards) as rewards`,
    );
    const publishedUnitsBefore = await pg.query<{ stable_key: string }>(
      "select stable_key from learning_path_units where path_version_id = $1 order by position",
      [published.version.id],
    );

    const clone = await provider.createVersion({
      actorUserId: creatorId,
      canEditAll: false,
      pathId: published.id,
      releaseNotes: "Retirar unidad solo en la versión siguiente",
    });
    expect(clone.status).toBe("success");
    if (clone.status !== "success") return;
    const removed = await provider.updatePath({
      actorUserId: creatorId,
      canEditAll: false,
      pathId: clone.value.id,
      update: {
        ...updateRequest(clone.value),
        definition: {
          ...updateDefinition(clone.value),
          units: [],
        },
      },
    });
    expect(removed.status).toBe("success");
    if (removed.status !== "success") return;

    const reloaded = await provider.getEditorPath({
      actorUserId: creatorId,
      canEditAll: false,
      pathId: clone.value.id,
    });
    expect(reloaded).toMatchObject({
      status: "success",
      value: {
        version: {
          editVersion: clone.value.version.editVersion + 1,
          id: clone.value.version.id,
          number: 2,
          units: [],
        },
      },
    });
    const publishedUnitsAfter = await pg.query<{ stable_key: string }>(
      "select stable_key from learning_path_units where path_version_id = $1 order by position",
      [published.version.id],
    );
    expect(publishedUnitsAfter.rows).toEqual(publishedUnitsBefore.rows);
    expect(publishedUnitsAfter.rows).toEqual([{ stable_key: "unidad-torax" }]);
    const storedEnrollment = await pg.query<{ path_version_id: string }>(
      "select path_version_id from learning_enrollments where user_id = $1 and path_id = $2",
      [otherCreatorId, published.id],
    );
    expect(storedEnrollment.rows).toEqual([{ path_version_id: published.version.id }]);
    const countsAfter = await pg.query<{ attempts: string; enrollments: string; rewards: string }>(
      `select
        (select count(*)::text from learning_attempts) as attempts,
        (select count(*)::text from learning_enrollments) as enrollments,
        (select count(*)::text from learning_rewards) as rewards`,
    );
    expect(countsAfter.rows[0]).toEqual(countsBefore.rows[0]);
  }, 30_000);

  it("rejects edits throughout review and publication and never clones an archived route", async () => {
    const created = await createReadyPath("storage-immutable-workflow");
    const review = await provider.transitionPath({
      actorUserId: creatorId,
      canPublish: false,
      canReview: false,
      expectedVersion: created.version.editVersion,
      pathId: created.id,
      status: "in_review",
    });
    expect(review.status).toBe("success");
    if (review.status !== "success") return;
    expect(await provider.updatePath({
      actorUserId: creatorId,
      canEditAll: false,
      pathId: created.id,
      update: updateRequest(review.value),
    })).toEqual({ status: "conflict" });

    const approved = await provider.transitionPath({
      actorUserId: creatorId,
      canPublish: true,
      canReview: true,
      expectedVersion: review.value.version.editVersion,
      pathId: created.id,
      status: "approved",
    });
    expect(approved.status).toBe("success");
    if (approved.status !== "success") return;
    expect(await provider.updatePath({
      actorUserId: creatorId,
      canEditAll: false,
      pathId: created.id,
      update: updateRequest(approved.value),
    })).toEqual({ status: "conflict" });

    const published = await provider.transitionPath({
      actorUserId: creatorId,
      canPublish: true,
      canReview: true,
      expectedVersion: approved.value.version.editVersion,
      pathId: created.id,
      status: "published",
    });
    expect(published.status).toBe("success");
    if (published.status !== "success") return;
    expect(await provider.updatePath({
      actorUserId: creatorId,
      canEditAll: false,
      pathId: created.id,
      update: updateRequest(published.value),
    })).toEqual({ status: "conflict" });

    const archived = await provider.transitionPath({
      actorUserId: creatorId,
      canPublish: true,
      canReview: true,
      expectedVersion: published.value.version.editVersion,
      pathId: created.id,
      status: "archived",
    });
    expect(archived).toMatchObject({
      status: "success",
      value: { archivedAt: expect.any(String), version: { status: "published" } },
    });
    expect(await provider.createVersion({
      actorUserId: creatorId,
      canEditAll: false,
      pathId: created.id,
      releaseNotes: "No debe crearse",
    })).toEqual({ status: "conflict" });
  }, 30_000);

  it("rejects stale explicit refresh without partial metadata writes", async () => {
    const created = await createReadyPath("storage-stale-refresh");
    const nextDefinition = updateDefinition(created);
    const option = nextDefinition.units[0]!.steps[1]!.options[0]!;
    option.expectedSourceVersion = 1;
    option.refreshResource = true;
    const result = await provider.updatePath({
      actorUserId: creatorId,
      canEditAll: false,
      pathId: created.id,
      update: { ...updateRequest(created, nextDefinition), title: "No debe persistir" },
    });
    expect(result).toMatchObject({
      issues: [{
        code: "resource_changed",
        context: {
          optionId: option.id,
          sourceContentId: materialId,
          stepStableKey: "actividad-practicar",
          unitStableKey: "unidad-torax",
        },
        severity: "error",
      }],
      status: "not_ready",
    });
    const stored = await provider.getEditorPath({ actorUserId: creatorId, canEditAll: false, pathId: created.id });
    expect(stored).toMatchObject({
      status: "success",
      value: { title: "Ruta de almacenamiento", version: { editVersion: created.version.editVersion } },
    });
  });

  it("rolls back metadata, definition and audit when definition insertion fails", async () => {
    const created = await createReadyPath("storage-rollback");
    const duplicateDefinition = updateDefinition(created);
    duplicateDefinition.units.push({ ...duplicateDefinition.units[0]! });
    const auditsBefore = await pg.query<{ count: string }>(
      "select count(*)::text as count from audit_log where target_id = $1",
      [created.id],
    );
    const result = await provider.updatePath({
      actorUserId: creatorId,
      canEditAll: false,
      pathId: created.id,
      update: { ...updateRequest(created, duplicateDefinition), summary: "No debe persistir" },
    });
    expect(result).toEqual({ status: "conflict" });
    const stored = await provider.getEditorPath({ actorUserId: creatorId, canEditAll: false, pathId: created.id });
    expect(stored).toMatchObject({
      status: "success",
      value: {
        summary: "Ruta ficticia para probar conservación de revisiones.",
        version: { editVersion: created.version.editVersion, units: [{ title: "Tórax" }] },
      },
    });
    const auditsAfter = await pg.query<{ count: string }>(
      "select count(*)::text as count from audit_log where target_id = $1",
      [created.id],
    );
    expect(auditsAfter.rows[0]!.count).toBe(auditsBefore.rows[0]!.count);
  });

  it("checks path access before invoking material resolution", async () => {
    const created = await createReadyPath("storage-access-first");
    let resolutions = 0;
    const guardedProvider = createPostgresGuidedLearningProvider(database, {
      resolver: {
        resolvePublishedRevision: async () => {
          resolutions += 1;
          throw new Error("resolver must not run before authorization");
        },
      },
    });
    const result = await guardedProvider.updatePath({
      actorUserId: otherCreatorId,
      canEditAll: false,
      pathId: created.id,
      update: updateRequest(created),
    });
    expect(result).toEqual({ status: "not_found" });
    expect(resolutions).toBe(0);
  });

  it("validates the exact saved edit version and reports the confirmed version", async () => {
    const created = await createReadyPath("storage-validate-version");
    expect(await provider.validatePath({
      actorUserId: creatorId,
      canEditAll: false,
      expectedVersion: created.version.editVersion + 1,
      pathId: created.id,
    })).toEqual({ status: "version_conflict" });

    const validated = await provider.validatePath({
      actorUserId: creatorId,
      canEditAll: false,
      expectedVersion: created.version.editVersion,
      pathId: created.id,
    });
    expect(validated).toMatchObject({
      status: "success",
      value: { ready: true, validatedEditVersion: created.version.editVersion },
    });
  });
});
