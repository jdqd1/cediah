import { describe, expect, it, vi } from "vitest";
import type {
  ContentProvider,
  GuidedLearningProvider,
  IdentityProvider,
  LearningPathDetail,
} from "@cediah/contracts";
import { buildApp } from "../src/app.js";
import type { ApiEnvironment } from "../src/config.js";
import type { GuidedLearningObservation } from "../src/guided-learning/observability.js";

const userId = "60000000-0000-4000-8000-000000000001";
const otherStudentId = "70000000-0000-4000-8000-000000000001";
const pathId = "60000000-0000-4000-8000-000000000002";
const versionId = "60000000-0000-4000-8000-000000000003";
const enrollmentId = "60000000-0000-4000-8000-000000000004";
const topicId = "60000000-0000-4000-8000-000000000005";
const attemptId = "60000000-0000-4000-8000-000000000006";
const optionId = "60000000-0000-4000-8000-000000000007";
const clientAttemptId = "60000000-0000-4000-8000-000000000008";
const idempotencyKey = "60000000-0000-4000-8000-000000000009";
const now = "2026-09-05T12:00:00.000Z";

const environment: ApiEnvironment = {
  guidedLearningEnabled: true,
  HOST: "127.0.0.1",
  NODE_ENV: "test",
  PORT: 4000,
  VIDEO_TEST_PROVIDER: "s3",
  WEB_ORIGINS: "http://localhost:3000",
  webOrigins: new Set(["http://localhost:3000"]),
};

const detail: LearningPathDetail = {
  archivedAt: null,
  coverKey: "lungs",
  createdBy: userId,
  enrollment: null,
  id: pathId,
  slug: "ruta-prueba",
  summary: "Resumen",
  title: "Ruta de prueba",
  topic: { id: topicId, title: "Tórax" },
  version: {
    editVersion: 1,
    evidenceLevel: "standard",
    id: versionId,
    number: 1,
    policyVersion: "guided-v1",
    publishedAt: null,
    releaseNotes: "",
    status: "draft",
    units: [],
  },
};

function fakeProvider(): GuidedLearningProvider {
  return {
    completeAttempt: vi.fn(async () => ({ status: "not_found" as const })),
    createAttempt: vi.fn(async () => ({ status: "not_found" as const })),
    createEnrollment: vi.fn(async () => ({
      status: "success" as const,
      value: {
        continueHref: "/aprendizaje/rutas/ruta-prueba",
        enrollment: {
          completedAt: null,
          id: enrollmentId,
          pathVersionId: versionId,
          rowVersion: 1,
          status: "active" as const,
        },
        pathSlug: "ruta-prueba",
      },
    })),
    createPath: vi.fn(async () => ({ status: "success" as const, value: detail })),
    createReviewSession: vi.fn(async () => ({ status: "not_found" as const })),
    createVersion: vi.fn(async () => ({ status: "success" as const, value: detail })),
    getAttempt: vi.fn(async () => ({ status: "not_found" as const })),
    getAttemptMedia: vi.fn(async () => ({ status: "not_found" as const })),
    getEditorPath: vi.fn(async () => ({ status: "success" as const, value: detail })),
    getEnrollmentProgress: vi.fn(async () => ({ status: "not_found" as const })),
    getEnrollmentUpgradePreview: vi.fn(async () => ({
      status: "success" as const,
      value: { history: [], upgrade: null },
    })),
    getHome: vi.fn(async () => { throw new Error("not implemented in route fixture"); }),
    getPathBySlug: vi.fn(async () => ({ ...detail, version: { ...detail.version, status: "published" as const, publishedAt: now } })),
    getPreferences: vi.fn(async () => ({
      examDate: null,
      pendingConstancy: null,
      pinnedEnrollmentId: null,
      rowVersion: 0,
      sessionMinutes: 10 as const,
      timezone: "UTC",
      weeklyGoalDays: null,
    })),
    listEditorPaths: vi.fn(async () => [detail]),
    listEditorResources: vi.fn(async () => ({ items: [], nextCursor: null, resourceTopics: [], topics: [] })),
    listLibraryOptions: vi.fn(async () => []),
    listPublishedPaths: vi.fn(async () => ({
      items: [{
        coverKey: "lungs" as const,
        enrollment: null,
        estimatedMinutes: 20,
        id: pathId,
        slug: "ruta-prueba",
        summary: "Resumen",
        title: "Ruta de prueba",
        topic: { id: topicId, title: "Tórax" },
        unitCount: 1,
      }],
      nextCursor: null,
    })),
    recordAttemptResponse: vi.fn(async () => ({ status: "not_found" as const })),
    revealAttemptItem: vi.fn(async () => ({ status: "not_found" as const })),
    transitionPath: vi.fn(async () => ({ status: "success" as const, value: detail })),
    updateEnrollment: vi.fn(async () => ({
      status: "success" as const,
      value: {
        continueHref: "/aprendizaje/rutas/ruta-prueba",
        enrollment: { completedAt: null, id: enrollmentId, pathVersionId: versionId, rowVersion: 2, status: "paused" as const },
        pathSlug: "ruta-prueba",
      },
    })),
    upgradeEnrollment: vi.fn(async () => ({ status: "not_found" as const })),
    updateAttemptResume: vi.fn(async () => ({ status: "not_found" as const })),
    updatePreferences: vi.fn(async () => ({ status: "not_found" as const })),
    updatePath: vi.fn(async () => ({ status: "success" as const, value: detail })),
    updateStepPreference: vi.fn(async () => ({ status: "not_found" as const })),
    updateTaskOverride: vi.fn(async () => ({ status: "not_found" as const })),
    validatePath: vi.fn(async () => ({ status: "success" as const, value: { issues: [], ready: true } })),
  };
}

