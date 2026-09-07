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
import type {
  LearningAttemptMutationResponse,
  LearningPathCreateRequest,
  LearningPathDefinition,
} from "@cediah/contracts";
import type { CediahDatabase } from "../src/db/database.js";
import { reviewTaskKey } from "../src/guided-learning/review-scheduler.js";
import { awardAppliedReview } from "../src/guided-learning/rewards.js";
import { hashLearningSnapshot } from "../src/guided-learning/snapshot-hash.js";
import { createPostgresGuidedLearningProvider } from "../src/providers/postgres-guided-learning.js";

const pg = new PGlite();
const creatorId = "20000000-0000-4000-8000-000000000001";
const coordinatorId = "20000000-0000-4000-8000-000000000002";
const studentId = "20000000-0000-4000-8000-000000000003";
const otherStudentId = "20000000-0000-4000-8000-000000000004";
const topicId = "30000000-0000-4000-8000-000000000001";
const videoId = "30000000-0000-4000-8000-000000000002";

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

let clockNow = new Date("2026-09-06T12:00:00.000Z");
const provider = createPostgresGuidedLearningProvider(database, { clock: () => clockNow });
let itemIds: string[] = [];
let publishedPathId = "";
let publishedVersionId = "";
let enrollmentId = "";

async function applyMigration(file: string) {
  const migration = await readFile(
    new URL(`../../../database/migrations/${file}`, import.meta.url),
    "utf8",
  );
  await pg.exec(`begin;\n${migration}\ncommit;`);
}

function option(input: {
  default: boolean;
  label: string;
  objectiveId: string;
  projection: "video" | "guide" | "quiz" | "flashcards";
  rewardIdentity: string;
  selectedItemIds?: string[];
}) {
  const selected = input.selectedItemIds ?? [];
  return {
    config: {
      objectiveMappings: selected.map((itemId) => ({
        itemId,
        objectiveIds: [input.objectiveId],
      })),
      selectedItemIds: selected,
    },
    estimatedMinutes: 5,
    isDefault: input.default,
    label: input.label,
    projection: input.projection,
    rewardIdentity: input.rewardIdentity,
    rewardVersion: 1,
    sourceContentId: videoId,
  } as const;
}

function definition(selectedItemIds = itemIds): LearningPathDefinition {
  return {
    evidenceLevel: "standard",
    policyVersion: "guided-v1",
    releaseNotes: "Fixture académico ficticio para pruebas automatizadas.",
    units: [0, 1].map((index) => {
      const objectiveId = `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
      const comprehensionReward = `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
      return {
        objectives: [{ id: objectiveId, importance: 3, title: `Objetivo ${index + 1}` }],
        pedagogyVersion: 1,
        stableKey: `unidad-${index + 1}`,
        steps: [
          {
            isEssential: true,
            objectiveIds: [objectiveId],
            options: [
              option({ default: true, label: "Ver video", objectiveId, projection: "video", rewardIdentity: comprehensionReward }),
              option({ default: false, label: "Leer guía", objectiveId, projection: "guide", rewardIdentity: comprehensionReward }),
            ],
            pedagogyVersion: 1,
            purpose: "understand" as const,
            recommendedAfter: [],
            stableKey: `comprender-${index + 1}`,
            title: "Comprender con el formato que prefieras",
          },
          {
            isEssential: true,
            objectiveIds: [objectiveId],
            options: [option({
              default: true,
              label: "Recordar con tarjetas",
              objectiveId,
              projection: "flashcards",
              rewardIdentity: `51000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
              selectedItemIds,
            })],
            pedagogyVersion: 1,
            purpose: "recall" as const,
            recommendedAfter: [`comprender-${index + 1}`],
            stableKey: `recordar-${index + 1}`,
            title: "Recuperar lo aprendido",
          },
          {
            isEssential: true,
            objectiveIds: [objectiveId],
            options: [option({
              default: true,
              label: "Comprobar con preguntas",
              objectiveId,
              projection: "quiz",
              rewardIdentity: `52000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
              selectedItemIds,
            })],
            pedagogyVersion: 1,
            purpose: "check" as const,
            recommendedAfter: [`recordar-${index + 1}`],
            stableKey: `comprobar-${index + 1}`,
            title: "Comprobar comprensión",
          },
        ],
        title: `Unidad ${index + 1}`,
      };
    }),
  };
}

function routeDraft(slug: string, selectedItemIds = itemIds): LearningPathCreateRequest {
  return {
    coverKey: "lungs",
    definition: definition(selectedItemIds),
    slug,
    summary: "Ruta ficticia para demostrar persistencia, alternativas y validación.",
    title: "Ruta completa de prueba",
    topicContentId: topicId,
  };
}

beforeAll(async () => {
  await pg.exec(
    "create role cediah_runtime; create role anon; create role authenticated; " +
      "alter default privileges in schema public grant all on tables to anon, authenticated;",
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
    [creatorId, "creator@example.test"],
    [coordinatorId, "coordinator@example.test"],
    [studentId, "student@example.test"],
    [otherStudentId, "other@example.test"],
  ]) {
    await pg.query("insert into auth_users (id, name, email) values ($1, 'Test', $2)", [id, email]);
  }
  await pg.query(
    `insert into content_items
      (id, kind, slug, title, summary, topic, content, author_user_id, status, published_by, published_at)
     values ($1, 'topic', 'torax-prueba', 'Tórax de prueba', 'Tema ficticio', 'Tórax', $2, $3, 'published', $3, now())`,
    [topicId, { introduction: "Solo fixture.", objectives: ["Probar el flujo"], regions: ["Tórax"] }, creatorId],
  );
  const questions = Array.from({ length: 5 }, (_, index) => ({
    correctOptionIndex: 0,
    explanation: `Explicación verificable ${index + 1}`,
    options: ["Respuesta", "Distractor"],
    prompt: `Pregunta ficticia ${index + 1}`,
  }));
  await pg.query(
    `insert into content_items
      (id, kind, slug, title, summary, topic, content, estimated_minutes, author_user_id, status, published_by, published_at)
     values ($1, 'video', 'video-ruta-prueba', 'Video de prueba', 'Material ficticio', 'Tórax', $2, 10, $3, 'published', $3, now())`,
    [videoId, {
      description: "Material ficticio para pruebas.",
      durationSeconds: 300,
      externalUrl: "https://example.test/video",
      guide: { document: null, sections: [{ body: "Contenido de prueba", heading: "Sección" }] },
      keyPoints: ["Punto de prueba"],
      quiz: { questions },
      regions: ["Tórax"],
    }, creatorId],
  );
  await applyMigration("0009_learning_content_identity.sql");
  await applyMigration("0010_guided_learning_catalog.sql");
  await applyMigration("0011_guided_learning_attempts.sql");
  await applyMigration("0012_guided_learning_evidence.sql");
  await applyMigration("0013_guided_learning_rewards.sql");
  const normalized = await pg.query<{ content: { quiz: { questions: Array<{ id: string }> } } }>(
    "select content from content_items where id = $1",
    [videoId],
  );
  itemIds = normalized.rows[0]!.content.quiz.questions.map((question) => question.id);
}, 30_000);

afterAll(async () => {
  await database.destroy();
  await pg.close();
});

