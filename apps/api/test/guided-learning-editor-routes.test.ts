import { describe, expect, it, vi } from "vitest";
import type {
  ContentProvider,
  GuidedLearningProvider,
  IdentityProvider,
  LearningPathDetail,
  PlatformRole,
} from "@cediah/contracts";
import { buildApp } from "../src/app.js";
import type { ApiEnvironment } from "../src/config.js";

const creatorId = "a1000000-0000-4000-8000-000000000001";
const coordinatorId = "a1000000-0000-4000-8000-000000000002";
const learnerId = "a1000000-0000-4000-8000-000000000003";
const foreignCreatorId = "a1000000-0000-4000-8000-000000000004";
const pathId = "a1000000-0000-4000-8000-000000000010";
const versionId = "a1000000-0000-4000-8000-000000000011";
const topicId = "a1000000-0000-4000-8000-000000000012";
const unitId = "a1000000-0000-4000-8000-000000000013";
const contentId = "a1000000-0000-4000-8000-000000000014";
const optionId = "a1000000-0000-4000-8000-000000000015";
const foreignOptionId = "a1000000-0000-4000-8000-000000000016";
const revisionId = "a1000000-0000-4000-8000-000000000017";
const itemId = "a1000000-0000-4000-8000-000000000018";

const environment: ApiEnvironment = {
  guidedLearningEnabled: true,
  HOST: "127.0.0.1",
  NODE_ENV: "test",
  PORT: 4000,
  VIDEO_TEST_PROVIDER: "s3",
  WEB_ORIGINS: "http://localhost:3000",
  webOrigins: new Set(["http://localhost:3000"]),
};

const identities = new Map([
  ["Bearer creator", { email: "creator@example.test", id: creatorId }],
  ["Bearer coordinator", { email: "coordinator@example.test", id: coordinatorId }],
  ["Bearer learner", { email: "learner@example.test", id: learnerId }],
  ["Bearer foreign", { email: "foreign@example.test", id: foreignCreatorId }],
]);

const identityProvider: IdentityProvider = {
  getUser: async (request) => identities.get(request.authorization ?? "") ?? null,
  revokeSessions: async () => undefined,
};

const roles = new Map<string, PlatformRole[]>([
  [creatorId, ["content_creator"]],
  [coordinatorId, ["coordinator"]],
  [learnerId, []],
  [foreignCreatorId, ["content_creator"]],
]);

const contentProvider = {
  getRoles: vi.fn(async (userId: string) => roles.get(userId) ?? []),
} as unknown as ContentProvider;

function detail(): LearningPathDetail {
  return {
    archivedAt: null,
    coverKey: "lungs",
    createdBy: creatorId,
    enrollment: null,
    id: pathId,
    slug: "ruta-editor-routes",
    summary: "Fixture local de rutas editoriales.",
    title: "Ruta editorial",
    topic: { id: topicId, title: "Tema de prueba" },
    version: {
      editVersion: 1,
      evidenceLevel: "standard",
      id: versionId,
      number: 1,
      policyVersion: "guided-v1",
      publishedAt: null,
      releaseNotes: "",
      status: "draft",
      units: [{
        id: unitId,
        objectives: [],
        pedagogyVersion: 1,
        position: 0,
        stableKey: "unidad-editorial",
        steps: [],
        title: "Unidad editorial",
      }],
    },
  };
}