const identityProvider: IdentityProvider = {
  getUser: async (request) => request.authorization === "Bearer valid"
    ? { email: "student@example.test", id: userId }
    : null,
  revokeSessions: async () => undefined,
};

describe("guided-learning route registration", () => {
  it("does not register or call guided modules while the feature is disabled", async () => {
    const provider = fakeProvider();
    const observer = vi.fn();
    const app = await buildApp({ ...environment, guidedLearningEnabled: false }, {
      guidedLearningObserver: observer,
      guidedLearningProvider: provider,
      identityProvider,
    });
    const response = await app.inject({ headers: { authorization: "Bearer valid" }, method: "GET", url: "/v1/guided-learning/paths" });
    expect(response.statusCode).toBe(404);
    expect(provider.listPublishedPaths).not.toHaveBeenCalled();
    expect(observer).not.toHaveBeenCalled();
    await app.close();
  });

  it("requires identity and returns only private, validated catalog data", async () => {
    const provider = fakeProvider();
    const app = await buildApp(environment, { guidedLearningProvider: provider, identityProvider });
    expect((await app.inject({ method: "GET", url: "/v1/guided-learning/paths" })).statusCode).toBe(401);
    const response = await app.inject({ headers: { authorization: "Bearer valid" }, method: "GET", url: "/v1/guided-learning/paths?limit=10" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toContain("private");
    expect(response.json().items[0]).not.toHaveProperty("version");
    expect(provider.listPublishedPaths).toHaveBeenCalledWith({ limit: 10, userId });
    await app.close();
  });

  it("emits privacy-safe operation observations and protects error responses from caching", async () => {
    const provider = fakeProvider();
    const observations: GuidedLearningObservation[] = [];
    const app = await buildApp(environment, {
      guidedLearningObserver: (observation) => {
        observations.push(observation);
      },
      guidedLearningProvider: provider,
      identityProvider,
    });

    const catalog = await app.inject({
      headers: { authorization: "Bearer valid" },
      method: "GET",
      url: "/v1/guided-learning/paths?limit=10",
    });
    const missingAttempt = await app.inject({
      headers: {
        authorization: "Bearer valid",
        "idempotency-key": idempotencyKey,
      },
      method: "POST",
      payload: { clientAttemptId, stepOptionId: optionId },
      url: "/v1/guided-learning/attempts",
    });
    const unavailableHome = await app.inject({
      headers: { authorization: "Bearer valid" },
      method: "GET",
      url: "/v1/guided-learning/home",
    });

    expect(catalog.statusCode).toBe(200);
    expect(missingAttempt.statusCode).toBe(404);
    expect(missingAttempt.headers["cache-control"]).toBe("private, no-store");
    expect(unavailableHome.statusCode).toBe(503);
    expect(unavailableHome.headers["cache-control"]).toBe("private, no-store");
    expect(observations).toHaveLength(3);
    expect(observations[0]).toMatchObject({
      errorCode: null,
      idempotencyKeyPresent: false,
      method: "GET",
      operation: "path.list",
      outcome: "success",
      statusCode: 200,
      surface: "student",
    });
    expect(observations[2]).toMatchObject({
      errorCode: "learning_unavailable",
      idempotencyKeyPresent: false,
      method: "GET",
      operation: "home.read",
      outcome: "server_error",
      statusCode: 503,
      surface: "student",
    });
    expect(observations[1]).toMatchObject({
      errorCode: "not_found",
      idempotencyKeyPresent: true,
      method: "POST",
      operation: "attempt.create",
      outcome: "client_error",
      statusCode: 404,
      surface: "student",
    });
    expect(observations.every((observation) => observation.durationMs >= 0)).toBe(true);
    expect(JSON.stringify(observations)).not.toContain(userId);
    expect(JSON.stringify(observations)).not.toContain(attemptId);
    expect(JSON.stringify(observations)).not.toContain(idempotencyKey);
    await app.close();
  });

  it("rejects unknown student-controlled fields and scopes enrollment to session identity", async () => {
    const provider = fakeProvider();
    const app = await buildApp(environment, { guidedLearningProvider: provider, identityProvider });
    const invalid = await app.inject({
      headers: { authorization: "Bearer valid" },
      method: "POST",
      payload: { pathId, userId: "70000000-0000-4000-8000-000000000001" },
      url: "/v1/guided-learning/enrollments",
    });
    expect(invalid.statusCode).toBe(400);
    expect(provider.createEnrollment).not.toHaveBeenCalled();

    const valid = await app.inject({
      headers: { authorization: "Bearer valid" },
      method: "POST",
      payload: { pathId },
      url: "/v1/guided-learning/enrollments",
    });
    expect(valid.statusCode).toBe(201);
    expect(provider.createEnrollment).toHaveBeenCalledWith({ pathId, userId });
    await app.close();
  });

  it("keeps upgrade preview private and requires a strict idempotent adoption", async () => {
    const provider = fakeProvider();
    provider.upgradeEnrollment = vi.fn(async () => ({ status: "active_attempt" as const }));
    const app = await buildApp(environment, { guidedLearningProvider: provider, identityProvider });
    expect((await app.inject({
      method: "GET",
      url: `/v1/guided-learning/enrollments/${enrollmentId}/upgrade-preview`,
    })).statusCode).toBe(401);
    const preview = await app.inject({
      headers: { authorization: "Bearer valid" },
      method: "GET",
      url: `/v1/guided-learning/enrollments/${enrollmentId}/upgrade-preview`,
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.headers["cache-control"]).toContain("no-store");
    expect(provider.getEnrollmentUpgradePreview).toHaveBeenCalledWith({ enrollmentId, userId });

    const injected = await app.inject({
      headers: { authorization: "Bearer valid", "idempotency-key": idempotencyKey },
      method: "POST",
      payload: { expectedVersion: 1, targetPathVersionId: versionId, userId: otherStudentId },
      url: `/v1/guided-learning/enrollments/${enrollmentId}/upgrade`,
    });
    expect(injected.statusCode).toBe(400);
    expect(provider.upgradeEnrollment).not.toHaveBeenCalled();

    const blocked = await app.inject({
      headers: { authorization: "Bearer valid", "idempotency-key": idempotencyKey },
      method: "POST",
      payload: { expectedVersion: 1, targetPathVersionId: versionId },
      url: `/v1/guided-learning/enrollments/${enrollmentId}/upgrade`,
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toEqual({ error: "active_attempt" });
    expect(provider.upgradeEnrollment).toHaveBeenCalledWith({
      enrollmentId,
      idempotencyKey,
      request: { expectedVersion: 1, targetPathVersionId: versionId },
      userId,
    });
    await app.close();
  });

  it("requires a UUID idempotency key and a strict attempt payload", async () => {
    const provider = fakeProvider();
    const app = await buildApp(environment, { guidedLearningProvider: provider, identityProvider });
    const missingKey = await app.inject({
      headers: { authorization: "Bearer valid" },
      method: "POST",
      payload: { clientAttemptId, stepOptionId: optionId },
      url: "/v1/guided-learning/attempts",
    });
    expect(missingKey.statusCode).toBe(400);

    const extraIdentity = await app.inject({
      headers: { authorization: "Bearer valid", "idempotency-key": idempotencyKey },
      method: "POST",
      payload: { clientAttemptId, stepOptionId: optionId, userId: otherStudentId },
      url: "/v1/guided-learning/attempts",
    });
    expect(extraIdentity.statusCode).toBe(400);
    expect(provider.createAttempt).not.toHaveBeenCalled();

    const valid = await app.inject({
      headers: { authorization: "Bearer valid", "idempotency-key": idempotencyKey },
      method: "POST",
      payload: { clientAttemptId, stepOptionId: optionId },
      url: "/v1/guided-learning/attempts",
    });
    expect(valid.statusCode).toBe(404);
    expect(provider.createAttempt).toHaveBeenCalledWith({
      idempotencyKey,
      request: { clientAttemptId, stepOptionId: optionId },
      userId,
    });
    await app.close();
  });

  it("scopes private media reads to the session and rejects unkeyed mutations", async () => {
    const provider = fakeProvider();
    const app = await buildApp(environment, { guidedLearningProvider: provider, identityProvider });
    const anonymousMedia = await app.inject({ method: "GET", url: `/v1/guided-learning/attempts/${attemptId}/media` });
    expect(anonymousMedia.statusCode).toBe(401);
    const media = await app.inject({
      headers: { authorization: "Bearer valid" },
      method: "GET",
      url: `/v1/guided-learning/attempts/${attemptId}/media`,
    });
    expect(media.statusCode).toBe(404);
    expect(provider.getAttemptMedia).toHaveBeenCalledWith({ attemptId, userId });

    const resume = await app.inject({
      headers: { authorization: "Bearer valid" },
      method: "PATCH",
      payload: { expectedVersion: 1, kind: "guide", offsetPercent: 0, sectionIndex: 0 },
      url: `/v1/guided-learning/attempts/${attemptId}/resume`,
    });
    expect(resume.statusCode).toBe(400);
    expect(provider.updateAttemptResume).not.toHaveBeenCalled();

    const videoResume = await app.inject({
      headers: { authorization: "Bearer valid", "idempotency-key": idempotencyKey },
      method: "PATCH",
      payload: {
        durationSeconds: 70,
        expectedVersion: 1,
        kind: "video",
        observedRanges: [{ endSeconds: 15, startSeconds: 0 }],
        positionSeconds: 15,
      },
      url: `/v1/guided-learning/attempts/${attemptId}/resume`,
    });
    expect(videoResume.statusCode).toBe(404);
    expect(provider.updateAttemptResume).toHaveBeenCalledWith({
      attemptId,
      idempotencyKey,
      request: {
        durationSeconds: 70,
        expectedVersion: 1,
        kind: "video",
        observedRanges: [{ endSeconds: 15, startSeconds: 0 }],
        positionSeconds: 15,
      },
      userId,
    });
    await app.close();
  });

  it("validates and scopes library equivalences to the authenticated account", async () => {
    const provider = fakeProvider();
    const app = await buildApp(environment, { guidedLearningProvider: provider, identityProvider });
    expect((await app.inject({
      headers: { authorization: "Bearer valid" },
      method: "GET",
      url: `/v1/guided-learning/library/options?sourceContentId=${topicId}&projection=unknown`,
    })).statusCode).toBe(400);
    const response = await app.inject({
      headers: { authorization: "Bearer valid" },
      method: "GET",
      url: `/v1/guided-learning/library/options?sourceContentId=${topicId}&projection=guide`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toContain("private");
    expect(provider.listLibraryOptions).toHaveBeenCalledWith({
      projection: "guide",
      sourceContentId: topicId,
      userId,
    });
    await app.close();
  });

  it("serves real home state and never turns a provider failure into zero progress", async () => {
    const unavailableProvider = fakeProvider();
    const unavailableApp = await buildApp(environment, {
      guidedLearningProvider: unavailableProvider,
      identityProvider,
    });
    const unavailable = await unavailableApp.inject({
      headers: { authorization: "Bearer valid" },
      method: "GET",
      url: "/v1/guided-learning/home",
    });
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.json()).toEqual({ error: "learning_unavailable" });
    await unavailableApp.close();

    const provider = fakeProvider();
    provider.getHome = vi.fn(async () => ({
      activePath: null,
      constancy: { activeDaysThisWeek: 0, weeklyGoalDays: null },
      counts: { activePaths: 0, dueReviews: 0, pendingEssentialSteps: 0 },
      generatedAt: now,
      milestones: [],
      points: 0,
      policyVersion: "recommendations-v1" as const,
      preferences: await provider.getPreferences({ userId }),
      tasks: [],
    }));
    const app = await buildApp(environment, { guidedLearningProvider: provider, identityProvider });
    expect((await app.inject({
      headers: { authorization: "Bearer valid" },
      method: "GET",
      url: "/v1/guided-learning/home?minutes=7",
    })).statusCode).toBe(400);
    const ready = await app.inject({
      headers: { authorization: "Bearer valid" },
      method: "GET",
      url: "/v1/guided-learning/home?minutes=5",
    });
    expect(ready.statusCode).toBe(200);
    expect(ready.headers["cache-control"]).toContain("no-store");
    expect(provider.getHome).toHaveBeenCalledWith({ minutes: 5, userId });
    await app.close();
  });

  it("requires idempotency and rejects injected identity on phase-four mutations", async () => {
    const provider = fakeProvider();
    const app = await buildApp(environment, { guidedLearningProvider: provider, identityProvider });
    expect((await app.inject({
      headers: { authorization: "Bearer valid" },
      method: "POST",
      payload: { clientAttemptId, sessionMinutes: 5 },
      url: "/v1/guided-learning/review-sessions",
    })).statusCode).toBe(400);
    const review = await app.inject({
      headers: { authorization: "Bearer valid", "idempotency-key": idempotencyKey },
      method: "POST",
      payload: { clientAttemptId, sessionMinutes: 5, userId: otherStudentId },
      url: "/v1/guided-learning/review-sessions",
    });
    expect(review.statusCode).toBe(400);
    expect(provider.createReviewSession).not.toHaveBeenCalled();

    const preference = await app.inject({
      headers: { authorization: "Bearer valid", "idempotency-key": idempotencyKey },
      method: "PATCH",
      payload: { expectedVersion: 0, timezone: "UTC", userId: otherStudentId },
      url: "/v1/guided-learning/preferences",
    });
    expect(preference.statusCode).toBe(400);
    expect(provider.updatePreferences).not.toHaveBeenCalled();

    const task = await app.inject({
      headers: { authorization: "Bearer valid", "idempotency-key": idempotencyKey },
      method: "PATCH",
      payload: { action: "snooze", taskKeys: ["step:test"], snoozedUntil: now, userId: otherStudentId },
      url: "/v1/guided-learning/tasks/override",
    });
    expect(task.statusCode).toBe(400);
    expect(provider.updateTaskOverride).not.toHaveBeenCalled();

    const step = await app.inject({
      headers: { authorization: "Bearer valid", "idempotency-key": idempotencyKey },
      method: "PATCH",
      payload: { action: "skip", enrollmentId, expectedVersion: 0, userId: otherStudentId },
      url: `/v1/guided-learning/steps/${optionId}/preference`,
    });
    expect(step.statusCode).toBe(400);
    expect(provider.updateStepPreference).not.toHaveBeenCalled();
    await app.close();
  });

  it("enforces editor capabilities and preview performs no student mutation", async () => {
    const provider = fakeProvider();
    const studentRoles = { getRoles: vi.fn(async () => []) } as unknown as ContentProvider;
    const deniedApp = await buildApp(environment, { contentProvider: studentRoles, guidedLearningProvider: provider, identityProvider });
    const denied = await deniedApp.inject({ headers: { authorization: "Bearer valid" }, method: "GET", url: "/v1/editor/learning-paths" });
    expect(denied.statusCode).toBe(403);
    await deniedApp.close();

    const creatorRoles = { getRoles: vi.fn(async () => ["content_creator" as const]) } as unknown as ContentProvider;
    const app = await buildApp(environment, { contentProvider: creatorRoles, guidedLearningProvider: provider, identityProvider });
    const preview = await app.inject({ headers: { authorization: "Bearer valid" }, method: "GET", url: `/v1/editor/learning-paths/${pathId}/preview` });
    expect(preview.statusCode).toBe(200);
    expect(provider.getEditorPath).toHaveBeenCalled();
    expect(provider.createEnrollment).not.toHaveBeenCalled();
    const resources = await app.inject({
      headers: { authorization: "Bearer valid" },
      method: "GET",
      url: "/v1/editor/learning-resources?limit=10&projection=quiz&q=corazon&topic=Torax",
    });
    expect(resources.statusCode).toBe(200);
    expect(provider.listEditorResources).toHaveBeenCalledWith({
      limit: 10,
      projection: "quiz",
      q: "corazon",
      topic: "Torax",
    });
    expect((await app.inject({
      headers: { authorization: "Bearer valid" },
      method: "GET",
      url: "/v1/editor/learning-resources?limit=200",
    })).statusCode).toBe(400);
    await app.close();
  });
});