describe("guided-learning catalog and versioning", () => {
  it("creates, validates and publishes a real relational route with four projections", async () => {
    const created = await provider.createPath({ actorUserId: creatorId, draft: routeDraft("ruta-completa") });
    expect(created.status).toBe("success");
    if (created.status !== "success") throw new Error("Expected path creation");
    publishedPathId = created.value.id;
    expect(created.value.version.units).toHaveLength(2);
    expect(created.value.version.units[0]?.steps[0]?.options.map((value) => value.projection))
      .toEqual(["video", "guide"]);

    const validation = await provider.validatePath({ actorUserId: creatorId, canEditAll: false, pathId: publishedPathId });
    expect(validation).toEqual({ status: "success", value: { issues: [], ready: true } });

    const inReview = await provider.transitionPath({ actorUserId: creatorId, canPublish: false, canReview: false, expectedVersion: 1, pathId: publishedPathId, status: "in_review" });
    expect(inReview.status).toBe("success");
    const approved = await provider.transitionPath({ actorUserId: coordinatorId, canPublish: true, canReview: true, expectedVersion: 2, pathId: publishedPathId, status: "approved" });
    expect(approved.status).toBe("success");
    const published = await provider.transitionPath({ actorUserId: coordinatorId, canPublish: true, canReview: true, expectedVersion: 3, pathId: publishedPathId, status: "published" });
    expect(published.status).toBe("success");
    if (published.status !== "success") throw new Error("Expected publication");
    publishedVersionId = published.value.version.id;
    expect(published.value.version.status).toBe("published");
  });

  it("shows every unit without prerequisite gating and pins an idempotent enrollment", async () => {
    const catalog = await provider.listPublishedPaths({ limit: 20, userId: studentId });
    expect(catalog.items).toHaveLength(1);
    expect(catalog.items[0]).toMatchObject({ enrollment: null, unitCount: 2 });
    const detail = await provider.getPathBySlug({ slug: "ruta-completa", userId: studentId });
    expect(detail?.version.units[1]?.steps[2]?.options[0]).toMatchObject({ projection: "quiz" });

    const first = await provider.createEnrollment({ pathId: publishedPathId, userId: studentId });
    const repeated = await provider.createEnrollment({ pathId: publishedPathId, userId: studentId });
    expect(first.status).toBe("success");
    expect(repeated).toEqual(first);
    if (first.status !== "success") throw new Error("Expected enrollment");
    enrollmentId = first.value.enrollment.id;
    expect(first.value.enrollment.pathVersionId).toBe(publishedVersionId);

    const membership = await pg.query<{ count: string }>(
      "select count(*)::text as count from learning_enrollment_versions where enrollment_id = $1",
      [enrollmentId],
    );
    expect(membership.rows[0]?.count).toBe("1");
  });

  it("keeps enrollment writes owned and optimistic", async () => {
    expect((await provider.updateEnrollment({ enrollmentId, expectedVersion: 1, status: "paused", userId: otherStudentId })).status)
      .toBe("not_found");
    const paused = await provider.updateEnrollment({ enrollmentId, expectedVersion: 1, status: "paused", userId: studentId });
    expect(paused.status).toBe("success");
    expect(await provider.listLibraryOptions({ projection: "quiz", sourceContentId: videoId, userId: studentId }))
      .toEqual([]);
    expect((await provider.updateEnrollment({ enrollmentId, expectedVersion: 1, status: "active", userId: studentId })).status)
      .toBe("version_conflict");
    expect((await provider.updateEnrollment({ enrollmentId, expectedVersion: 2, status: "active", userId: studentId })).status)
      .toBe("success");
    const tracked = await provider.listLibraryOptions({ projection: "quiz", sourceContentId: videoId, userId: studentId });
    expect(tracked).toHaveLength(2);
    expect(tracked[0]).toMatchObject({ pathTitle: "Ruta completa de prueba", projection: "quiz" });
    expect(tracked[0]?.href).toContain("/aprendizaje/rutas/ruta-completa/actividades/");
    expect(await provider.listLibraryOptions({ projection: "quiz", sourceContentId: videoId, userId: otherStudentId }))
      .toEqual([]);
  });

  it("persists and resumes a server-graded quiz without leaking future solutions", async () => {
    const detail = await provider.getPathBySlug({ slug: "ruta-completa", userId: studentId });
    const optionId = detail?.version.units[1]?.steps[2]?.options[0]?.id;
    if (!optionId) throw new Error("Expected a freely accessible option in the last unit");
    const created = await provider.createAttempt({
      idempotencyKey: "61000000-0000-4000-8000-000000000001",
      request: { clientAttemptId: "62000000-0000-4000-8000-000000000001", stepOptionId: optionId },
      userId: studentId,
    });
    expect(created.status).toBe("success");
    if (created.status !== "success" || created.value.attempt.manifest.projection !== "quiz") {
      throw new Error("Expected quiz attempt");
    }
    const attemptId = created.value.attempt.id;
    const questions = created.value.attempt.manifest.questions;
    expect(JSON.stringify(created.value.attempt.manifest)).not.toContain("correctOption");
    expect(JSON.stringify(created.value.attempt.manifest)).not.toContain("Explicación verificable");

    let current = created.value.attempt;
    for (let index = 0; index < questions.length; index += 1) {
      const question = questions[index]!;
      const wrongOption = question.options.find((entry) => entry.text === "Distractor")!;
      const idempotencyKey = `61000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`;
      const request = {
        expectedVersion: current.rowVersion,
        itemId: question.itemId,
        kind: "quiz" as const,
        optionId: wrongOption.id,
        round: 1,
      };
      const answered = await provider.recordAttemptResponse({ attemptId, idempotencyKey, request, userId: studentId });
      expect(answered.status).toBe("success");
      if (answered.status !== "success") throw new Error("Expected saved answer");
      if (index === 0) {
        const replay = await provider.recordAttemptResponse({ attemptId, idempotencyKey, request, userId: studentId });
        expect(replay).toEqual(answered);
        const conflict = await provider.recordAttemptResponse({
          attemptId,
          idempotencyKey,
          request: { ...request, optionId: question.options[0]!.id },
          userId: studentId,
        });
        expect(conflict.status).toBe("idempotency_conflict");
      }
      current = answered.value.attempt;
      if (index === 1) {
        const resumed = await provider.getAttempt({ attemptId, userId: studentId });
        expect(resumed.status).toBe("success");
        if (resumed.status === "success") {
          expect(resumed.value.responses).toHaveLength(2);
          expect(resumed.value.resume.currentIndex).toBe(2);
        }
      }
    }
    expect(current.status).toBe("completed");
    expect(current.score).toMatchObject({ answered: 5, correct: 0, percent: 0, total: 5 });
    expect((await provider.getAttempt({ attemptId, userId: otherStudentId })).status).toBe("not_found");
    const counts = await pg.query<{ events: string; responses: string }>(
      `select
        (select count(*)::text from learning_responses where attempt_id = $1) as responses,
        (select count(*)::text from learning_events where attempt_id = $1 and event_type = 'activity_completed') as events`,
      [attemptId],
    );
    expect(counts.rows[0]).toEqual({ events: "1", responses: "5" });
  });

  it("requires flashcard reveal and explicit guide/video completion while one alternative counts once", async () => {
    const detail = await provider.getPathBySlug({ slug: "ruta-completa", userId: studentId });
    const recallOption = detail?.version.units[1]?.steps[1]?.options[0];
    const guideOption = detail?.version.units[1]?.steps[0]?.options.find((entry) => entry.projection === "guide");
    const videoOption = detail?.version.units[1]?.steps[0]?.options.find((entry) => entry.projection === "video");
    if (!recallOption || !guideOption || !videoOption) throw new Error("Expected all activity formats");

    const cards = await provider.createAttempt({
      idempotencyKey: "63000000-0000-4000-8000-000000000001",
      request: { clientAttemptId: "64000000-0000-4000-8000-000000000001", stepOptionId: recallOption.id },
      userId: studentId,
    });
    if (cards.status !== "success" || cards.value.attempt.manifest.projection !== "flashcards") throw new Error("Expected cards");
    const cardManifest = cards.value.attempt.manifest;
    expect(JSON.stringify(cards.value.attempt.manifest)).not.toContain("Respuesta");
    let cardAttempt = cards.value.attempt;
    const firstCard = cardManifest.cards[0]!;
    expect((await provider.recordAttemptResponse({
      attemptId: cardAttempt.id,
      idempotencyKey: "63000000-0000-4000-8000-000000000002",
      request: { expectedVersion: cardAttempt.rowVersion, itemId: firstCard.itemId, kind: "flashcards", recallGrade: "good", round: 1 },
      userId: studentId,
    })).status).toBe("invalid_state");
    for (let index = 0; index < cardManifest.cards.length; index += 1) {
      const card = cardManifest.cards[index]!;
      const revealed = await provider.revealAttemptItem({
        attemptId: cardAttempt.id,
        expectedVersion: cardAttempt.rowVersion,
        idempotencyKey: `63000000-0000-4000-8001-${String(index + 1).padStart(12, "0")}`,
        itemId: card.itemId,
        userId: studentId,
      });
      if (revealed.status !== "success") throw new Error("Expected reveal");
      expect(revealed.value.attempt.revealedCards.some((entry) => entry.itemId === card.itemId)).toBe(true);
      const rated = await provider.recordAttemptResponse({
        attemptId: cardAttempt.id,
        idempotencyKey: `63000000-0000-4000-8002-${String(index + 1).padStart(12, "0")}`,
        request: { expectedVersion: revealed.value.attempt.rowVersion, itemId: card.itemId, kind: "flashcards", recallGrade: "hard", round: 1 },
        userId: studentId,
      });
      if (rated.status !== "success") throw new Error("Expected rating");
      cardAttempt = rated.value.attempt;
    }
    expect(cardAttempt.status).toBe("completed");

    const guide = await provider.createAttempt({
      idempotencyKey: "65000000-0000-4000-8000-000000000001",
      request: { clientAttemptId: "66000000-0000-4000-8000-000000000001", stepOptionId: guideOption.id },
      userId: studentId,
    });
    if (guide.status !== "success") throw new Error("Expected guide");
    const savedPosition = await provider.updateAttemptResume({
      attemptId: guide.value.attempt.id,
      idempotencyKey: "65000000-0000-4000-8000-000000000002",
      request: { expectedVersion: guide.value.attempt.rowVersion, kind: "guide", offsetPercent: 55, sectionIndex: 0 },
      userId: studentId,
    });
    if (savedPosition.status !== "success") throw new Error("Expected guide position");
    expect(savedPosition.value.attempt.resume.guidePosition).toEqual({ offsetPercent: 55, sectionIndex: 0 });
    expect((await provider.completeAttempt({
      attemptId: guide.value.attempt.id,
      idempotencyKey: "65000000-0000-4000-8000-000000000003",
      request: { expectedVersion: savedPosition.value.attempt.rowVersion },
      userId: studentId,
    })).status).toBe("invalid_state");
    const guideDone = await provider.completeAttempt({
      attemptId: guide.value.attempt.id,
      idempotencyKey: "65000000-0000-4000-8000-000000000004",
      request: { confirmation: true, expectedVersion: savedPosition.value.attempt.rowVersion },
      userId: studentId,
    });
    expect(guideDone.status).toBe("success");
    if (guideDone.status === "success") {
      expect(guideDone.value.awards.map((award) => award.kind)).toEqual([
        "activity_understand",
        "unit_completed",
        "milestone_first_unit",
      ]);
      expect(guideDone.value.awards.reduce((total, award) => total + award.xp, 0)).toBe(30);
    }

    const video = await provider.createAttempt({
      idempotencyKey: "67000000-0000-4000-8000-000000000001",
      request: { clientAttemptId: "68000000-0000-4000-8000-000000000001", stepOptionId: videoOption.id },
      userId: studentId,
    });
    if (video.status !== "success") throw new Error("Expected video");
    const jumped = await provider.updateAttemptResume({
      attemptId: video.value.attempt.id,
      idempotencyKey: "67000000-0000-4000-8000-000000000002",
      request: { expectedVersion: video.value.attempt.rowVersion, kind: "video", observedRanges: [{ startSeconds: 299, endSeconds: 300 }], positionSeconds: 300 },
      userId: studentId,
    });
    if (jumped.status !== "success") throw new Error("Expected video position");
    expect(jumped.value.attempt.status).toBe("in_progress");
    expect((await provider.completeAttempt({
      attemptId: video.value.attempt.id,
      idempotencyKey: "67000000-0000-4000-8000-000000000003",
      request: { expectedVersion: jumped.value.attempt.rowVersion },
      userId: studentId,
    }))).toMatchObject({ status: "invalid_state" });
    const videoDone = await provider.completeAttempt({
      attemptId: video.value.attempt.id,
      idempotencyKey: "67000000-0000-4000-8000-000000000004",
      request: { confirmation: true, expectedVersion: jumped.value.attempt.rowVersion },
      userId: studentId,
    });
    expect(videoDone.status).toBe("success");
    if (videoDone.status === "success") expect(videoDone.value.awards).toEqual([]);

    const oneStep = await pg.query<{ count: string }>(
      "select count(*)::text as count from learning_step_progress where enrollment_id = $1 and step_id = $2 and state = 'completed'",
      [enrollmentId, guide.value.attempt.stepId],
    );
    expect(oneStep.rows[0]?.count).toBe("1");
  });

  it("builds deterministic review sessions and keeps stale devices from advancing memory twice", async () => {
    clockNow = new Date("2026-09-06T12:11:00.000Z");
    const progress = await provider.getEnrollmentProgress({ enrollmentId, userId: studentId });
    expect(progress.status).toBe("success");
    if (progress.status !== "success") throw new Error("Expected progress");
    expect(progress.value.percentage).toBe(50);
    expect(progress.value.units[1]?.objectives[0]).toMatchObject({
      distinctQuestions: 5,
      evidenceLimited: false,
      lastCheckPercent: 0,
      state: "practicing",
    });

    const home = await provider.getHome({ minutes: 5, userId: studentId });
    expect(home.counts).toMatchObject({ activePaths: 1, dueReviews: 5, pendingEssentialSteps: 3 });
    expect(home.tasks[0]).toMatchObject({ band: 0, itemCount: 5, kind: "review", reason: "Repaso prioritario" });
    expect(home.tasks[0]?.taskKeys).toHaveLength(5);

    const firstSession = await provider.createReviewSession({
      idempotencyKey: "69000000-0000-4000-8000-000000000001",
      request: { clientAttemptId: "69000000-0000-4000-8001-000000000001", sessionMinutes: 5 },
      userId: studentId,
    });
    const secondSession = await provider.createReviewSession({
      idempotencyKey: "69000000-0000-4000-8000-000000000002",
      request: { clientAttemptId: "69000000-0000-4000-8001-000000000002", sessionMinutes: 5 },
      userId: studentId,
    });
    if (firstSession.status !== "success" || secondSession.status !== "success" ||
      firstSession.value.attempt.manifest.projection !== "review" ||
      secondSession.value.attempt.manifest.projection !== "review") {
      throw new Error("Expected two frozen review sessions");
    }
    const firstManifest = firstSession.value.attempt.manifest;
    expect(firstManifest.items).toHaveLength(5);
    expect(new Set(firstManifest.items.map((item) => item.itemId)).size).toBe(5);
    expect(new Set(firstManifest.items.map((item) => item.kind)).size).toBe(2);
    expect(firstManifest.items.map((item) =>
      reviewTaskKey(item.itemId, item.memoryVersion, item.reviewStateVersion)))
      .toEqual(home.tasks[0]?.taskKeys);
    expect(secondSession.value.attempt.manifest.items.map((item) => item.itemId))
      .toEqual(firstManifest.items.map((item) => item.itemId));
    const item = firstManifest.items[0]!;

    async function answerReview(
      session: LearningAttemptMutationResponse,
      idempotencyPrefix: string,
    ) {
      let attempt = session.attempt;
      if (item.kind === "flashcards") {
        const revealed = await provider.revealAttemptItem({
          attemptId: attempt.id,
          expectedVersion: attempt.rowVersion,
          idempotencyKey: `${idempotencyPrefix}1`,
          itemId: item.itemId,
          userId: studentId,
        });
        if (revealed.status !== "success") throw new Error("Expected review reveal");
        attempt = revealed.value.attempt;
        return provider.recordAttemptResponse({
          attemptId: attempt.id,
          idempotencyKey: `${idempotencyPrefix}2`,
          request: {
            expectedReviewVersion: item.reviewStateVersion,
            expectedVersion: attempt.rowVersion,
            itemId: item.itemId,
            kind: "flashcards" as const,
            recallGrade: "good" as const,
            round: 1,
          },
          userId: studentId,
        });
      }
      return provider.recordAttemptResponse({
        attemptId: attempt.id,
        idempotencyKey: `${idempotencyPrefix}2`,
        request: {
          expectedReviewVersion: item.reviewStateVersion,
          expectedVersion: attempt.rowVersion,
          itemId: item.itemId,
          kind: "quiz" as const,
          optionId: item.options[0]!.id,
          round: 1,
        },
        userId: studentId,
      });
    }

    const stateBefore = await pg.query<{ row_version: number }>(
      "select row_version from learning_review_states where user_id = $1 and item_id = $2 and memory_version = $3",
      [studentId, item.itemId, item.memoryVersion],
    );
    const accepted = await answerReview(firstSession.value, "69000000-0000-4000-8002-00000000000");
    const stale = await answerReview(secondSession.value, "69000000-0000-4000-8003-00000000000");
    expect(accepted.status).toBe("success");
    expect(stale.status).toBe("success");
    if (accepted.status !== "success" || stale.status !== "success") throw new Error("Expected responses");
    expect(accepted.value.feedback?.scheduleApplied).toBe(true);
    expect(stale.value.feedback?.scheduleApplied).toBe(false);
    expect(accepted.value.awards.map((award) => award.kind)).toEqual([
      "review_applied",
      "milestone_first_review",
    ]);
    expect(accepted.value.awards.reduce((total, award) => total + award.xp, 0)).toBe(2);
    expect(stale.value.awards).toEqual([]);
    expect(stale.value.feedback?.reviewState?.rowVersion).toBe(accepted.value.feedback?.reviewState?.rowVersion);
    const stateAfter = await pg.query<{ row_version: number }>(
      "select row_version from learning_review_states where user_id = $1 and item_id = $2 and memory_version = $3",
      [studentId, item.itemId, item.memoryVersion],
    );
    expect(stateAfter.rows[0]?.row_version).toBe((stateBefore.rows[0]?.row_version ?? 0) + 1);
    const appliedEvents = await pg.query<{ count: string }>(
      `select count(*)::text as count from learning_events
       where event_type = 'review_applied' and attempt_id in ($1, $2)`,
      [firstSession.value.attempt.id, secondSession.value.attempt.id],
    );
    expect(appliedEvents.rows[0]?.count).toBe("1");

    const retryItem = firstManifest.items[1]!;
    let retryAttempt = accepted.value.attempt;
    if (retryItem.kind === "flashcards") {
      const revealed = await provider.revealAttemptItem({
        attemptId: retryAttempt.id,
        expectedVersion: retryAttempt.rowVersion,
        idempotencyKey: "69000000-0000-4000-8004-000000000001",
        itemId: retryItem.itemId,
        userId: studentId,
      });
      if (revealed.status !== "success") throw new Error("Expected retry reveal");
      retryAttempt = revealed.value.attempt;
    }
    let expectedReviewVersion = retryItem.reviewStateVersion;
    for (const round of [1, 2, 3] as const) {
      const response = await provider.recordAttemptResponse({
        attemptId: retryAttempt.id,
        idempotencyKey: `69000000-0000-4000-8005-00000000000${round}`,
        request: retryItem.kind === "flashcards" ? {
          expectedReviewVersion,
          expectedVersion: retryAttempt.rowVersion,
          itemId: retryItem.itemId,
          kind: "flashcards" as const,
          recallGrade: "again" as const,
          round,
        } : {
          expectedReviewVersion,
          expectedVersion: retryAttempt.rowVersion,
          itemId: retryItem.itemId,
          kind: "quiz" as const,
          optionId: retryItem.options[1]!.id,
          round,
        },
        userId: studentId,
      });
      if (response.status !== "success" || !response.value.feedback?.reviewState) {
        throw new Error("Expected persisted relearning round");
      }
      expect(response.value.feedback.grading.sessionRetry).toBe(round < 3);
      expect(response.value.feedback.scheduleApplied).toBe(true);
      expectedReviewVersion = response.value.feedback.reviewState.rowVersion;
      retryAttempt = response.value.attempt;
      if (round === 3) {
        expect(response.value.feedback.reviewState.nextDueAt)
          .toBe(new Date(clockNow.getTime() + 86_400_000).toISOString());
      }
    }
    expect(retryAttempt.resume.currentIndex).toBe(2);
    for (let index = 2; index < firstManifest.items.length; index += 1) {
      const remaining = firstManifest.items[index]!;
      if (remaining.kind === "flashcards") {
        const revealed = await provider.revealAttemptItem({
          attemptId: retryAttempt.id,
          expectedVersion: retryAttempt.rowVersion,
          idempotencyKey: `69000000-0000-4000-8006-00000000000${index}`,
          itemId: remaining.itemId,
          userId: studentId,
        });
        if (revealed.status !== "success") throw new Error("Expected remaining reveal");
        retryAttempt = revealed.value.attempt;
      }
      const response = await provider.recordAttemptResponse({
        attemptId: retryAttempt.id,
        idempotencyKey: `69000000-0000-4000-8007-00000000000${index}`,
        request: remaining.kind === "flashcards" ? {
          expectedReviewVersion: remaining.reviewStateVersion,
          expectedVersion: retryAttempt.rowVersion,
          itemId: remaining.itemId,
          kind: "flashcards" as const,
          recallGrade: "good" as const,
          round: 1,
        } : {
          expectedReviewVersion: remaining.reviewStateVersion,
          expectedVersion: retryAttempt.rowVersion,
          itemId: remaining.itemId,
          kind: "quiz" as const,
          optionId: remaining.options[0]!.id,
          round: 1,
        },
        userId: studentId,
      });
      if (response.status !== "success") throw new Error("Expected remaining response");
      retryAttempt = response.value.attempt;
      if (index === firstManifest.items.length - 1) {
        expect(response.value.progress).toBeNull();
        expect(response.value.attempt.status).toBe("completed");
      }
    }
    const refreshedProgress = await provider.getEnrollmentProgress({ enrollmentId, userId: studentId });
    if (refreshedProgress.status !== "success") throw new Error("Expected refreshed evidence");
    expect(refreshedProgress.value.percentage).toBe(50);
    expect(refreshedProgress.value.units[1]?.objectives[0]?.lastReviewAt).toBe(clockNow.toISOString());
    const completedReviews = await pg.query<{ count: string }>(
      "select count(*)::text as count from learning_events where attempt_id = $1 and event_type = 'review_session_completed'",
      [retryAttempt.id],
    );
    expect(completedReviews.rows[0]?.count).toBe("1");
  });

  it("snoozes presentation without changing due dates and filters paused routes", async () => {
    clockNow = new Date("2026-09-07T12:12:00.000Z");
    const home = await provider.getHome({ minutes: 5, userId: studentId });
    const review = home.tasks.find((task) => task.kind === "review");
    if (!review) throw new Error("Expected remaining review task");
    const before = await pg.query<{ item_id: string; next_due_at: Date }>(
      "select item_id, next_due_at from learning_review_states where user_id = $1 order by item_id",
      [studentId],
    );
    const snoozed = await provider.updateTaskOverride({
      idempotencyKey: "6a000000-0000-4000-8000-000000000001",
      request: {
        action: "snooze",
        snoozedUntil: new Date(clockNow.getTime() + 86_400_000).toISOString(),
        taskKeys: review.taskKeys,
      },
      userId: studentId,
    });
    expect(snoozed).toEqual({ status: "success", value: { saved: true } });
    expect((await provider.getHome({ minutes: 5, userId: studentId })).counts.dueReviews).toBe(0);
    const after = await pg.query<{ item_id: string; next_due_at: Date }>(
      "select item_id, next_due_at from learning_review_states where user_id = $1 order by item_id",
      [studentId],
    );
    expect(after.rows.map((row) => [row.item_id, new Date(row.next_due_at).toISOString()]))
      .toEqual(before.rows.map((row) => [row.item_id, new Date(row.next_due_at).toISOString()]));

    const detail = await provider.getPathBySlug({ slug: "ruta-completa", userId: studentId });
    const enrollmentVersion = detail?.enrollment?.rowVersion;
    if (!enrollmentVersion) throw new Error("Expected enrollment version");
    const paused = await provider.updateEnrollment({
      enrollmentId,
      expectedVersion: enrollmentVersion,
      status: "paused",
      userId: studentId,
    });
    expect(paused.status).toBe("success");
    const pausedHome = await provider.getHome({ userId: studentId });
    expect(pausedHome.counts).toEqual({ activePaths: 0, dueReviews: 0, pendingEssentialSteps: 0 });
    expect(pausedHome.tasks).toEqual([]);
    if (paused.status !== "success") throw new Error("Expected pause");
    expect((await provider.updateEnrollment({
      enrollmentId,
      expectedVersion: paused.value.enrollment.rowVersion,
      status: "active",
      userId: studentId,
    })).status).toBe("success");
  });

  it("marks a step skipped without inflating route progress and restores it", async () => {
    const detail = await provider.getPathBySlug({ slug: "ruta-completa", userId: studentId });
    const stepId = detail?.version.units[0]?.steps[0]?.id;
    if (!stepId) throw new Error("Expected untouched step");
    const before = await provider.getEnrollmentProgress({ enrollmentId, userId: studentId });
    if (before.status !== "success") throw new Error("Expected progress");
    const step = before.value.units.flatMap((unit) => unit.steps).find((entry) => entry.stepId === stepId)!;
    expect(step).toMatchObject({ rowVersion: 0, state: "not_started" });
    const skipped = await provider.updateStepPreference({
      idempotencyKey: "6b000000-0000-4000-8000-000000000001",
      request: { action: "skip", enrollmentId, expectedVersion: step.rowVersion },
      stepId,
      userId: studentId,
    });
    expect(skipped.status).toBe("success");
    if (skipped.status !== "success") throw new Error("Expected skip");
    const skippedStep = skipped.value.units.flatMap((unit) => unit.steps).find((entry) => entry.stepId === stepId)!;
    expect(skippedStep.state).toBe("skipped");
    expect(skipped.value.percentage).toBe(before.value.percentage);
    expect(skipped.value.completedEssentialSteps).toBe(before.value.completedEssentialSteps);

    const restored = await provider.updateStepPreference({
      idempotencyKey: "6b000000-0000-4000-8000-000000000002",
      request: { action: "unskip", enrollmentId, expectedVersion: skippedStep.rowVersion },
      stepId,
      userId: studentId,
    });
    expect(restored.status).toBe("success");
    if (restored.status === "success") {
      expect(restored.value.units.flatMap((unit) => unit.steps)
        .find((entry) => entry.stepId === stepId)?.state).toBe("not_started");
      expect(restored.value.percentage).toBe(before.value.percentage);
    }
  });

  it("keeps a completed route at one hundred percent while later reviews stay separate", async () => {
    clockNow = new Date("2026-09-07T12:30:00.000Z");
    const detail = await provider.getPathBySlug({ slug: "ruta-completa", userId: studentId });
    const firstUnit = detail?.version.units[0];
    const guideOption = firstUnit?.steps[0]?.options.find((option) => option.projection === "guide");
    const recallOption = firstUnit?.steps[1]?.options[0];
    const checkOption = firstUnit?.steps[2]?.options[0];
    if (!guideOption || !recallOption || !checkOption) throw new Error("Expected first-unit options");

    const guide = await provider.createAttempt({
      idempotencyKey: "6d000000-0000-4000-8000-000000000001",
      request: { clientAttemptId: "6d000000-0000-4000-8001-000000000001", stepOptionId: guideOption.id },
      userId: studentId,
    });
    if (guide.status !== "success") throw new Error("Expected guide attempt");
    expect(await provider.completeAttempt({
      attemptId: guide.value.attempt.id,
      idempotencyKey: "6d000000-0000-4000-8000-000000000002",
      request: { confirmation: true, expectedVersion: guide.value.attempt.rowVersion },
      userId: studentId,
    })).toMatchObject({ status: "success" });

    const cards = await provider.createAttempt({
      idempotencyKey: "6e000000-0000-4000-8000-000000000001",
      request: { clientAttemptId: "6e000000-0000-4000-8001-000000000001", stepOptionId: recallOption.id },
      userId: studentId,
    });
    if (cards.status !== "success" || cards.value.attempt.manifest.projection !== "flashcards") {
      throw new Error("Expected flashcard attempt");
    }
    let cardAttempt = cards.value.attempt;
    for (let index = 0; index < cards.value.attempt.manifest.cards.length; index += 1) {
      const card = cards.value.attempt.manifest.cards[index]!;
      const revealed = await provider.revealAttemptItem({
        attemptId: cardAttempt.id,
        expectedVersion: cardAttempt.rowVersion,
        idempotencyKey: `6e000000-0000-4000-8002-${String(index + 1).padStart(12, "0")}`,
        itemId: card.itemId,
        userId: studentId,
      });
      if (revealed.status !== "success") throw new Error("Expected revealed card");
      const rated = await provider.recordAttemptResponse({
        attemptId: cardAttempt.id,
        idempotencyKey: `6e000000-0000-4000-8003-${String(index + 1).padStart(12, "0")}`,
        request: {
          expectedVersion: revealed.value.attempt.rowVersion,
          itemId: card.itemId,
          kind: "flashcards",
          recallGrade: "hard",
          round: 1,
        },
        userId: studentId,
      });
      if (rated.status !== "success") throw new Error("Expected saved card rating");
      cardAttempt = rated.value.attempt;
    }
    expect(cardAttempt.status).toBe("completed");

    const quiz = await provider.createAttempt({
      idempotencyKey: "6f000000-0000-4000-8000-000000000001",
      request: { clientAttemptId: "6f000000-0000-4000-8001-000000000001", stepOptionId: checkOption.id },
      userId: studentId,
    });
    if (quiz.status !== "success" || quiz.value.attempt.manifest.projection !== "quiz") {
      throw new Error("Expected quiz attempt");
    }
    let quizAttempt = quiz.value.attempt;
    let completedProgress: number | null = null;
    let completionAwards: LearningAttemptMutationResponse["awards"] = [];
    for (let index = 0; index < quiz.value.attempt.manifest.questions.length; index += 1) {
      const question = quiz.value.attempt.manifest.questions[index]!;
      const answered = await provider.recordAttemptResponse({
        attemptId: quizAttempt.id,
        idempotencyKey: `6f000000-0000-4000-8002-${String(index + 1).padStart(12, "0")}`,
        request: {
          expectedVersion: quizAttempt.rowVersion,
          itemId: question.itemId,
          kind: "quiz",
          optionId: question.options[0]!.id,
          round: 1,
        },
        userId: studentId,
      });
      if (answered.status !== "success") throw new Error("Expected saved quiz answer");
      quizAttempt = answered.value.attempt;
      completedProgress = answered.value.progress?.percentage ?? completedProgress;
      if (answered.value.attempt.status === "completed") completionAwards = answered.value.awards;
    }
    expect(quizAttempt.status).toBe("completed");
    expect(completedProgress).toBe(100);
    expect(completionAwards.map((award) => award.kind)).toEqual([
      "activity_check",
      "unit_completed",
      "route_completed",
    ]);
    expect(completionAwards.find((award) => award.kind === "route_completed")?.awardKey)
      .toBe(`route:${publishedPathId}:version:${publishedVersionId}:completed`);
    expect(completionAwards.reduce((total, award) => total + award.xp, 0)).toBe(85);
    const enrollment = await pg.query<{ completed_at: Date | null }>(
      "select completed_at from learning_enrollments where id = $1",
      [enrollmentId],
    );
    expect(enrollment.rows[0]?.completed_at).not.toBeNull();
    expect(new Date(enrollment.rows[0]!.completed_at!).toISOString()).toBe(clockNow.toISOString());

    clockNow = new Date("2026-09-14T12:30:00.000Z");
    const home = await provider.getHome({ minutes: 5, userId: studentId });
    expect(home.activePath).toMatchObject({ completedSteps: 6, progressPercent: 100, totalSteps: 6 });
    expect(home.counts.pendingEssentialSteps).toBe(0);
    expect(home.counts.dueReviews).toBeGreaterThan(0);
    expect(home.tasks.some((task) => task.kind === "review")).toBe(true);
    expect(home.points).toBe(170);
    expect(home.milestones.map((milestone) => milestone.kind)).toEqual(expect.arrayContaining([
      "milestone_first_activity",
      "milestone_first_unit",
      "milestone_first_review",
      "route_completed",
    ]));
  });

  it("defers constancy timezone changes to the next local week with optimistic idempotency", async () => {
    clockNow = new Date("2026-09-06T12:11:00.000Z");
    const defaults = await provider.getPreferences({ userId: studentId });
    expect(defaults).toMatchObject({ pendingConstancy: null, rowVersion: 1, sessionMinutes: 10, timezone: "UTC", weeklyGoalDays: null });
    const request = {
      expectedVersion: 1,
      sessionMinutes: 5 as const,
      timezone: "America/Caracas",
      weeklyGoalDays: 3 as const,
    };
    const updated = await provider.updatePreferences({
      idempotencyKey: "6c000000-0000-4000-8000-000000000001",
      request,
      userId: studentId,
    });
    expect(updated.status).toBe("success");
    if (updated.status !== "success") throw new Error("Expected preferences");
    expect(updated.value).toMatchObject({
      pendingConstancy: { effectiveOn: "2026-09-07", timezone: "America/Caracas", weeklyGoalDays: 3 },
      sessionMinutes: 5,
      timezone: "UTC",
      weeklyGoalDays: null,
    });
    expect(await provider.updatePreferences({
      idempotencyKey: "6c000000-0000-4000-8000-000000000001",
      request,
      userId: studentId,
    })).toEqual(updated);
    expect((await provider.updatePreferences({
      idempotencyKey: "6c000000-0000-4000-8000-000000000001",
      request: { ...request, sessionMinutes: 20 },
      userId: studentId,
    })).status).toBe("idempotency_conflict");

    clockNow = new Date("2026-09-07T12:11:00.000Z");
    expect(await provider.getPreferences({ userId: studentId })).toMatchObject({
      pendingConstancy: null,
      timezone: "America/Caracas",
      weeklyGoalDays: 3,
    });
    expect((await provider.getHome({ userId: studentId })).constancy).toEqual({
      activeDaysThisWeek: 1,
      weeklyGoalDays: 3,
    });
  });

  it("caps review points at twenty per user-local day", async () => {
    const acceptedAt = new Date("2026-09-08T14:00:00.000Z");
    const awarded: LearningAttemptMutationResponse["awards"] = [];
    for (let index = 0; index < 11; index += 1) {
      const rewards = await database.transaction().execute(async (transaction) => {
        const event = await transaction.insertInto("learning_events").values({
          attempt_id: null,
          enrollment_id: null,
          event_type: "review_applied",
          local_date: "2026-09-08",
          occurred_at: acceptedAt,
          payload_json: { fixture: true },
          semantic_key: `reward-cap-fixture:${index}`,
          timezone: "UTC",
          user_id: otherStudentId,
        }).returning("id").executeTakeFirstOrThrow();
        return awardAppliedReview(transaction, {
          acceptedAt,
          eventId: event.id,
          itemId: itemIds[index % itemIds.length]!,
          memoryVersion: 1,
          previousStateVersion: 100 + index,
          userId: otherStudentId,
        });
      });
      awarded.push(...rewards);
    }
    expect(awarded.filter((reward) => reward.kind === "review_applied")
      .reduce((total, reward) => total + reward.xp, 0)).toBe(20);
    const stored = await pg.query<{ count: string; xp: string }>(
      `select count(*)::text as count, coalesce(sum(xp), 0)::text as xp
       from learning_rewards where user_id = $1 and reward_kind = 'review_applied'`,
      [otherStudentId],
    );
    expect(stored.rows[0]).toEqual({ count: "11", xp: "20" });
  });

  it("reports insufficient evidence and broken references instead of publishing mocks", async () => {
    const created = await provider.createPath({
      actorUserId: creatorId,
      draft: routeDraft("ruta-insuficiente", itemIds.slice(0, 2)),
    });
    expect(created.status).toBe("success");
    if (created.status !== "success") throw new Error("Expected insufficient draft");
    const validation = await provider.validatePath({ actorUserId: creatorId, canEditAll: false, pathId: created.value.id });
    expect(validation.status).toBe("success");
    if (validation.status !== "success") throw new Error("Expected validation result");
    expect(validation.value.ready).toBe(false);
    expect(validation.value.issues.map((entry) => entry.code)).toContain("insufficient_evidence");
    const transition = await provider.transitionPath({ actorUserId: creatorId, canPublish: false, canReview: false, expectedVersion: 1, pathId: created.value.id, status: "in_review" });
    expect(transition.status).toBe("not_ready");

    const broken = routeDraft("ruta-rota");
    broken.definition.units[0]!.steps[0]!.options[0]!.sourceContentId = "90000000-0000-4000-8000-000000000001";
    expect((await provider.createPath({ actorUserId: creatorId, draft: broken })).status).toBe("not_found");
  });

  it("makes published definitions and resource snapshots immutable at the database boundary", async () => {
    await expect(pg.query(
      "update learning_path_units set title = 'Mutación' where path_version_id = $1",
      [publishedVersionId],
    )).rejects.toThrow("immutable");
    const revision = await pg.query<{ id: string }>("select id from learning_resource_revisions limit 1");
    await expect(pg.query(
      "update learning_resource_revisions set schema_version = 2 where id = $1",
      [revision.rows[0]!.id],
    )).rejects.toThrow("immutable");
    const attempt = await pg.query<{ id: string }>(
      "select id from learning_attempts where projection = 'quiz' limit 1",
    );
    await expect(pg.query(
      "update learning_attempts set manifest_json = '{}'::jsonb where id = $1",
      [attempt.rows[0]!.id],
    )).rejects.toThrow("immutable");
    const response = await pg.query<{ id: string }>(
      "select id from learning_responses where attempt_id = $1 limit 1",
      [attempt.rows[0]!.id],
    );
    await expect(pg.query(
      "update learning_responses set answer_json = '{}'::jsonb where id = $1",
      [response.rows[0]!.id],
    )).rejects.toThrow("immutable");
  });

  it("paginates the editorial resource catalog and exposes assessment gaps", async () => {
    const resources = await provider.listEditorResources({
      limit: 1,
      projection: "quiz",
      q: "video de prueba",
      topic: "Tórax",
    });
    expect(resources.items).toHaveLength(1);
    expect(resources.items[0]).toMatchObject({
      id: videoId,
      issues: [],
      title: "Video de prueba",
      topic: "Tórax",
      version: expect.any(Number),
    });
    expect(resources.items[0]?.projections.find((entry) => entry.projection === "quiz"))
      .toMatchObject({ explanationCoverage: "complete", itemCount: 5, itemIds });
    expect(resources.resourceTopics).toContain("Tórax");
    expect(resources.topics).toContainEqual({ id: topicId, title: "Tórax de prueba" });

    const selectedTopic = await provider.listEditorResources({
      limit: 10,
      topic: resources.resourceTopics.find((topic) => topic === "Tórax"),
    });
    expect(selectedTopic.items.some((item) => item.id === videoId)).toBe(true);

    const missing = await provider.listEditorResources({ limit: 10, q: "material inexistente" });
    expect(missing).toMatchObject({ items: [], nextCursor: null });
  });

  it("upgrades versions voluntarily, preserves history and transfers only valid equivalences", async () => {
    clockNow = new Date("2026-09-15T13:00:00.000Z");
    const beforePoints = await pg.query<{ xp: string }>(
      "select coalesce(sum(xp), 0)::text as xp from learning_rewards where user_id = $1",
      [studentId],
    );
    const beforeEnrollment = await pg.query<{ completed_at: Date; row_version: number }>(
      "select completed_at, row_version from learning_enrollments where id = $1",
      [enrollmentId],
    );

    const createdSecond = await provider.createVersion({
      actorUserId: creatorId,
      canEditAll: false,
      pathId: publishedPathId,
      releaseNotes: "Reordenación editorial sin cambios pedagógicos.",
    });
    expect(createdSecond.status).toBe("success");
    if (createdSecond.status !== "success") throw new Error("Expected second version draft");
    const secondDefinition = definition();
    secondDefinition.releaseNotes = "Reordenación editorial sin cambios pedagógicos.";
    secondDefinition.units = secondDefinition.units.map((unit) => ({
      ...unit,
      steps: [...unit.steps].reverse(),
    }));
    const updatedSecond = await provider.updatePath({
      actorUserId: creatorId,
      canEditAll: false,
      pathId: publishedPathId,
      update: {
        coverKey: "lungs",
        definition: secondDefinition,
        expectedVersion: createdSecond.value.version.editVersion,
        slug: "ruta-completa",
        summary: "Ruta ficticia para demostrar persistencia, alternativas y validación.",
        title: "Ruta completa de prueba",
        topicContentId: topicId,
      },
    });
    if (updatedSecond.status !== "success") throw new Error("Expected updated second version");
    const secondReview = await provider.transitionPath({ actorUserId: creatorId, canPublish: false, canReview: false, expectedVersion: updatedSecond.value.version.editVersion, pathId: publishedPathId, status: "in_review" });
    if (secondReview.status !== "success") throw new Error("Expected second version review");
    const secondApproved = await provider.transitionPath({ actorUserId: coordinatorId, canPublish: true, canReview: true, expectedVersion: secondReview.value.version.editVersion, pathId: publishedPathId, status: "approved" });
    if (secondApproved.status !== "success") throw new Error("Expected second version approval");
    const secondPublished = await provider.transitionPath({ actorUserId: coordinatorId, canPublish: true, canReview: true, expectedVersion: secondApproved.value.version.editVersion, pathId: publishedPathId, status: "published" });
    if (secondPublished.status !== "success") throw new Error("Expected second version publication");
    const secondVersionId = secondPublished.value.version.id;

    const currentPath = await provider.getPathBySlug({ slug: "ruta-completa", userId: studentId });
    const openOption = currentPath?.version.units[0]?.steps[0]?.options[0];
    if (!currentPath?.enrollment || !openOption) throw new Error("Expected pinned first-version enrollment");
    expect(currentPath.version.id).toBe(publishedVersionId);
    const openAttempt = await provider.createAttempt({
      idempotencyKey: "71000000-0000-4000-8000-000000000001",
      request: {
        clientAttemptId: "71000000-0000-4000-8001-000000000001",
        stepOptionId: openOption.id,
      },
      userId: studentId,
    });
    if (openAttempt.status !== "success") throw new Error("Expected open attempt");

    const blockedPreview = await provider.getEnrollmentUpgradePreview({ enrollmentId, userId: studentId });
    expect(blockedPreview.status).toBe("success");
    if (blockedPreview.status !== "success" || !blockedPreview.value.upgrade) throw new Error("Expected upgrade preview");
    expect(blockedPreview.value).toMatchObject({
      history: [{ pathVersionId: publishedVersionId, versionNumber: 1 }],
      upgrade: {
        activeAttempt: { attemptId: openAttempt.value.attempt.id },
        projectedProgress: { completedEssentialSteps: 6, percentage: 100, totalEssentialSteps: 6 },
        summary: { added: 0, changed: 0, removed: 0, transferableCompleted: 6 },
        targetVersion: { id: secondVersionId, number: 2 },
      },
    });
    const blocked = await provider.upgradeEnrollment({
      enrollmentId,
      idempotencyKey: "71000000-0000-4000-8002-000000000001",
      request: { expectedVersion: currentPath.enrollment.rowVersion, targetPathVersionId: secondVersionId },
      userId: studentId,
    });
    expect(blocked.status).toBe("active_attempt");
    await pg.query(
      "update learning_attempts set status = 'abandoned' where id = $1 and status = 'in_progress'",
      [openAttempt.value.attempt.id],
    );

    const secondUpgradeRequest = {
      expectedVersion: currentPath.enrollment.rowVersion,
      targetPathVersionId: secondVersionId,
    };
    const upgradedSecond = await provider.upgradeEnrollment({
      enrollmentId,
      idempotencyKey: "71000000-0000-4000-8003-000000000001",
      request: secondUpgradeRequest,
      userId: studentId,
    });
    expect(upgradedSecond.status).toBe("success");
    if (upgradedSecond.status !== "success") throw new Error("Expected second-version upgrade");
    expect(upgradedSecond.value).toMatchObject({
      enrollment: { completedAt: expect.any(String), pathVersionId: secondVersionId },
      progress: { completedEssentialSteps: 6, percentage: 100, totalEssentialSteps: 6 },
      transferredSteps: 6,
    });
    const replay = await provider.upgradeEnrollment({
      enrollmentId,
      idempotencyKey: "71000000-0000-4000-8003-000000000001",
      request: secondUpgradeRequest,
      userId: studentId,
    });
    expect(replay).toEqual(upgradedSecond);
    expect((await provider.upgradeEnrollment({
      enrollmentId,
      idempotencyKey: "71000000-0000-4000-8003-000000000001",
      request: { ...secondUpgradeRequest, expectedVersion: secondUpgradeRequest.expectedVersion + 1 },
      userId: studentId,
    })).status).toBe("idempotency_conflict");
    const afterCosmeticPoints = await pg.query<{ xp: string }>(
      "select coalesce(sum(xp), 0)::text as xp from learning_rewards where user_id = $1",
      [studentId],
    );
    expect(afterCosmeticPoints.rows[0]?.xp).toBe(beforePoints.rows[0]?.xp);
    expect(upgradedSecond.value.enrollment.completedAt).toBe(
      new Date(beforeEnrollment.rows[0]!.completed_at).toISOString(),
    );

    const createdThird = await provider.createVersion({
      actorUserId: creatorId,
      canEditAll: false,
      pathId: publishedPathId,
      releaseNotes: "Una actividad fue revisada pedagógicamente.",
    });
    if (createdThird.status !== "success") throw new Error("Expected third version draft");
    const thirdDefinition = definition();
    thirdDefinition.releaseNotes = "Una actividad fue revisada pedagógicamente.";
    thirdDefinition.units[0]!.steps[0]!.pedagogyVersion = 2;
    const updatedThird = await provider.updatePath({
      actorUserId: creatorId,
      canEditAll: false,
      pathId: publishedPathId,
      update: {
        coverKey: "lungs",
        definition: thirdDefinition,
        expectedVersion: createdThird.value.version.editVersion,
        slug: "ruta-completa",
        summary: "Ruta ficticia para demostrar persistencia, alternativas y validación.",
        title: "Ruta completa de prueba",
        topicContentId: topicId,
      },
    });
    if (updatedThird.status !== "success") throw new Error("Expected updated third version");
    const thirdReview = await provider.transitionPath({ actorUserId: creatorId, canPublish: false, canReview: false, expectedVersion: updatedThird.value.version.editVersion, pathId: publishedPathId, status: "in_review" });
    if (thirdReview.status !== "success") throw new Error("Expected third version review");
    const thirdApproved = await provider.transitionPath({ actorUserId: coordinatorId, canPublish: true, canReview: true, expectedVersion: thirdReview.value.version.editVersion, pathId: publishedPathId, status: "approved" });
    if (thirdApproved.status !== "success") throw new Error("Expected third version approval");
    const thirdPublished = await provider.transitionPath({ actorUserId: coordinatorId, canPublish: true, canReview: true, expectedVersion: thirdApproved.value.version.editVersion, pathId: publishedPathId, status: "published" });
    if (thirdPublished.status !== "success") throw new Error("Expected third version publication");
    const thirdVersionId = thirdPublished.value.version.id;

    const thirdPreview = await provider.getEnrollmentUpgradePreview({ enrollmentId, userId: studentId });
    expect(thirdPreview.status).toBe("success");
    if (thirdPreview.status !== "success" || !thirdPreview.value.upgrade) throw new Error("Expected third preview");
    expect(thirdPreview.value.upgrade).toMatchObject({
      activeAttempt: null,
      projectedProgress: { completedEssentialSteps: 5, percentage: 83, totalEssentialSteps: 6 },
      summary: { added: 0, changed: 1, removed: 0, transferableCompleted: 5 },
      targetVersion: { id: thirdVersionId, number: 3 },
    });
    const changedStep = thirdPreview.value.upgrade.steps.find((step) => step.kind === "changed");
    expect(changedStep).toMatchObject({ completed: true, transferable: false });

    const upgradedThird = await provider.upgradeEnrollment({
      enrollmentId,
      idempotencyKey: "71000000-0000-4000-8004-000000000001",
      request: {
        expectedVersion: upgradedSecond.value.enrollment.rowVersion,
        targetPathVersionId: thirdVersionId,
      },
      userId: studentId,
    });
    expect(upgradedThird.status).toBe("success");
    if (upgradedThird.status !== "success") throw new Error("Expected third-version upgrade");
    expect(upgradedThird.value).toMatchObject({
      enrollment: { completedAt: null, pathVersionId: thirdVersionId },
      progress: { completedEssentialSteps: 5, percentage: 83, totalEssentialSteps: 6 },
      transferredSteps: 5,
    });
    const history = await provider.getEnrollmentUpgradePreview({ enrollmentId, userId: studentId });
    expect(history).toMatchObject({
      status: "success",
      value: {
        history: [
          { pathVersionId: publishedVersionId, versionNumber: 1 },
          { pathVersionId: secondVersionId, versionNumber: 2 },
          { pathVersionId: thirdVersionId, versionNumber: 3 },
        ],
        upgrade: null,
      },
    });
    const storedProgress = await pg.query<{ count: string; path_version_id: string }>(
      `select path_version_id, count(*)::text as count from learning_step_progress
       where enrollment_id = $1 group by path_version_id order by path_version_id`,
      [enrollmentId],
    );
    expect(Object.fromEntries(storedProgress.rows.map((row) => [row.path_version_id, row.count]))).toEqual({
      [publishedVersionId]: "6",
      [secondVersionId]: "6",
      [thirdVersionId]: "5",
    });
    const adoption = await pg.query<{ count: string }>(
      "select count(*)::text as count from learning_enrollment_versions where enrollment_id = $1",
      [enrollmentId],
    );
    expect(adoption.rows[0]?.count).toBe("3");
  });

  it("offers library tracking only for the exact current resource revision", async () => {
    const current = await pg.query<{
      adapter_version: number;
      payload_json: Record<string, unknown>;
      resource_id: string;
      revision_number: number;
      schema_version: number;
      source_version: number;
    }>(
      `select revision.adapter_version, revision.payload_json, revision.resource_id,
        revision.revision_number, revision.schema_version, revision.source_version
       from learning_resource_revisions revision
       inner join learning_resources resource on resource.id = revision.resource_id
       where resource.source_content_id = $1 and resource.projection = 'quiz'
       order by revision.revision_number desc limit 1`,
      [videoId],
    );
    const row = current.rows[0]!;
    const changedPayload = { ...row.payload_json, title: "Revisión posterior no fijada" };
    await pg.query(
      `insert into learning_resource_revisions
        (resource_id, revision_number, source_version, adapter_version, schema_version, payload_json, payload_hash)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        row.resource_id,
        row.revision_number + 1,
        row.source_version,
        row.adapter_version,
        row.schema_version,
        changedPayload,
        hashLearningSnapshot(changedPayload),
      ],
    );
    expect(await provider.listLibraryOptions({ projection: "quiz", sourceContentId: videoId, userId: studentId }))
      .toEqual([]);
  });

  it("keeps historical attempts readable while retired resources cannot launch again", async () => {
    const historical = await pg.query<{ id: string }>(
      "select id from learning_attempts where user_id = $1 and projection = 'video' and status = 'completed' order by created_at asc limit 1",
      [studentId],
    );
    expect(historical.rows[0]?.id).toBeTruthy();
    await pg.query(
      "update learning_resources set retired_at = now() where source_content_id = $1 and projection = 'video'",
      [videoId],
    );
    expect((await provider.getAttempt({ attemptId: historical.rows[0]!.id, userId: studentId })).status)
      .toBe("success");

    const currentPath = await provider.getPathBySlug({ slug: "ruta-completa", userId: studentId });
    const videoOption = currentPath?.version.units.flatMap((unit) => unit.steps)
      .flatMap((step) => step.options).find((option) => option.projection === "video");
    if (!videoOption) throw new Error("Expected current video option");
    expect((await provider.createAttempt({
      idempotencyKey: "72000000-0000-4000-8000-000000000001",
      request: {
        clientAttemptId: "72000000-0000-4000-8001-000000000001",
        stepOptionId: videoOption.id,
      },
      userId: studentId,
    })).status).toBe("resource_changed");

    const catalog = await provider.listEditorResources({ limit: 10, projection: "video" });
    expect(catalog.items).toEqual([]);
  });

  it("denies inherited Data API roles and keeps editor preview free of student tracking", async () => {
    const before = await pg.query<{ count: string }>("select count(*)::text as count from learning_enrollments");
    const preview = await provider.getEditorPath({ actorUserId: creatorId, canEditAll: false, pathId: publishedPathId });
    const after = await pg.query<{ count: string }>("select count(*)::text as count from learning_enrollments");
    expect(preview.status).toBe("success");
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);

    for (const role of ["anon", "authenticated"]) {
      await pg.exec(`set role ${role};`);
      await expect(pg.query("select * from learning_paths")).rejects.toThrow("permission denied");
      await expect(pg.query("select * from learning_enrollments")).rejects.toThrow("permission denied");
      await expect(pg.query("select * from learning_attempts")).rejects.toThrow("permission denied");
      await expect(pg.query("select * from learning_responses")).rejects.toThrow("permission denied");
      await expect(pg.query("select * from learning_review_states")).rejects.toThrow("permission denied");
      await expect(pg.query("select * from learning_objective_progress")).rejects.toThrow("permission denied");
      await expect(pg.query("select * from learning_preferences")).rejects.toThrow("permission denied");
      await expect(pg.query("select * from learning_task_overrides")).rejects.toThrow("permission denied");
      await expect(pg.query("select * from learning_rewards")).rejects.toThrow("permission denied");
      await pg.exec("reset role;");
    }
  });
});
