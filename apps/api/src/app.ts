import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply } from "fastify";
import {
  CurrentUserResponseSchema,
  type IdentityProvider,
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
import { createCloudflareStreamVideoProvider } from "./providers/cloudflare-stream.js";
import { createSupabaseIdentityProvider } from "./providers/supabase-identity.js";
import { createSupabaseLearningProvider } from "./providers/supabase-learning.js";
import { createSupabaseStorageVideoProvider } from "./providers/supabase-storage.js";

type AppDependencies = {
  identityProvider?: IdentityProvider;
  learningProvider?: LearningProvider;
  videoProvider?: VideoProvider;
};

type UserResolution =
  | { kind: "authenticated"; user: ProviderUser }
  | { kind: "identity_unavailable" }
  | { kind: "unauthorized" };

const directUploadLifetimeMilliseconds = 15 * 60 * 1_000;
const playbackLifetimeSeconds = 10 * 60;
const VideoIdPattern = /^[A-Za-z0-9_-]{1,64}$/;

function readBearerToken(authorization: string | undefined) {
  if (!authorization) return null;

  const [scheme, token, extra] = authorization.trim().split(/\s+/);
  if (scheme !== "Bearer" || !token || extra) return null;

  return token;
}

async function resolveRequestUser(
  authorization: string | undefined,
  identityProvider: IdentityProvider | undefined,
): Promise<UserResolution> {
  const accessToken = readBearerToken(authorization);
  if (!accessToken) return { kind: "unauthorized" };
  if (!identityProvider) return { kind: "identity_unavailable" };

  try {
    const user = await identityProvider.getUser(accessToken);
    return user ? { kind: "authenticated", user } : { kind: "unauthorized" };
  } catch {
    return { kind: "identity_unavailable" };
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

export async function buildApp(
  environment: ApiEnvironment = readEnvironment(),
  dependencies: AppDependencies = {},
): Promise<FastifyInstance> {
  const identityProvider =
    dependencies.identityProvider ??
    (environment.supabase ? createSupabaseIdentityProvider(environment.supabase) : undefined);
  const learningProvider =
    dependencies.learningProvider ??
    (environment.supabase ? createSupabaseLearningProvider(environment.supabase) : undefined);
  const videoProvider =
    dependencies.videoProvider ??
    (environment.VIDEO_TEST_PROVIDER === "supabase"
      ? environment.supabaseStorage
        ? createSupabaseStorageVideoProvider(environment.supabaseStorage)
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
    credentials: false,
    methods: ["GET", "HEAD", "OPTIONS", "PATCH", "POST"],
    origin(origin, callback) {
      if (!origin || environment.webOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed"), false);
    },
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
    const resolution = await resolveRequestUser(request.headers.authorization, identityProvider);
    if (resolution.kind !== "authenticated") return sendUserResolutionError(resolution, reply);

    const response = CurrentUserResponseSchema.parse({ user: resolution.user });
    return reply.header("Cache-Control", "no-store").send(response);
  });

  app.get("/v1/learning/dashboard", async (request, reply) => {
    const resolution = await resolveRequestUser(request.headers.authorization, identityProvider);
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
      const resolution = await resolveRequestUser(request.headers.authorization, identityProvider);
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

  app.post<{ Body: unknown }>("/v1/videos/test-uploads", async (request, reply) => {
    const testVideoUpload = environment.testVideoUpload;
    if (!testVideoUpload || !videoProvider) {
      return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
    }

    const resolution = await resolveRequestUser(request.headers.authorization, identityProvider);
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

    try {
      const upload = await videoProvider.createDirectUpload({
        creatorId: resolution.user.id,
        expiresAt: new Date(Date.now() + directUploadLifetimeMilliseconds).toISOString(),
        maxDurationSeconds: testVideoUpload.maxDurationSeconds,
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

    const resolution = await resolveRequestUser(request.headers.authorization, identityProvider);
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
