import { createHmac } from "node:crypto";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import { z } from "zod";
import {
  AdminRoleLookupQuerySchema,
  AdminRoleMutationRequestSchema,
  AdminRoleResponseSchema,
  ContentAssetSchema,
  ContentAssetUploadRequestSchema,
  ContentAssetUploadResponseSchema,
  ContentCatalogResponseSchema,
  ContentDraftSchema,
  ContentItemSchema,
  ContentKindSchema,
  ContentTransitionRequestSchema,
  ContentWorkspaceResponseSchema,
  DeletedSubjectSchema,
  ContentSubjectAssignmentRequestSchema,
  SubjectCatalogResponseSchema,
  SubjectCreateRequestSchema,
  SubjectDetailResponseSchema,
  SubjectResponseSchema,
  CurrentUserResponseSchema,
  type ContentMutationFailure,
  type IdentityRequest,
  type SubjectMutationFailure,
  type SubjectProvider,
  type ContentProvider,
  type IdentityProvider,
  type RoleManagementProvider,
  HealthResponseSchema,
  LessonProgressRouteParamsSchema,
  LessonProgressResponseSchema,
  type LearningProvider,
  TestVideoAssetResponseSchema,
  TestVideoUploadRequestSchema,
  TestVideoUploadResponseSchema,
  UpdateLessonProgressRequestSchema,
  type ProviderUser,
  type VideoProvider,
} from "@cediah/contracts";
import { type ApiEnvironment, readEnvironment } from "./config.js";
import { type AuthService, createBetterAuthService } from "./auth.js";
import { getContentCapabilities } from "./content-authorization.js";
import { createPostgresDatabase, createPostgresPool } from "./db/database.js";
import { applySqlMigrations } from "./db/migrate.js";
import { createCloudflareStreamVideoProvider } from "./providers/cloudflare-stream.js";
import { createPostgresLearningProvider } from "./providers/postgres-learning.js";
import { createPostgresContentProvider } from "./providers/postgres-content.js";
import { createPostgresRoleManagementProvider } from "./providers/postgres-role-management.js";
import { createPostgresSubjectProvider } from "./providers/postgres-subjects.js";
import { createS3ObjectStorage } from "./providers/s3-object-storage.js";
import { createS3VideoProvider } from "./providers/s3-video.js";

type AppDependencies = {
  authService?: AuthService;
  contentProvider?: ContentProvider;
  subjectProvider?: SubjectProvider;
  roleManagementProvider?: RoleManagementProvider;
  identityProvider?: IdentityProvider;
  learningProvider?: LearningProvider;
  videoProvider?: VideoProvider;
};

type UserResolution =
  | { kind: "authenticated"; user: ProviderUser }
  | { kind: "identity_unavailable" }
  | { kind: "unauthorized" };

type EditorResolution =
  | {
      capabilities: ReturnType<typeof getContentCapabilities>;
      kind: "authenticated";
      roles: Awaited<ReturnType<ContentProvider["getRoles"]>>;
      user: ProviderUser;
    }
  | { kind: "content_unavailable" }
  | Exclude<UserResolution, { kind: "authenticated" }>;

type AdministratorResolution =
  | {
      kind: "authenticated";
      roles: Awaited<ReturnType<RoleManagementProvider["getRoles"]>>;
      user: ProviderUser;
    }
  | { kind: "forbidden" }
  | { kind: "role_unavailable" }
  | Exclude<UserResolution, { kind: "authenticated" }>;

const ContentIdParamsSchema = z.object({ contentId: z.string().uuid() });
const DeletedContentSchema = z.object({ id: z.string().uuid() });
const ContentAssetIdParamsSchema = z.object({ assetId: z.string().uuid() });
const ContentSlugParamsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});
const SubjectSlugParamsSchema = ContentSlugParamsSchema;
const SubjectIdParamsSchema = z.object({ subjectId: z.string().uuid() });
const ContentListQuerySchema = z.object({
  kind: ContentKindSchema.optional(),
  linkedVideoId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  subjectId: z.string().uuid().optional(),
  sort: z.enum(["recent", "views"]).optional(),
});

const directUploadLifetimeMilliseconds = 15 * 60 * 1_000;
const playbackLifetimeSeconds = 10 * 60;
const VideoIdPattern = /^[A-Za-z0-9_-]{1,64}$/;

function toIdentityRequest(headers: FastifyRequest["headers"]): IdentityRequest {
  const forwardedFor = headers["x-forwarded-for"];
  return {
    authorization: headers.authorization,
    cookie: headers.cookie,
    forwardedFor: Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor,
    userAgent: headers["user-agent"],
  };
}

async function resolveRequestUser(
  request: IdentityRequest,
  identityProvider: IdentityProvider | undefined,
): Promise<UserResolution> {
  if (!request.authorization && !request.cookie) return { kind: "unauthorized" };
  if (!identityProvider) return { kind: "identity_unavailable" };

  try {
    const user = await identityProvider.getUser(request);
    return user ? { kind: "authenticated", user } : { kind: "unauthorized" };
  } catch {
    return { kind: "identity_unavailable" };
  }
}

