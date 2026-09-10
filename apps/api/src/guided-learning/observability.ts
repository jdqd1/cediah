import type { FastifyInstance, FastifyRequest } from "fastify";

export type GuidedLearningObservation = {
  durationMs: number;
  errorCode: string | null;
  idempotencyKeyPresent: boolean;
  method: string;
  operation: string;
  outcome: "client_error" | "server_error" | "success";
  statusCode: number;
  surface: "editor" | "student";
};

export type GuidedLearningObserver = (
  observation: GuidedLearningObservation,
) => Promise<void> | void;

const operations = new Map<string, Pick<GuidedLearningObservation, "operation" | "surface">>([
  ...["", "/level", "/catalog", "/suggestions"].map((suffix): [string, Pick<GuidedLearningObservation, "operation" | "surface">] => [`GET /v1/guided-learning/map${suffix}`, { operation: `map.${suffix.slice(1) || "summary"}.read`, surface: "student" }]),
  ...["ensure", "nodes", "entries", "group", "complete-block", "remove", "restore"].map((operation): [string, Pick<GuidedLearningObservation, "operation" | "surface">] => [`POST /v1/guided-learning/map/${operation}`, { operation: `map.${operation}`, surface: "student" }]),
  ["PATCH /v1/guided-learning/map/layout", { operation: "map.layout.update", surface: "student" }],
  ["PATCH /v1/guided-learning/map/nodes/:id", { operation: "map.node.update", surface: "student" }],
  ["GET /v1/guided-learning/home", { operation: "home.read", surface: "student" }],
  ["GET /v1/guided-learning/preferences", { operation: "preferences.read", surface: "student" }],
  ["PATCH /v1/guided-learning/preferences", { operation: "preferences.update", surface: "student" }],
  ["POST /v1/guided-learning/review-sessions", { operation: "review_session.create", surface: "student" }],
  ["PATCH /v1/guided-learning/tasks/override", { operation: "task_override.update", surface: "student" }],
  ["PATCH /v1/guided-learning/steps/:stepId/preference", { operation: "step_preference.update", surface: "student" }],
  ["GET /v1/guided-learning/paths", { operation: "path.list", surface: "student" }],
  ["GET /v1/guided-learning/library/options", { operation: "library_options.list", surface: "student" }],
  ["GET /v1/guided-learning/paths/:slug", { operation: "path.read", surface: "student" }],
  ["POST /v1/guided-learning/enrollments", { operation: "enrollment.create", surface: "student" }],
  ["PATCH /v1/guided-learning/enrollments/:enrollmentId", { operation: "enrollment.update", surface: "student" }],
  ["GET /v1/guided-learning/enrollments/:enrollmentId/progress", { operation: "enrollment_progress.read", surface: "student" }],
  ["GET /v1/guided-learning/enrollments/:enrollmentId/upgrade-preview", { operation: "enrollment_upgrade.preview", surface: "student" }],
  ["POST /v1/guided-learning/enrollments/:enrollmentId/upgrade", { operation: "enrollment_upgrade.apply", surface: "student" }],
  ["POST /v1/guided-learning/attempts", { operation: "attempt.create", surface: "student" }],
  ["GET /v1/guided-learning/attempts/:attemptId", { operation: "attempt.read", surface: "student" }],
  ["GET /v1/guided-learning/attempts/:attemptId/media", { operation: "attempt_media.read", surface: "student" }],
  ["PATCH /v1/guided-learning/attempts/:attemptId/resume", { operation: "attempt_resume.update", surface: "student" }],
  ["POST /v1/guided-learning/attempts/:attemptId/items/:itemId/reveal", { operation: "attempt_item.reveal", surface: "student" }],
  ["POST /v1/guided-learning/attempts/:attemptId/responses", { operation: "attempt_response.create", surface: "student" }],
  ["POST /v1/guided-learning/attempts/:attemptId/complete", { operation: "attempt.complete", surface: "student" }],
  ["GET /v1/editor/learning-paths", { operation: "path.list", surface: "editor" }],
  ["GET /v1/editor/learning-resources", { operation: "resource.list", surface: "editor" }],
  ["POST /v1/editor/learning-paths", { operation: "path.create", surface: "editor" }],
  ["GET /v1/editor/learning-paths/:pathId", { operation: "path.read", surface: "editor" }],
  ["PATCH /v1/editor/learning-paths/:pathId", { operation: "path.update", surface: "editor" }],
  ["POST /v1/editor/learning-paths/:pathId/validate", { operation: "path.validate", surface: "editor" }],
  ["POST /v1/editor/learning-paths/:pathId/transition", { operation: "path.transition", surface: "editor" }],
  ["POST /v1/editor/learning-paths/:pathId/versions", { operation: "path_version.create", surface: "editor" }],
  ["GET /v1/editor/learning-paths/:pathId/preview", { operation: "path.preview", surface: "editor" }],
]);

const knownErrorCodes = new Set([
  "map_unavailable",
  "active_attempt",
  "conflict",
  "forbidden",
  "idempotency_conflict",
  "identity_unavailable",
  "invalid_request",
  "invalid_state",
  "learning_unavailable",
  "not_found",
  "rate_limited",
  "resource_changed",
  "route_not_ready",
  "unauthorized",
  "version_conflict",
]);

function routeOperation(request: FastifyRequest) {
  const route = request.routeOptions.url;
  if (!route) return undefined;
  return operations.get(`${request.method.toUpperCase()} ${route}`);
}

function outcome(statusCode: number): GuidedLearningObservation["outcome"] {
  if (statusCode < 400) return "success";
  return statusCode < 500 ? "client_error" : "server_error";
}

export function registerGuidedLearningObservability(
  app: FastifyInstance,
  observer?: GuidedLearningObserver,
) {
  const starts = new WeakMap<FastifyRequest, bigint>();
  const responseErrors = new WeakMap<FastifyRequest, string>();

  app.addHook("onRequest", async (request) => {
    if (routeOperation(request)) starts.set(request, process.hrtime.bigint());
  });

  app.addHook("preSerialization", async (request, reply, payload) => {
    if (routeOperation(request) && reply.statusCode >= 400 && payload && typeof payload === "object") {
      const error = Reflect.get(payload, "error");
      if (typeof error === "string" && knownErrorCodes.has(error)) responseErrors.set(request, error);
    }
    return payload;
  });

  app.addHook("onSend", async (request, reply, payload) => {
    if (routeOperation(request)) reply.header("Cache-Control", "private, no-store");
    return payload;
  });

  app.addHook("onResponse", async (request, reply) => {
    const route = routeOperation(request);
    const startedAt = starts.get(request);
    if (!route || startedAt === undefined) return;

    const observation: GuidedLearningObservation = {
      durationMs: Math.round((Number(process.hrtime.bigint() - startedAt) / 1_000_000) * 100) / 100,
      errorCode: responseErrors.get(request) ?? null,
      idempotencyKeyPresent: request.headers["idempotency-key"] !== undefined,
      method: request.method.toUpperCase(),
      operation: route.operation,
      outcome: outcome(reply.statusCode),
      statusCode: reply.statusCode,
      surface: route.surface,
    };

    try {
      if (observer) {
        await observer(observation);
      } else {
        request.log.info({ guidedLearning: observation }, "Guided-learning operation completed");
      }
    } catch {
      request.log.error("Guided-learning observer failed");
    }
  });
}