function fixtureProvider() {
  let current = detail();
  const canRead = (input: { actorUserId: string; canEditAll: boolean }) =>
    input.canEditAll || input.actorUserId === creatorId;
  const provider = {
    createPath: vi.fn(async () => ({ status: "success" as const, value: current })),
    createVersion: vi.fn(async (input: { actorUserId: string; canEditAll: boolean }) =>
      canRead(input) ? { status: "success" as const, value: current } : { status: "not_found" as const }),
    deletePath: vi.fn(async (input: {
      actorUserId: string;
      canEditAll: boolean;
      expectedVersion: number;
    }) => {
      if (!canRead(input)) return { status: "not_found" as const };
      if (input.expectedVersion !== current.version.editVersion) return { status: "version_conflict" as const };
      if (current.version.status === "published") return { status: "conflict" as const };
      return { status: "success" as const, value: { id: current.id } };
    }),
    getEditorMaterialDetail: vi.fn(async (input: { contentId: string }) =>
      input.contentId === contentId
        ? {
            status: "success" as const,
            value: {
              currentSourceVersion: 4,
              estimatedMinutes: 8,
              explanationCoverage: "complete" as const,
              items: [{ id: itemId, kind: "question" as const, prompt: "¿Qué se comprueba?" }],
              projection: "quiz" as const,
              resourceRevisionId: null,
              sourceContentId: contentId,
              sourceVersion: 4,
              status: "ready" as const,
              title: "Cuestionario canónico",
            },
          }
        : { status: "not_found" as const }),
    getEditorOptionMaterialDetail: vi.fn(async (input: {
      actorUserId: string;
      canEditAll: boolean;
      optionId: string;
      pathId: string;
    }) => canRead(input) && input.pathId === pathId && input.optionId === optionId
      ? {
          status: "success" as const,
          value: {
            currentSourceVersion: 4,
            estimatedMinutes: 8,
            explanationCoverage: "complete" as const,
            items: [{ id: itemId, kind: "question" as const, prompt: "Pregunta fijada" }],
            projection: "quiz" as const,
            resourceRevisionId: revisionId,
            sourceContentId: contentId,
            sourceVersion: 3,
            status: "ready" as const,
            title: "Cuestionario fijado",
          },
        }
      : { status: "not_found" as const }),
    getEditorPath: vi.fn(async (input: { actorUserId: string; canEditAll: boolean }) =>
      canRead(input) ? { status: "success" as const, value: current } : { status: "not_found" as const }),
    listEditorPaths: vi.fn(async (input: { actorUserId: string; canEditAll: boolean }) =>
      canRead(input) ? [current] : []),
    listEditorResources: vi.fn(async () => ({ items: [], nextCursor: null, resourceTopics: [], topics: [] })),
    transitionPath: vi.fn(async (input: {
      canPublish: boolean;
      canReview: boolean;
      expectedVersion: number;
      status: string;
    }) => {
      if (input.expectedVersion !== current.version.editVersion) return { status: "version_conflict" as const };
      if (["approved", "published", "archived"].includes(input.status) && (!input.canReview || !input.canPublish)) {
        return { status: "forbidden" as const };
      }
      return { status: "success" as const, value: current };
    }),
    updatePath: vi.fn(async (input: {
      actorUserId: string;
      canEditAll: boolean;
      update: { definition: { units: unknown[] }; expectedVersion: number };
    }) => {
      if (!canRead(input)) return { status: "not_found" as const };
      if (current.version.status !== "draft") return { status: "conflict" as const };
      if (input.update.expectedVersion !== current.version.editVersion) return { status: "version_conflict" as const };
      current = {
        ...current,
        version: {
          ...current.version,
          editVersion: current.version.editVersion + 1,
          units: input.update.definition.units.length === 0 ? [] : current.version.units,
        },
      };
      return { status: "success" as const, value: current };
    }),
    validatePath: vi.fn(async (input: { expectedVersion?: number }) =>
      input.expectedVersion === undefined || input.expectedVersion === current.version.editVersion
        ? {
            status: "success" as const,
            value: { issues: [], ready: true, validatedEditVersion: current.version.editVersion },
          }
        : { status: "version_conflict" as const }),
  } as unknown as GuidedLearningProvider;
  return {
    get current() {
      return current;
    },
    provider,
    setStatus(status: LearningPathDetail["version"]["status"]) {
      current = { ...current, version: { ...current.version, status } };
    },
  };
}

const creatorHeaders = { authorization: "Bearer creator" };

