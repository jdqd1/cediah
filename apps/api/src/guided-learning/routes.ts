import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  LearningAttemptCompleteRequestSchema,
  LearningAttemptCreateRequestSchema,
  LearningAttemptMediaResponseSchema,
  LearningAttemptMutationResponseSchema,
  LearningAttemptResponseRequestSchema,
  LearningAttemptResumeRequestSchema,
  LearningAttemptRevealRequestSchema,
  LearningAttemptSchema,
  LearningEnrollmentCreateRequestSchema,
  LearningEnrollmentProgressSchema,
  LearningEnrollmentResponseSchema,
  LearningEnrollmentUpgradePreviewResponseSchema,
  LearningEnrollmentUpgradeRequestSchema,
  LearningEnrollmentUpgradeResponseSchema,
  LearningEnrollmentUpdateRequestSchema,
  LearningIdempotencyKeySchema,
  LearningHomeQuerySchema,
  LearningHomeSchema,
  LearningLibraryOptionsQuerySchema,
  LearningLibraryOptionsResponseSchema,
  LearningPathCatalogQuerySchema,
  LearningPathCatalogResponseSchema,
  LearningPathDetailSchema,
  LearningPreferencesSchema,
  LearningPreferencesUpdateRequestSchema,
  LearningReviewSessionCreateRequestSchema,
  LearningStepPreferenceRequestSchema,
  LearningTaskOverrideRequestSchema,
  LearningTaskOverrideResponseSchema,
  type GuidedLearningFailure,
  type GuidedLearningProvider,
  type IdentityProvider,
} from "@cediah/contracts";
import { resolveGuidedUser, sendGuidedUserError } from "./http.js";

const SlugParamsSchema = z.strictObject({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});
const EnrollmentParamsSchema = z.strictObject({ enrollmentId: z.string().uuid() });
const AttemptParamsSchema = z.strictObject({ attemptId: z.string().uuid() });
const StepParamsSchema = z.strictObject({ stepId: z.string().uuid() });
const AttemptItemParamsSchema = z.strictObject({
  attemptId: z.string().uuid(),
  itemId: z.string().uuid(),
});

function idempotencyKey(value: string | string[] | undefined) {
  return LearningIdempotencyKeySchema.safeParse(Array.isArray(value) ? value[0] : value);
}

function sendFailure(error: GuidedLearningFailure | "not_ready", reply: FastifyReply) {
  if (error === "not_found") return reply.status(404).send({ error: "not_found" });
  if (error === "forbidden") return reply.status(403).send({ error: "forbidden" });
  if (error === "version_conflict") return reply.status(409).send({ error: "version_conflict" });
  if (error === "resource_changed") return reply.status(409).send({ error: "resource_changed" });
  if (error === "idempotency_conflict") return reply.status(409).send({ error: "idempotency_conflict" });
  if (error === "invalid_state") return reply.status(409).send({ error: "invalid_state" });
  if (error === "active_attempt") return reply.status(409).send({ error: "active_attempt" });
  return reply.status(error === "not_ready" ? 422 : 409)
    .send({ error: error === "not_ready" ? "route_not_ready" : "conflict" });
}