async function resolveEditorUser(
  request: IdentityRequest,
  identityProvider: IdentityProvider | undefined,
  contentProvider: ContentProvider | undefined,
): Promise<EditorResolution> {
  const resolution = await resolveRequestUser(request, identityProvider);
  if (resolution.kind !== "authenticated") return resolution;
  if (!contentProvider) return { kind: "content_unavailable" };

  try {
    const roles = await contentProvider.getRoles(resolution.user.id);
    return {
      capabilities: getContentCapabilities(roles),
      kind: "authenticated",
      roles,
      user: resolution.user,
    };
  } catch {
    return { kind: "content_unavailable" };
  }
}

async function resolveAdministratorUser(
  request: IdentityRequest,
  identityProvider: IdentityProvider | undefined,
  roleManagementProvider: RoleManagementProvider | undefined,
): Promise<AdministratorResolution> {
  const resolution = await resolveRequestUser(request, identityProvider);
  if (resolution.kind !== "authenticated") return resolution;
  if (!roleManagementProvider) return { kind: "role_unavailable" };

  try {
    const roles = await roleManagementProvider.getRoles(resolution.user.id);
    if (!roles.includes("administrator")) return { kind: "forbidden" };
    return { kind: "authenticated", roles, user: resolution.user };
  } catch {
    return { kind: "role_unavailable" };
  }
}

function sendUserResolutionError(
  resolution: Exclude<UserResolution, { kind: "authenticated" }>,
  reply: FastifyReply,
) {
  if (resolution.kind === "unauthorized") {
    return reply.status(401).header("Cache-Control", "no-store").send({ error: "unauthorized" });
  }

  return reply.status(503).header("Cache-Control", "no-store").send({ error: "identity_unavailable" });
}

function sendEditorResolutionError(
  resolution: Exclude<EditorResolution, { kind: "authenticated" }>,
  reply: FastifyReply,
) {
  if (resolution.kind === "content_unavailable") {
    return reply
      .status(503)
      .header("Cache-Control", "no-store")
      .send({ error: "content_unavailable" });
  }

  return sendUserResolutionError(resolution, reply);
}

function sendAdministratorResolutionError(
  resolution: Exclude<AdministratorResolution, { kind: "authenticated" }>,
  reply: FastifyReply,
) {
  if (resolution.kind === "forbidden") {
    return reply.status(403).header("Cache-Control", "no-store").send({ error: "forbidden" });
  }
  if (resolution.kind === "role_unavailable") {
    return reply
      .status(503)
      .header("Cache-Control", "no-store")
      .send({ error: "role_management_unavailable" });
  }
  return sendUserResolutionError(resolution, reply);
}

function sendRoleManagementError(
  error: "forbidden" | "last_administrator" | "not_found" | "conflict",
  reply: FastifyReply,
) {
  if (error === "forbidden") {
    return reply.status(403).header("Cache-Control", "no-store").send({ error: "forbidden" });
  }
  if (error === "not_found") {
    return reply.status(404).header("Cache-Control", "no-store").send({ error: "user_not_found" });
  }
  if (error === "last_administrator") {
    return reply.status(409).header("Cache-Control", "no-store").send({ error: "last_administrator" });
  }
  return reply.status(409).header("Cache-Control", "no-store").send({ error: "role_conflict" });
}

function sendContentMutationError(error: ContentMutationFailure, reply: FastifyReply) {
  if (error === "not_found") {
    return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
  }
  if (error === "forbidden") {
    return reply.status(403).header("Cache-Control", "no-store").send({ error: "forbidden" });
  }

  return reply
    .status(409)
    .header("Cache-Control", "no-store")
    .send({ error: error === "not_publishable" ? "content_not_publishable" : "content_conflict" });
}

function sendSubjectMutationError(error: SubjectMutationFailure, reply: FastifyReply) {
  if (error === "not_found") {
    return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
  }
  if (error === "forbidden") {
    return reply.status(403).header("Cache-Control", "no-store").send({ error: "forbidden" });
  }
  return reply.status(409).header("Cache-Control", "no-store").send({ error: "subject_conflict" });
}