describe("guided-learning editor Fastify routes", () => {
  it("enforces identity, editor roles, ownership and coordinator access", async () => {
    const fixture = fixtureProvider();
    const app = await buildApp(environment, {
      contentProvider,
      guidedLearningProvider: fixture.provider,
      identityProvider,
    });

    expect((await app.inject({ method: "GET", url: `/v1/editor/learning-paths/${pathId}` })).statusCode).toBe(401);
    expect((await app.inject({
      headers: { authorization: "Bearer learner" },
      method: "GET",
      url: `/v1/editor/learning-paths/${pathId}`,
    })).statusCode).toBe(403);
    expect((await app.inject({
      headers: { authorization: "Bearer foreign" },
      method: "GET",
      url: `/v1/editor/learning-paths/${pathId}`,
    })).statusCode).toBe(404);
    const coordinator = await app.inject({
      headers: { authorization: "Bearer coordinator" },
      method: "GET",
      url: `/v1/editor/learning-paths/${pathId}`,
    });
    expect(coordinator.statusCode).toBe(200);
    expect(coordinator.headers["cache-control"]).toBe("private, no-store");
    expect(fixture.provider.getEditorPath).toHaveBeenLastCalledWith({
      actorUserId: coordinatorId,
      canEditAll: true,
      pathId,
    });
    await app.close();
  });

  it("persists a unit deletion through PATCH then GET and rejects extra request keys", async () => {
    const fixture = fixtureProvider();
    const app = await buildApp(environment, {
      contentProvider,
      guidedLearningProvider: fixture.provider,
      identityProvider,
    });
    const payload = {
      coverKey: "lungs",
      definition: {
        evidenceLevel: "standard",
        policyVersion: "guided-v1",
        releaseNotes: "",
        units: [],
      },
      expectedVersion: 1,
      slug: "ruta-editor-routes",
      summary: "Fixture local de rutas editoriales.",
      title: "Ruta editorial",
      topicContentId: topicId,
    };
    const patched = await app.inject({
      headers: creatorHeaders,
      method: "PATCH",
      payload,
      url: `/v1/editor/learning-paths/${pathId}`,
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.headers["cache-control"]).toBe("private, no-store");
    expect(patched.json().version).toMatchObject({ editVersion: 2, units: [] });
    const reloaded = await app.inject({
      headers: creatorHeaders,
      method: "GET",
      url: `/v1/editor/learning-paths/${pathId}`,
    });
    expect(reloaded.statusCode).toBe(200);
    expect(reloaded.json().version.units).toEqual([]);
    expect(fixture.provider.updatePath).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: creatorId,
      canEditAll: false,
      pathId,
      update: expect.objectContaining({ expectedVersion: 1 }),
    }));

    const callsBefore = vi.mocked(fixture.provider.updatePath).mock.calls.length;
    const invalid = await app.inject({
      headers: creatorHeaders,
      method: "PATCH",
      payload: { ...payload, expectedVersion: 2, internalPath: "not exposed" },
      url: `/v1/editor/learning-paths/${pathId}`,
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toEqual({
      error: "invalid_request",
      fieldErrors: [{ code: "unrecognized_keys", path: "" }],
    });
    expect(JSON.stringify(invalid.json())).not.toContain("not exposed");
    expect(vi.mocked(fixture.provider.updatePath).mock.calls).toHaveLength(callsBefore);

    fixture.setStatus("published");
    const immutable = await app.inject({
      headers: creatorHeaders,
      method: "PATCH",
      payload: { ...payload, expectedVersion: 2 },
      url: `/v1/editor/learning-paths/${pathId}`,
    });
    expect(immutable.statusCode).toBe(409);
    expect(immutable.json()).toEqual({ error: "conflict" });
    await app.close();
  });

  it("deletes an owned unpublished route with version checks and protected access", async () => {
    const fixture = fixtureProvider();
    const app = await buildApp(environment, {
      contentProvider,
      guidedLearningProvider: fixture.provider,
      identityProvider,
    });

    const foreign = await app.inject({
      headers: { authorization: "Bearer foreign" },
      method: "DELETE",
      payload: { expectedVersion: 1 },
      url: `/v1/editor/learning-paths/${pathId}`,
    });
    expect(foreign.statusCode).toBe(404);

    const stale = await app.inject({
      headers: creatorHeaders,
      method: "DELETE",
      payload: { expectedVersion: 2 },
      url: `/v1/editor/learning-paths/${pathId}`,
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({ error: "version_conflict" });

    const invalid = await app.inject({
      headers: creatorHeaders,
      method: "DELETE",
      payload: { expectedVersion: 1, actorUserId: foreignCreatorId },
      url: `/v1/editor/learning-paths/${pathId}`,
    });
    expect(invalid.statusCode).toBe(400);

    const deleted = await app.inject({
      headers: creatorHeaders,
      method: "DELETE",
      payload: { expectedVersion: 1 },
      url: `/v1/editor/learning-paths/${pathId}`,
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.headers["cache-control"]).toBe("private, no-store");
    expect(deleted.json()).toEqual({ id: pathId });
    expect(fixture.provider.deletePath).toHaveBeenLastCalledWith({
      actorUserId: creatorId,
      canEditAll: false,
      expectedVersion: 1,
      pathId,
    });
    await app.close();
  });

  it("returns canonical and fixed material details read-only and hides foreign option ids", async () => {
    const fixture = fixtureProvider();
    const app = await buildApp(environment, {
      contentProvider,
      guidedLearningProvider: fixture.provider,
      identityProvider,
    });
    const current = await app.inject({
      headers: creatorHeaders,
      method: "GET",
      url: `/v1/editor/learning-resources/${contentId}?projection=quiz`,
    });
    expect(current.statusCode).toBe(200);
    expect(current.headers["cache-control"]).toBe("private, no-store");
    expect(current.json()).toMatchObject({
      currentSourceVersion: 4,
      resourceRevisionId: null,
      sourceVersion: 4,
      status: "ready",
    });
    const fixed = await app.inject({
      headers: creatorHeaders,
      method: "GET",
      url: `/v1/editor/learning-paths/${pathId}/materials/${optionId}`,
    });
    expect(fixed.statusCode).toBe(200);
    expect(fixed.headers["cache-control"]).toBe("private, no-store");
    expect(fixed.json()).toMatchObject({
      currentSourceVersion: 4,
      resourceRevisionId: revisionId,
      sourceVersion: 3,
      status: "ready",
    });
    const foreign = await app.inject({
      headers: creatorHeaders,
      method: "GET",
      url: `/v1/editor/learning-paths/${pathId}/materials/${foreignOptionId}`,
    });
    expect(foreign.statusCode).toBe(404);
    expect(foreign.json()).toEqual({ error: "not_found" });
    expect(JSON.stringify(foreign.json())).not.toContain(revisionId);
    await app.close();
  });

  it("uses the requested saved version and passes review capabilities without trusting body identity", async () => {
    const fixture = fixtureProvider();
    const app = await buildApp(environment, {
      contentProvider,
      guidedLearningProvider: fixture.provider,
      identityProvider,
    });
    const stale = await app.inject({
      headers: creatorHeaders,
      method: "POST",
      payload: { expectedVersion: 2 },
      url: `/v1/editor/learning-paths/${pathId}/validate`,
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({ error: "version_conflict" });
    const validated = await app.inject({
      headers: creatorHeaders,
      method: "POST",
      payload: { expectedVersion: 1 },
      url: `/v1/editor/learning-paths/${pathId}/validate`,
    });
    expect(validated.statusCode).toBe(200);
    expect(validated.json()).toEqual({ issues: [], ready: true, validatedEditVersion: 1 });

    const denied = await app.inject({
      headers: creatorHeaders,
      method: "POST",
      payload: { expectedVersion: 1, status: "published" },
      url: `/v1/editor/learning-paths/${pathId}/transition`,
    });
    expect(denied.statusCode).toBe(403);
    const approved = await app.inject({
      headers: { authorization: "Bearer coordinator" },
      method: "POST",
      payload: { expectedVersion: 1, status: "published" },
      url: `/v1/editor/learning-paths/${pathId}/transition`,
    });
    expect(approved.statusCode).toBe(200);
    expect(fixture.provider.transitionPath).toHaveBeenLastCalledWith({
      actorUserId: coordinatorId,
      canPublish: true,
      canReview: true,
      expectedVersion: 1,
      pathId,
      status: "published",
    });
    await app.close();
  });
});