export async function registerGuidedLearningRoutes(
  app: FastifyInstance,
  dependencies: {
    identityProvider?: IdentityProvider;
    provider?: GuidedLearningProvider;
  },
) {
  app.get<{ Querystring: unknown }>("/v1/guided-learning/home", async (request, reply) => {
    const user = await resolveGuidedUser(request, dependencies.identityProvider);
    if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
    if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
    const query = LearningHomeQuerySchema.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ error: "invalid_request" });
    try {
      const home = await dependencies.provider.getHome({ ...query.data, userId: user.user.id });
      return reply.header("Cache-Control", "private, no-store").send(LearningHomeSchema.parse(home));
    } catch {
      request.log.error("Guided-learning home failed");
      return reply.status(503).send({ error: "learning_unavailable" });
    }
  });

  app.get("/v1/guided-learning/preferences", async (request, reply) => {
    const user = await resolveGuidedUser(request, dependencies.identityProvider);
    if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
    if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
    try {
      const preferences = await dependencies.provider.getPreferences({ userId: user.user.id });
      return reply.header("Cache-Control", "private, no-store")
        .send(LearningPreferencesSchema.parse(preferences));
    } catch {
      request.log.error("Guided-learning preferences failed");
      return reply.status(503).send({ error: "learning_unavailable" });
    }
  });

  app.patch<{ Body: unknown }>("/v1/guided-learning/preferences", async (request, reply) => {
    const user = await resolveGuidedUser(request, dependencies.identityProvider);
    if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
    if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
    const body = LearningPreferencesUpdateRequestSchema.safeParse(request.body);
    const key = idempotencyKey(request.headers["idempotency-key"]);
    if (!body.success || !key.success) return reply.status(400).send({ error: "invalid_request" });
    try {
      const result = await dependencies.provider.updatePreferences({
        idempotencyKey: key.data,
        request: body.data,
        userId: user.user.id,
      });
      if (result.status !== "success") return sendFailure(result.status, reply);
      return reply.header("Cache-Control", "private, no-store")
        .send(LearningPreferencesSchema.parse(result.value));
    } catch {
      request.log.error("Guided-learning preference update failed");
      return reply.status(503).send({ error: "learning_unavailable" });
    }
  });

  app.post<{ Body: unknown }>("/v1/guided-learning/review-sessions", async (request, reply) => {
    const user = await resolveGuidedUser(request, dependencies.identityProvider);
    if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
    if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
    const body = LearningReviewSessionCreateRequestSchema.safeParse(request.body);
    const key = idempotencyKey(request.headers["idempotency-key"]);
    if (!body.success || !key.success) return reply.status(400).send({ error: "invalid_request" });
    try {
      const result = await dependencies.provider.createReviewSession({
        idempotencyKey: key.data,
        request: body.data,
        userId: user.user.id,
      });
      if (result.status !== "success") return sendFailure(result.status, reply);
      return reply.status(201).header("Cache-Control", "private, no-store")
        .send(LearningAttemptMutationResponseSchema.parse(result.value));
    } catch {
      request.log.error("Guided-learning review session creation failed");
      return reply.status(503).send({ error: "learning_unavailable" });
    }
  });

  app.patch<{ Body: unknown }>("/v1/guided-learning/tasks/override", async (request, reply) => {
    const user = await resolveGuidedUser(request, dependencies.identityProvider);
    if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
    if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
    const body = LearningTaskOverrideRequestSchema.safeParse(request.body);
    const key = idempotencyKey(request.headers["idempotency-key"]);
    if (!body.success || !key.success) return reply.status(400).send({ error: "invalid_request" });
    try {
      const result = await dependencies.provider.updateTaskOverride({
        idempotencyKey: key.data,
        request: body.data,
        userId: user.user.id,
      });
      if (result.status !== "success") return sendFailure(result.status, reply);
      return reply.header("Cache-Control", "private, no-store")
        .send(LearningTaskOverrideResponseSchema.parse(result.value));
    } catch {
      request.log.error("Guided-learning task override failed");
      return reply.status(503).send({ error: "learning_unavailable" });
    }
  });

  app.patch<{ Body: unknown; Params: { stepId: string } }>(
    "/v1/guided-learning/steps/:stepId/preference",
    async (request, reply) => {
      const user = await resolveGuidedUser(request, dependencies.identityProvider);
      if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
      if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
      const params = StepParamsSchema.safeParse(request.params);
      const body = LearningStepPreferenceRequestSchema.safeParse(request.body);
      const key = idempotencyKey(request.headers["idempotency-key"]);
      if (!params.success) return reply.status(404).send({ error: "not_found" });
      if (!body.success || !key.success) return reply.status(400).send({ error: "invalid_request" });
      try {
        const result = await dependencies.provider.updateStepPreference({
          idempotencyKey: key.data,
          request: body.data,
          stepId: params.data.stepId,
          userId: user.user.id,
        });
        if (result.status !== "success") return sendFailure(result.status, reply);
        return reply.header("Cache-Control", "private, no-store")
          .send(LearningEnrollmentProgressSchema.parse(result.value));
      } catch {
        request.log.error("Guided-learning step preference failed");
        return reply.status(503).send({ error: "learning_unavailable" });
      }
    },
  );

  app.get<{ Querystring: unknown }>("/v1/guided-learning/paths", async (request, reply) => {
    const user = await resolveGuidedUser(request, dependencies.identityProvider);
    if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
    if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
    const query = LearningPathCatalogQuerySchema.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ error: "invalid_request" });
    try {
      const result = await dependencies.provider.listPublishedPaths({
        ...query.data,
        userId: user.user.id,
      });
      return reply.header("Cache-Control", "private, no-store")
        .send(LearningPathCatalogResponseSchema.parse(result));
    } catch {
      request.log.error("Guided-learning catalog failed");
      return reply.status(503).send({ error: "learning_unavailable" });
    }
  });

  app.get<{ Querystring: unknown }>("/v1/guided-learning/library/options", async (request, reply) => {
    const user = await resolveGuidedUser(request, dependencies.identityProvider);
    if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
    if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
    const query = LearningLibraryOptionsQuerySchema.safeParse(request.query);
    if (!query.success) return reply.status(400).send({ error: "invalid_request" });
    try {
      const items = await dependencies.provider.listLibraryOptions({ ...query.data, userId: user.user.id });
      return reply.header("Cache-Control", "private, no-store")
        .send(LearningLibraryOptionsResponseSchema.parse({ items }));
    } catch {
      request.log.error("Guided-learning library options failed");
      return reply.status(503).send({ error: "learning_unavailable" });
    }
  });

  app.get<{ Params: { slug: string } }>("/v1/guided-learning/paths/:slug", async (request, reply) => {
    const user = await resolveGuidedUser(request, dependencies.identityProvider);
    if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
    if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
    const params = SlugParamsSchema.safeParse(request.params);
    if (!params.success) return reply.status(404).send({ error: "not_found" });
    try {
      const path = await dependencies.provider.getPathBySlug({
        slug: params.data.slug,
        userId: user.user.id,
      });
      if (!path) return reply.status(404).send({ error: "not_found" });
      return reply.header("Cache-Control", "private, no-store")
        .send(LearningPathDetailSchema.parse(path));
    } catch {
      request.log.error("Guided-learning path detail failed");
      return reply.status(503).send({ error: "learning_unavailable" });
    }
  });

  app.post<{ Body: unknown }>("/v1/guided-learning/enrollments", async (request, reply) => {
    const user = await resolveGuidedUser(request, dependencies.identityProvider);
    if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
    if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
    const body = LearningEnrollmentCreateRequestSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: "invalid_request" });
    try {
      const result = await dependencies.provider.createEnrollment({
        pathId: body.data.pathId,
        userId: user.user.id,
      });
      if (result.status !== "success") return sendFailure(result.status, reply);
      return reply.status(201).header("Cache-Control", "private, no-store")
        .send(LearningEnrollmentResponseSchema.parse(result.value));
    } catch {
      request.log.error("Guided-learning enrollment failed");
      return reply.status(503).send({ error: "learning_unavailable" });
    }
  });

  app.patch<{ Body: unknown; Params: { enrollmentId: string } }>(
    "/v1/guided-learning/enrollments/:enrollmentId",
    async (request, reply) => {
      const user = await resolveGuidedUser(request, dependencies.identityProvider);
      if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
      if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
      const params = EnrollmentParamsSchema.safeParse(request.params);
      const body = LearningEnrollmentUpdateRequestSchema.safeParse(request.body);
      if (!params.success) return reply.status(404).send({ error: "not_found" });
      if (!body.success) return reply.status(400).send({ error: "invalid_request" });
      try {
        const result = await dependencies.provider.updateEnrollment({
          enrollmentId: params.data.enrollmentId,
          expectedVersion: body.data.expectedVersion,
          status: body.data.status,
          userId: user.user.id,
        });
        if (result.status !== "success") return sendFailure(result.status, reply);
        return reply.header("Cache-Control", "private, no-store")
          .send(LearningEnrollmentResponseSchema.parse(result.value));
      } catch {
        request.log.error("Guided-learning enrollment update failed");
        return reply.status(503).send({ error: "learning_unavailable" });
      }
    },
  );

  app.get<{ Params: { enrollmentId: string } }>(
    "/v1/guided-learning/enrollments/:enrollmentId/progress",
    async (request, reply) => {
      const user = await resolveGuidedUser(request, dependencies.identityProvider);
      if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
      if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
      const params = EnrollmentParamsSchema.safeParse(request.params);
      if (!params.success) return reply.status(404).send({ error: "not_found" });
      try {
        const result = await dependencies.provider.getEnrollmentProgress({
          enrollmentId: params.data.enrollmentId,
          userId: user.user.id,
        });
        if (result.status !== "success") return sendFailure(result.status, reply);
        return reply.header("Cache-Control", "private, no-store")
          .send(LearningEnrollmentProgressSchema.parse(result.value));
      } catch {
        request.log.error("Guided-learning progress failed");
        return reply.status(503).send({ error: "learning_unavailable" });
      }
    },
  );

  app.get<{ Params: { enrollmentId: string } }>(
    "/v1/guided-learning/enrollments/:enrollmentId/upgrade-preview",
    async (request, reply) => {
      const user = await resolveGuidedUser(request, dependencies.identityProvider);
      if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
      if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
      const params = EnrollmentParamsSchema.safeParse(request.params);
      if (!params.success) return reply.status(404).send({ error: "not_found" });
      try {
        const result = await dependencies.provider.getEnrollmentUpgradePreview({
          enrollmentId: params.data.enrollmentId,
          userId: user.user.id,
        });
        if (result.status !== "success") return sendFailure(result.status, reply);
        return reply.header("Cache-Control", "private, no-store")
          .send(LearningEnrollmentUpgradePreviewResponseSchema.parse(result.value));
      } catch {
        request.log.error("Guided-learning upgrade preview failed");
        return reply.status(503).send({ error: "learning_unavailable" });
      }
    },
  );

  app.post<{ Body: unknown; Params: { enrollmentId: string } }>(
    "/v1/guided-learning/enrollments/:enrollmentId/upgrade",
    async (request, reply) => {
      const user = await resolveGuidedUser(request, dependencies.identityProvider);
      if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
      if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
      const params = EnrollmentParamsSchema.safeParse(request.params);
      const body = LearningEnrollmentUpgradeRequestSchema.safeParse(request.body);
      const key = idempotencyKey(request.headers["idempotency-key"]);
      if (!params.success) return reply.status(404).send({ error: "not_found" });
      if (!body.success || !key.success) return reply.status(400).send({ error: "invalid_request" });
      try {
        const result = await dependencies.provider.upgradeEnrollment({
          enrollmentId: params.data.enrollmentId,
          idempotencyKey: key.data,
          request: body.data,
          userId: user.user.id,
        });
        if (result.status !== "success") return sendFailure(result.status, reply);
        return reply.header("Cache-Control", "private, no-store")
          .send(LearningEnrollmentUpgradeResponseSchema.parse(result.value));
      } catch {
        request.log.error("Guided-learning enrollment upgrade failed");
        return reply.status(503).send({ error: "learning_unavailable" });
      }
    },
  );

  app.post<{ Body: unknown }>("/v1/guided-learning/attempts", async (request, reply) => {
    const user = await resolveGuidedUser(request, dependencies.identityProvider);
    if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
    if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
    const body = LearningAttemptCreateRequestSchema.safeParse(request.body);
    const key = idempotencyKey(request.headers["idempotency-key"]);
    if (!body.success || !key.success) return reply.status(400).send({ error: "invalid_request" });
    try {
      const result = await dependencies.provider.createAttempt({
        idempotencyKey: key.data,
        request: body.data,
        userId: user.user.id,
      });
      if (result.status !== "success") return sendFailure(result.status, reply);
      return reply.status(201).header("Cache-Control", "private, no-store")
        .send(LearningAttemptMutationResponseSchema.parse(result.value));
    } catch {
      request.log.error("Guided-learning attempt creation failed");
      return reply.status(503).send({ error: "learning_unavailable" });
    }
  });

  app.get<{ Params: { attemptId: string } }>(
    "/v1/guided-learning/attempts/:attemptId",
    async (request, reply) => {
      const user = await resolveGuidedUser(request, dependencies.identityProvider);
      if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
      if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
      const params = AttemptParamsSchema.safeParse(request.params);
      if (!params.success) return reply.status(404).send({ error: "not_found" });
      try {
        const result = await dependencies.provider.getAttempt({ attemptId: params.data.attemptId, userId: user.user.id });
        if (result.status !== "success") return sendFailure(result.status, reply);
        return reply.header("Cache-Control", "private, no-store")
          .send(LearningAttemptSchema.parse(result.value));
      } catch {
        request.log.error("Guided-learning attempt read failed");
        return reply.status(503).send({ error: "learning_unavailable" });
      }
    },
  );

  app.get<{ Params: { attemptId: string } }>(
    "/v1/guided-learning/attempts/:attemptId/media",
    async (request, reply) => {
      const user = await resolveGuidedUser(request, dependencies.identityProvider);
      if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
      if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
      const params = AttemptParamsSchema.safeParse(request.params);
      if (!params.success) return reply.status(404).send({ error: "not_found" });
      try {
        const result = await dependencies.provider.getAttemptMedia({ attemptId: params.data.attemptId, userId: user.user.id });
        if (result.status !== "success") return sendFailure(result.status, reply);
        return reply.header("Cache-Control", "private, no-store")
          .send(LearningAttemptMediaResponseSchema.parse(result.value));
      } catch {
        request.log.error("Guided-learning attempt media failed");
        return reply.status(503).send({ error: "learning_unavailable" });
      }
    },
  );

  app.patch<{ Body: unknown; Params: { attemptId: string } }>(
    "/v1/guided-learning/attempts/:attemptId/resume",
    async (request, reply) => {
      const user = await resolveGuidedUser(request, dependencies.identityProvider);
      if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
      if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
      const params = AttemptParamsSchema.safeParse(request.params);
      const body = LearningAttemptResumeRequestSchema.safeParse(request.body);
      const key = idempotencyKey(request.headers["idempotency-key"]);
      if (!params.success) return reply.status(404).send({ error: "not_found" });
      if (!body.success || !key.success) return reply.status(400).send({ error: "invalid_request" });
      try {
        const result = await dependencies.provider.updateAttemptResume({
          attemptId: params.data.attemptId,
          idempotencyKey: key.data,
          request: body.data,
          userId: user.user.id,
        });
        if (result.status !== "success") return sendFailure(result.status, reply);
        return reply.header("Cache-Control", "private, no-store")
          .send(LearningAttemptMutationResponseSchema.parse(result.value));
      } catch {
        request.log.error("Guided-learning attempt resume failed");
        return reply.status(503).send({ error: "learning_unavailable" });
      }
    },
  );

  app.post<{ Body: unknown; Params: { attemptId: string; itemId: string } }>(
    "/v1/guided-learning/attempts/:attemptId/items/:itemId/reveal",
    async (request, reply) => {
      const user = await resolveGuidedUser(request, dependencies.identityProvider);
      if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
      if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
      const params = AttemptItemParamsSchema.safeParse(request.params);
      const body = LearningAttemptRevealRequestSchema.safeParse(request.body);
      const key = idempotencyKey(request.headers["idempotency-key"]);
      if (!params.success) return reply.status(404).send({ error: "not_found" });
      if (!body.success || !key.success) return reply.status(400).send({ error: "invalid_request" });
      try {
        const result = await dependencies.provider.revealAttemptItem({
          attemptId: params.data.attemptId,
          expectedVersion: body.data.expectedVersion,
          idempotencyKey: key.data,
          itemId: params.data.itemId,
          userId: user.user.id,
        });
        if (result.status !== "success") return sendFailure(result.status, reply);
        return reply.header("Cache-Control", "private, no-store")
          .send(LearningAttemptMutationResponseSchema.parse(result.value));
      } catch {
        request.log.error("Guided-learning flashcard reveal failed");
        return reply.status(503).send({ error: "learning_unavailable" });
      }
    },
  );

  app.post<{ Body: unknown; Params: { attemptId: string } }>(
    "/v1/guided-learning/attempts/:attemptId/responses",
    async (request, reply) => {
      const user = await resolveGuidedUser(request, dependencies.identityProvider);
      if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
      if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
      const params = AttemptParamsSchema.safeParse(request.params);
      const body = LearningAttemptResponseRequestSchema.safeParse(request.body);
      const key = idempotencyKey(request.headers["idempotency-key"]);
      if (!params.success) return reply.status(404).send({ error: "not_found" });
      if (!body.success || !key.success) return reply.status(400).send({ error: "invalid_request" });
      try {
        const result = await dependencies.provider.recordAttemptResponse({
          attemptId: params.data.attemptId,
          idempotencyKey: key.data,
          request: body.data,
          userId: user.user.id,
        });
        if (result.status !== "success") return sendFailure(result.status, reply);
        return reply.header("Cache-Control", "private, no-store")
          .send(LearningAttemptMutationResponseSchema.parse(result.value));
      } catch {
        request.log.error("Guided-learning response failed");
        return reply.status(503).send({ error: "learning_unavailable" });
      }
    },
  );

  app.post<{ Body: unknown; Params: { attemptId: string } }>(
    "/v1/guided-learning/attempts/:attemptId/complete",
    async (request, reply) => {
      const user = await resolveGuidedUser(request, dependencies.identityProvider);
      if (user.kind !== "authenticated") return sendGuidedUserError(user, reply);
      if (!dependencies.provider) return reply.status(503).send({ error: "learning_unavailable" });
      const params = AttemptParamsSchema.safeParse(request.params);
      const body = LearningAttemptCompleteRequestSchema.safeParse(request.body);
      const key = idempotencyKey(request.headers["idempotency-key"]);
      if (!params.success) return reply.status(404).send({ error: "not_found" });
      if (!body.success || !key.success) return reply.status(400).send({ error: "invalid_request" });
      try {
        const result = await dependencies.provider.completeAttempt({
          attemptId: params.data.attemptId,
          idempotencyKey: key.data,
          request: body.data,
          userId: user.user.id,
        });
        if (result.status !== "success") return sendFailure(result.status, reply);
        return reply.header("Cache-Control", "private, no-store")
          .send(LearningAttemptMutationResponseSchema.parse(result.value));
      } catch {
        request.log.error("Guided-learning attempt completion failed");
        return reply.status(503).send({ error: "learning_unavailable" });
      }
    },
  );
}