export async function buildApp(
  environment: ApiEnvironment = readEnvironment(),
  dependencies: AppDependencies = {},
): Promise<FastifyInstance> {
  const pool = environment.databaseUrl
    ? createPostgresPool({ connectionString: environment.databaseUrl })
    : undefined;
  if (pool && environment.migrationsEnabled !== false && environment.migrationsPath) {
    try {
      await applySqlMigrations(pool, environment.migrationsPath);
    } catch (error) {
      await pool.end();
      throw error;
    }
  }
  const database = pool ? createPostgresDatabase(pool) : undefined;
  const contentAssetStorage = environment.contentStorage
    ? createS3ObjectStorage(environment.contentStorage)
    : undefined;
  const createdAuthService =
    environment.auth && pool
      ? createBetterAuthService(environment.auth, { pool })
      : undefined;
  const authService = dependencies.authService ?? createdAuthService;
  const contentProvider =
    dependencies.contentProvider ??
    (database
      ? createPostgresContentProvider(database, { assetStorage: contentAssetStorage })
      : undefined);
  const subjectProvider =
    dependencies.subjectProvider ??
    (database ? createPostgresSubjectProvider(database) : undefined);
  const roleManagementProvider =
    dependencies.roleManagementProvider ??
    (database ? createPostgresRoleManagementProvider(database) : undefined);
  const identityProvider =
    dependencies.identityProvider ??
    authService;
  const learningProvider =
    dependencies.learningProvider ??
    (database ? createPostgresLearningProvider(database) : undefined);
  const videoProvider =
    dependencies.videoProvider ??
    (environment.VIDEO_TEST_PROVIDER === "s3"
      ? environment.videoStorage
        ? createS3VideoProvider(createS3ObjectStorage(environment.videoStorage), {
            maxFileSizeBytes: environment.testVideoUpload?.maxFileSizeBytes,
          })
        : undefined
      : environment.cloudflareStream
        ? createCloudflareStreamVideoProvider(
            environment.cloudflareStream,
            [...environment.webOrigins].map((origin) => new URL(origin).host),
          )
        : undefined);
  const app = Fastify({
    bodyLimit: 1_048_576,
    logger:
      environment.NODE_ENV === "test"
        ? false
        : {
            level: environment.NODE_ENV === "production" ? "info" : "debug",
            redact: [
              "req.headers.authorization",
              "req.headers.cookie",
              "res.headers.set-cookie",
            ],
          },
    requestIdHeader: false,
    trustProxy: false,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  await app.register(cors, {
    credentials: true,
    methods: ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST"],
    origin(origin, callback) {
      if (!origin || environment.webOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed"), false);
    },
  });

  if (authService) {
    app.route({
      method: ["GET", "POST"],
      url: "/api/auth/*",
      async handler(request, reply) {
        const headers = new Headers();
        for (const [name, value] of Object.entries(request.headers)) {
          if (Array.isArray(value)) {
            value.forEach((item) => headers.append(name, item));
          } else if (value !== undefined) {
            headers.set(name, String(value));
          }
        }

        const method = request.method.toUpperCase();
        const body =
          method === "GET" || method === "HEAD" || request.body === undefined
            ? undefined
            : typeof request.body === "string"
              ? request.body
              : JSON.stringify(request.body);
        const authRequest = new Request(
          new URL(request.url, `http://${request.headers.host ?? "localhost"}`),
          { body, headers, method },
        );
        const response = await authService.handle(authRequest);

        reply.status(response.status);
        response.headers.forEach((value, name) => {
          if (name.toLowerCase() !== "set-cookie") reply.header(name, value);
        });
        const responseHeaders = response.headers as Headers & {
          getSetCookie?: () => string[];
        };
        const setCookies = responseHeaders.getSetCookie?.() ?? [];
        if (setCookies.length > 0) reply.header("set-cookie", setCookies);
        return reply.send(response.body ? await response.text() : null);
      },
    });
  }

  app.addHook("onClose", async () => {
    await createdAuthService?.close();
    await database?.destroy();
  });

  app.get("/health", async (_request, reply) => {
    const response = HealthResponseSchema.parse({
      checkedAt: new Date().toISOString(),
      environment: environment.NODE_ENV,
      service: "cediah-api",
      status: "ok",
      version: "0.1.0",
    });
    return reply.header("Cache-Control", "no-store").send(response);
  });

  app.get("/v1/auth/me", async (request, reply) => {
    const resolution = await resolveRequestUser(toIdentityRequest(request.headers), identityProvider);
    if (resolution.kind !== "authenticated") return sendUserResolutionError(resolution, reply);

    let roles: Awaited<ReturnType<ContentProvider["getRoles"]>> = [];
    const roleReader = contentProvider ?? roleManagementProvider;
    if (roleReader) {
      try {
        roles = await roleReader.getRoles(resolution.user.id);
      } catch {
        request.log.error("Current-user role lookup failed");
      }
    }

    const response = CurrentUserResponseSchema.parse({ roles, user: resolution.user });
    return reply.header("Cache-Control", "no-store").send(response);
  });

  app.get("/v1/learning/dashboard", async (request, reply) => {
    const resolution = await resolveRequestUser(toIdentityRequest(request.headers), identityProvider);
    if (resolution.kind !== "authenticated") return sendUserResolutionError(resolution, reply);
    if (!learningProvider) {
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "learning_unavailable" });
    }

    try {
      const response = await learningProvider.getStudentDashboard(resolution.user.id);
      return reply.header("Cache-Control", "no-store").send(response);
    } catch {
      request.log.error("Learning dashboard request failed");
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "learning_unavailable" });
    }
  });

  app.patch<{ Body: unknown; Params: { lessonId: string } }>(
    "/v1/learning/lessons/:lessonId/progress",
    async (request, reply) => {
      const resolution = await resolveRequestUser(toIdentityRequest(request.headers), identityProvider);
      if (resolution.kind !== "authenticated") return sendUserResolutionError(resolution, reply);
      if (!learningProvider) {
        return reply.status(503).header("Cache-Control", "no-store").send({ error: "learning_unavailable" });
      }

      const params = LessonProgressRouteParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }

      const input = UpdateLessonProgressRequestSchema.safeParse(request.body);
      if (!input.success) {
        return reply
          .status(400)
          .header("Cache-Control", "no-store")
          .send({ error: "invalid_lesson_progress" });
      }

      try {
        const progress = await learningProvider.updateLessonProgress({
          lessonId: params.data.lessonId,
          userId: resolution.user.id,
          watchedSeconds: input.data.watchedSeconds,
        });
        if (!progress) return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });

        const response = LessonProgressResponseSchema.parse(progress);
        return reply.header("Cache-Control", "no-store").send(response);
      } catch {
        request.log.error("Lesson-progress update failed");
        return reply.status(503).header("Cache-Control", "no-store").send({ error: "learning_unavailable" });
      }
    },
  );

  app.get("/v1/subjects", async (request, reply) => {
    if (!subjectProvider) {
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }

    try {
      const subjects = await subjectProvider.listSubjects({ publishedOnly: true });
      return reply
        .header("Cache-Control", "public, max-age=30, stale-while-revalidate=120")
        .send(SubjectCatalogResponseSchema.parse({ subjects }));
    } catch {
      request.log.error("Published-subject request failed");
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }
  });

  app.get<{ Params: { slug: string } }>("/v1/subjects/:slug", async (request, reply) => {
    if (!subjectProvider || !contentProvider) {
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }

    const params = SubjectSlugParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
    }

    try {
      const subject = await subjectProvider.getSubjectBySlug(params.data.slug);
      if (!subject) return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      const items = await contentProvider.listPublished({ limit: 100, subjectId: subject.id });
      return reply
        .header("Cache-Control", "public, max-age=30, stale-while-revalidate=120")
        .send(SubjectDetailResponseSchema.parse({ items, subject }));
    } catch {
      request.log.error("Published-subject detail request failed");
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }
  });
  app.get<{ Querystring: unknown }>("/v1/content", async (request, reply) => {
    if (!contentProvider) {
      return reply
        .status(503)
        .header("Cache-Control", "no-store")
        .send({ error: "content_unavailable" });
    }

    const query = ContentListQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply
        .status(400)
        .header("Cache-Control", "no-store")
        .send({ error: "invalid_content_query" });
    }

    try {
      const items = await contentProvider.listPublished(query.data);
      const response = ContentCatalogResponseSchema.parse({ items });
      return reply
        .header("Cache-Control", "public, max-age=30, stale-while-revalidate=120")
        .send(response);
    } catch {
      request.log.error("Published-content request failed");
      return reply
        .status(503)
        .header("Cache-Control", "no-store")
        .send({ error: "content_unavailable" });
    }
  });

  app.get<{ Params: { slug: string } }>("/v1/content/:slug", async (request, reply) => {
    if (!contentProvider) {
      return reply
        .status(503)
        .header("Cache-Control", "no-store")
        .send({ error: "content_unavailable" });
    }

    const params = ContentSlugParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
    }

    try {
      const item = await contentProvider.getPublishedBySlug(params.data.slug);
      if (!item) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }

      return reply
        .header("Cache-Control", "public, max-age=30, stale-while-revalidate=120")
        .send(ContentItemSchema.parse(item));
    } catch {
      request.log.error("Published-content detail request failed");
      return reply
        .status(503)
        .header("Cache-Control", "no-store")
        .send({ error: "content_unavailable" });
    }
  });

  app.post<{ Params: { contentId: string } }>("/v1/content/:contentId/views", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const params = ContentIdParamsSchema.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: "invalid_content_id" });
    const viewer = await resolveRequestUser(toIdentityRequest(request.headers), identityProvider);
    if (viewer.kind !== "authenticated") {
      return reply.status(viewer.kind === "unauthorized" ? 401 : 503).send({ error: viewer.kind });
    }
    if (!contentProvider?.recordView || !environment.auth?.secret) {
      return reply.status(503).send({ error: "views_unavailable" });
    }
    try {
      const viewerKey = createHmac("sha256", environment.auth.secret)
        .update(`content-view:${params.data.contentId}:${viewer.user.id}`)
        .digest("hex");
      const result = await contentProvider.recordView({ contentId: params.data.contentId, viewerKey });
      if (result.status !== "success") return reply.status(404).send({ error: "not_found" });
      return reply.send(result.value);
    } catch {
      request.log.error("Content-view recording failed");
      return reply.status(503).send({ error: "views_unavailable" });
    }
  });

  app.get("/v1/editor/content", async (request, reply) => {
    const editor = await resolveEditorUser(
      toIdentityRequest(request.headers),
      identityProvider,
      contentProvider,
    );
    if (editor.kind !== "authenticated") return sendEditorResolutionError(editor, reply);
    if (!editor.capabilities.canCreate && !editor.capabilities.canEditAll) {
      return reply.status(403).header("Cache-Control", "no-store").send({ error: "forbidden" });
    }

    try {
      const items = await contentProvider!.getWorkspace({
        actorUserId: editor.user.id,
        roles: editor.roles,
      });
      const subjects = subjectProvider
        ? await subjectProvider.listSubjects({ publishedOnly: false })
        : [];
      const topics = contentProvider!.listTopics
        ? await contentProvider!.listTopics()
        : [];
      return reply.header("Cache-Control", "no-store").send(
        ContentWorkspaceResponseSchema.parse({
          capabilities: { ...editor.capabilities, canUpload: false },
          items,
          roles: editor.roles,
          subjects,
          topics,
        }),
      );
    } catch {
      request.log.error("Content workspace request failed");
      return reply
        .status(503)
        .header("Cache-Control", "no-store")
        .send({ error: "content_unavailable" });
    }
  });

  app.post<{ Body: unknown }>("/v1/editor/subjects", async (request, reply) => {
    const editor = await resolveEditorUser(
      toIdentityRequest(request.headers),
      identityProvider,
      contentProvider,
    );
    if (editor.kind !== "authenticated") return sendEditorResolutionError(editor, reply);
    if (!editor.capabilities.canManageTaxonomy) {
      return reply.status(403).header("Cache-Control", "no-store").send({ error: "forbidden" });
    }
    if (!subjectProvider) {
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }

    const input = SubjectCreateRequestSchema.safeParse(request.body);
    if (!input.success) {
      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_subject" });
    }

    try {
      const result = await subjectProvider.createSubject({
        actorUserId: editor.user.id,
        name: input.data.name,
      });
      if (result.status !== "success") return sendSubjectMutationError(result.status, reply);
      return reply
        .status(201)
        .header("Cache-Control", "no-store")
        .send(SubjectResponseSchema.parse({ subject: result.value }));
    } catch {
      request.log.error("Subject creation failed");
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }
  });
  app.delete<{ Params: { subjectId: string } }>(
    "/v1/editor/subjects/:subjectId",
    async (request, reply) => {
      const editor = await resolveEditorUser(
        toIdentityRequest(request.headers),
        identityProvider,
        contentProvider,
      );
      if (editor.kind !== "authenticated") return sendEditorResolutionError(editor, reply);
      if (!editor.capabilities.canManageTaxonomy) {
        return reply.status(403).header("Cache-Control", "no-store").send({ error: "forbidden" });
      }
      if (!subjectProvider) {
        return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
      }

      const params = SubjectIdParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }

      try {
        const result = await subjectProvider.deleteSubject({
          actorUserId: editor.user.id,
          subjectId: params.data.subjectId,
        });
        if (result.status !== "success") return sendSubjectMutationError(result.status, reply);
        return reply
          .header("Cache-Control", "no-store")
          .send(DeletedSubjectSchema.parse(result.value));
      } catch {
        request.log.error("Subject deletion failed");
        return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
      }
    },
  );
  app.post<{ Body: unknown }>("/v1/editor/content", async (request, reply) => {
    const editor = await resolveEditorUser(
      toIdentityRequest(request.headers),
      identityProvider,
      contentProvider,
    );
    if (editor.kind !== "authenticated") return sendEditorResolutionError(editor, reply);
    if (!editor.capabilities.canCreate) {
      return reply.status(403).header("Cache-Control", "no-store").send({ error: "forbidden" });
    }

    const draft = ContentDraftSchema.safeParse(request.body);
    if (!draft.success) {
      return reply
        .status(400)
        .header("Cache-Control", "no-store")
        .send({ error: "invalid_content" });
    }
    if (draft.data.kind === "topic" && !editor.capabilities.canManageTaxonomy) {
      return reply.status(403).header("Cache-Control", "no-store").send({ error: "forbidden" });
    }

    try {
      const result = await contentProvider!.createContent({
        actorUserId: editor.user.id,
        draft: draft.data,
        roles: editor.roles,
      });
      if (result.status !== "success") return sendContentMutationError(result.status, reply);

      return reply
        .status(201)
        .header("Cache-Control", "no-store")
        .send(ContentItemSchema.parse(result.value));
    } catch {
      request.log.error("Content creation failed");
      return reply
        .status(503)
        .header("Cache-Control", "no-store")
        .send({ error: "content_unavailable" });
    }
  });

  app.patch<{ Body: unknown; Params: { contentId: string } }>(
    "/v1/editor/content/:contentId/subjects",
    async (request, reply) => {
      const editor = await resolveEditorUser(
        toIdentityRequest(request.headers),
        identityProvider,
        contentProvider,
      );
      if (editor.kind !== "authenticated") return sendEditorResolutionError(editor, reply);
      if (!editor.capabilities.canEditAll) {
        return reply.status(403).header("Cache-Control", "no-store").send({ error: "forbidden" });
      }
      if (!contentProvider?.assignSubjects) {
        return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
      }

      const params = ContentIdParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }
      const assignment = ContentSubjectAssignmentRequestSchema.safeParse(request.body);
      if (!assignment.success) {
        return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_subject" });
      }

      try {
        const result = await contentProvider.assignSubjects({
          actorUserId: editor.user.id,
          contentId: params.data.contentId,
          roles: editor.roles,
          subjectIds: assignment.data.subjectIds,
        });
        if (result.status !== "success") return sendContentMutationError(result.status, reply);
        return reply
          .header("Cache-Control", "no-store")
          .send(ContentItemSchema.parse(result.value));
      } catch {
        request.log.error("Content subject assignment failed");
        return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
      }
    },
  );
  app.patch<{ Body: unknown; Params: { contentId: string } }>(
    "/v1/editor/content/:contentId",
    async (request, reply) => {
      const editor = await resolveEditorUser(
        toIdentityRequest(request.headers),
        identityProvider,
        contentProvider,
      );
      if (editor.kind !== "authenticated") return sendEditorResolutionError(editor, reply);
      if (!editor.capabilities.canCreate && !editor.capabilities.canEditAll) {
        return reply.status(403).header("Cache-Control", "no-store").send({ error: "forbidden" });
      }

      const params = ContentIdParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }
      const draft = ContentDraftSchema.safeParse(request.body);
      if (!draft.success) {
        return reply
          .status(400)
          .header("Cache-Control", "no-store")
          .send({ error: "invalid_content" });
      }
      if (draft.data.kind === "topic" && !editor.capabilities.canManageTaxonomy) {
        return reply.status(403).header("Cache-Control", "no-store").send({ error: "forbidden" });
      }

      try {
        const result = await contentProvider!.updateContent({
          actorUserId: editor.user.id,
          contentId: params.data.contentId,
          draft: draft.data,
          roles: editor.roles,
        });
        if (result.status !== "success") return sendContentMutationError(result.status, reply);
        return reply
          .header("Cache-Control", "no-store")
          .send(ContentItemSchema.parse(result.value));
      } catch {
        request.log.error("Content update failed");
        return reply
          .status(503)
          .header("Cache-Control", "no-store")
          .send({ error: "content_unavailable" });
      }
    },
  );

  app.delete<{ Params: { contentId: string } }>(
    "/v1/editor/content/:contentId",
    async (request, reply) => {
      const editor = await resolveEditorUser(
        toIdentityRequest(request.headers),
        identityProvider,
        contentProvider,
      );
      if (editor.kind !== "authenticated") return sendEditorResolutionError(editor, reply);
      if (!editor.capabilities.canDeleteContent) {
        return reply.status(403).header("Cache-Control", "no-store").send({ error: "forbidden" });
      }

      const params = ContentIdParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }

      try {
        const result = await contentProvider!.deleteContent({
          actorUserId: editor.user.id,
          contentId: params.data.contentId,
          roles: editor.roles,
        });
        if (result.status !== "success") return sendContentMutationError(result.status, reply);
        return reply
          .header("Cache-Control", "no-store")
          .send(DeletedContentSchema.parse(result.value));
      } catch {
        request.log.error("Content deletion failed");
        return reply
          .status(503)
          .header("Cache-Control", "no-store")
          .send({ error: "content_unavailable" });
      }
    },
  );

  app.post<{ Body: unknown; Params: { contentId: string } }>(
    "/v1/editor/content/:contentId/transition",
    async (request, reply) => {
      const editor = await resolveEditorUser(
        toIdentityRequest(request.headers),
        identityProvider,
        contentProvider,
      );
      if (editor.kind !== "authenticated") return sendEditorResolutionError(editor, reply);
      if (!editor.capabilities.canCreate && !editor.capabilities.canEditAll) {
        return reply.status(403).header("Cache-Control", "no-store").send({ error: "forbidden" });
      }

      const params = ContentIdParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }
      const transition = ContentTransitionRequestSchema.safeParse(request.body);
      if (!transition.success) {
        return reply
          .status(400)
          .header("Cache-Control", "no-store")
          .send({ error: "invalid_content_transition" });
      }

      try {
        const result = await contentProvider!.transitionContent({
          actorUserId: editor.user.id,
          contentId: params.data.contentId,
          roles: editor.roles,
          status: transition.data.status,
        });
        if (result.status !== "success") return sendContentMutationError(result.status, reply);
        return reply
          .header("Cache-Control", "no-store")
          .send(ContentItemSchema.parse(result.value));
      } catch {
        request.log.error("Content transition failed");
        return reply
          .status(503)
          .header("Cache-Control", "no-store")
          .send({ error: "content_unavailable" });
      }
    },
  );

  app.post<{ Body: unknown; Params: { contentId: string } }>(
    "/v1/editor/content/:contentId/assets",
    async (request, reply) => {
      const editor = await resolveEditorUser(
        toIdentityRequest(request.headers),
        identityProvider,
        contentProvider,
      );
      if (editor.kind !== "authenticated") return sendEditorResolutionError(editor, reply);
      if (!editor.capabilities.canUpload) {
        return reply.status(403).header("Cache-Control", "no-store").send({ error: "forbidden" });
      }

      const params = ContentIdParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }
      const file = ContentAssetUploadRequestSchema.safeParse(request.body);
      if (!file.success) {
        return reply
          .status(400)
          .header("Cache-Control", "no-store")
          .send({ error: "invalid_content_asset" });
      }

      try {
        const result = await contentProvider!.createAssetUpload({
          actorUserId: editor.user.id,
          contentId: params.data.contentId,
          file: file.data,
          roles: editor.roles,
        });
        if (result.status !== "success") return sendContentMutationError(result.status, reply);
        return reply
          .status(201)
          .header("Cache-Control", "no-store")
          .send(ContentAssetUploadResponseSchema.parse(result.value));
      } catch {
        request.log.error("Content-asset upload provisioning failed");
        return reply
          .status(503)
          .header("Cache-Control", "no-store")
          .send({ error: "content_unavailable" });
      }
    },
  );

  app.post<{ Params: { assetId: string } }>(
    "/v1/editor/assets/:assetId/finalize",
    async (request, reply) => {
      const editor = await resolveEditorUser(
        toIdentityRequest(request.headers),
        identityProvider,
        contentProvider,
      );
      if (editor.kind !== "authenticated") return sendEditorResolutionError(editor, reply);
      if (!editor.capabilities.canUpload) {
        return reply.status(403).header("Cache-Control", "no-store").send({ error: "forbidden" });
      }

      const params = ContentAssetIdParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }

      try {
        const result = await contentProvider!.finalizeAsset({
          actorUserId: editor.user.id,
          assetId: params.data.assetId,
          roles: editor.roles,
        });
        if (result.status !== "success") return sendContentMutationError(result.status, reply);
        return reply
          .header("Cache-Control", "no-store")
          .send(ContentAssetSchema.parse(result.value));
      } catch {
        request.log.error("Content-asset finalization failed");
        return reply
          .status(503)
          .header("Cache-Control", "no-store")
          .send({ error: "content_unavailable" });
      }
    },
  );

  app.delete<{ Params: { assetId: string } }>(
    "/v1/editor/assets/:assetId",
    async (request, reply) => {
      const editor = await resolveEditorUser(
        toIdentityRequest(request.headers),
        identityProvider,
        contentProvider,
      );
      if (editor.kind !== "authenticated") return sendEditorResolutionError(editor, reply);
      if (!editor.capabilities.canUpload) {
        return reply.status(403).header("Cache-Control", "no-store").send({ error: "forbidden" });
      }

      const params = ContentAssetIdParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }

      try {
        const result = await contentProvider!.deleteAsset({
          actorUserId: editor.user.id,
          assetId: params.data.assetId,
          roles: editor.roles,
        });
        if (result.status !== "success") return sendContentMutationError(result.status, reply);
        return reply
          .header("Cache-Control", "no-store")
          .send(ContentItemSchema.parse(result.value));
      } catch {
        request.log.error("Content-asset deletion failed");
        return reply
          .status(503)
          .header("Cache-Control", "no-store")
          .send({ error: "content_unavailable" });
      }
    },
  );

  app.get<{ Querystring: unknown }>("/v1/admin/roles", async (request, reply) => {
    const administrator = await resolveAdministratorUser(
      toIdentityRequest(request.headers),
      identityProvider,
      roleManagementProvider,
    );
    if (administrator.kind !== "authenticated") {
      return sendAdministratorResolutionError(administrator, reply);
    }

    const query = AdminRoleLookupQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply
        .status(400)
        .header("Cache-Control", "no-store")
        .send({ error: "invalid_role_lookup" });
    }

    try {
      const user = await roleManagementProvider!.lookupUserByEmail(query.data.email);
      if (!user) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "user_not_found" });
      }
      return reply
        .header("Cache-Control", "no-store")
        .send(AdminRoleResponseSchema.parse({ user }));
    } catch {
      request.log.error("Administrator role lookup failed");
      return reply
        .status(503)
        .header("Cache-Control", "no-store")
        .send({ error: "role_management_unavailable" });
    }
  });

  app.post<{ Body: unknown }>("/v1/admin/roles", async (request, reply) => {
    const administrator = await resolveAdministratorUser(
      toIdentityRequest(request.headers),
      identityProvider,
      roleManagementProvider,
    );
    if (administrator.kind !== "authenticated") {
      return sendAdministratorResolutionError(administrator, reply);
    }

    const input = AdminRoleMutationRequestSchema.safeParse(request.body);
    if (!input.success) {
      return reply
        .status(400)
        .header("Cache-Control", "no-store")
        .send({ error: "invalid_role_assignment" });
    }

    try {
      const result = await roleManagementProvider!.mutateRole({
        ...input.data,
        actorUserId: administrator.user.id,
      });
      if (result.status !== "success") return sendRoleManagementError(result.status, reply);
      return reply
        .header("Cache-Control", "no-store")
        .send(AdminRoleResponseSchema.parse({ user: result.value }));
    } catch {
      request.log.error("Administrator role mutation failed");
      return reply
        .status(503)
        .header("Cache-Control", "no-store")
        .send({ error: "role_management_unavailable" });
    }
  });

  app.post<{ Body: unknown }>("/v1/videos/test-uploads", async (request, reply) => {
    const testVideoUpload = environment.testVideoUpload;
    if (!testVideoUpload || !videoProvider) {
      return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
    }

    const resolution = await resolveRequestUser(toIdentityRequest(request.headers), identityProvider);
    if (resolution.kind !== "authenticated") return sendUserResolutionError(resolution, reply);
    if (!testVideoUpload.uploaderIds.has(resolution.user.id.toLowerCase())) {
      return reply.status(403).header("Cache-Control", "no-store").send({ error: "forbidden" });
    }

    const input = TestVideoUploadRequestSchema.safeParse(request.body);
    if (!input.success) {
      return reply
        .status(400)
        .header("Cache-Control", "no-store")
        .send({ error: "invalid_video_test_upload" });
    }
    if (input.data.fileSizeBytes > testVideoUpload.maxFileSizeBytes) {
      return reply
        .status(413)
        .header("Cache-Control", "no-store")
        .send({ error: "video_test_file_too_large" });
    }
    if (input.data.durationSeconds > testVideoUpload.maxDurationSeconds) {
      return reply
        .status(422)
        .header("Cache-Control", "no-store")
        .send({ error: "video_test_duration_too_long" });
    }

    try {
      const upload = await videoProvider.createDirectUpload({
        creatorId: resolution.user.id,
        durationSeconds: input.data.durationSeconds,
        expiresAt: new Date(Date.now() + directUploadLifetimeMilliseconds).toISOString(),
        fileSizeBytes: input.data.fileSizeBytes,
        maxDurationSeconds: testVideoUpload.maxDurationSeconds,
        mimeType: input.data.mimeType,
      });
      const response = TestVideoUploadResponseSchema.parse({
        constraints: {
          maxDurationSeconds: testVideoUpload.maxDurationSeconds,
          maxFileSizeBytes: testVideoUpload.maxFileSizeBytes,
        },
        upload,
      });
      return reply.header("Cache-Control", "no-store").send(response);
    } catch {
      request.log.error("Test-video direct-upload provisioning failed");
      return reply
        .status(503)
        .header("Cache-Control", "no-store")
        .send({ error: "video_test_unavailable" });
    }
  });

  app.get<{ Params: { videoId: string } }>("/v1/videos/test-assets/:videoId", async (request, reply) => {
    const testVideoUpload = environment.testVideoUpload;
    if (!testVideoUpload || !videoProvider || !VideoIdPattern.test(request.params.videoId)) {
      return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
    }

    const resolution = await resolveRequestUser(toIdentityRequest(request.headers), identityProvider);
    if (resolution.kind !== "authenticated") return sendUserResolutionError(resolution, reply);
    if (!testVideoUpload.uploaderIds.has(resolution.user.id.toLowerCase())) {
      return reply.status(403).header("Cache-Control", "no-store").send({ error: "forbidden" });
    }

    try {
      const asset = await videoProvider.getVideoAsset(request.params.videoId, resolution.user.id);
      if (!asset || asset.creatorId !== resolution.user.id) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }

      if (asset.status === "ready") {
        const playback = await videoProvider.createPlaybackSession(
          request.params.videoId,
          playbackLifetimeSeconds,
          resolution.user.id,
        );
        const response = TestVideoAssetResponseSchema.parse({
          expiresAt: playback.expiresAt,
          iframeUrl: playback.iframeUrl,
          playbackUrl: playback.playbackUrl,
          status: asset.status,
          videoId: request.params.videoId,
        });
        return reply.header("Cache-Control", "no-store").send(response);
      }

      const response = TestVideoAssetResponseSchema.parse({
        status: asset.status,
        videoId: request.params.videoId,
      });
      return reply.header("Cache-Control", "no-store").send(response);
    } catch {
      request.log.error("Test-video status or playback request failed");
      return reply
        .status(503)
        .header("Cache-Control", "no-store")
        .send({ error: "video_test_unavailable" });
    }
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({ error: "not_found" });
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error }, "Request failed");
    return reply.status(error.statusCode ?? 500).send({
      error: error.statusCode && error.statusCode < 500 ? error.name : "internal_error",
    });
  });

  return app;
}
