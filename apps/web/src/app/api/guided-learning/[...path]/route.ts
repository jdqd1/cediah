import {
  LearningAttemptMutationResponseSchema,
  LearningAttemptMediaResponseSchema,
  LearningAttemptSchema,
  LearningEnrollmentProgressSchema,
  LearningEnrollmentResponseSchema,
  LearningEnrollmentUpgradePreviewResponseSchema,
  LearningEnrollmentUpgradeResponseSchema,
  LearningHomeSchema,
  LearningLibraryOptionsResponseSchema,
  LearningPathCatalogResponseSchema,
  LearningPathDetailSchema,
  LearningPreferencesSchema,
  LearningTaskOverrideResponseSchema,
} from "@cediah/contracts";
import { forwardGuidedLearningRequest } from "@/lib/server/guided-learning-route";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };
const Uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const Slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function segments(context: RouteContext) {
  return (await context.params).path;
}

export async function GET(request: Request, context: RouteContext) {
  const path = await segments(context);
  const query = new URL(request.url).search;
  if (path.length === 1 && path[0] === "home") {
    return forwardGuidedLearningRequest({
      apiPath: `/v1/guided-learning/home${query}`,
      method: "GET",
      request,
      responseSchema: LearningHomeSchema,
    });
  }
  if (path.length === 1 && path[0] === "preferences") {
    return forwardGuidedLearningRequest({
      apiPath: "/v1/guided-learning/preferences",
      method: "GET",
      request,
      responseSchema: LearningPreferencesSchema,
    });
  }
  if (path.length === 1 && path[0] === "paths") {
    return forwardGuidedLearningRequest({
      apiPath: `/v1/guided-learning/paths${query}`,
      method: "GET",
      request,
      responseSchema: LearningPathCatalogResponseSchema,
    });
  }
  if (path.length === 2 && path[0] === "library" && path[1] === "options") {
    return forwardGuidedLearningRequest({
      apiPath: `/v1/guided-learning/library/options${query}`,
      method: "GET",
      request,
      responseSchema: LearningLibraryOptionsResponseSchema,
    });
  }
  if (path.length === 2 && path[0] === "paths" && Slug.test(path[1] ?? "")) {
    return forwardGuidedLearningRequest({
      apiPath: `/v1/guided-learning/paths/${encodeURIComponent(path[1]!)}`,
      method: "GET",
      request,
      responseSchema: LearningPathDetailSchema,
    });
  }
  if (path.length === 3 && path[0] === "enrollments" && Uuid.test(path[1] ?? "") && path[2] === "progress") {
    return forwardGuidedLearningRequest({
      apiPath: `/v1/guided-learning/enrollments/${path[1]}/progress`,
      method: "GET",
      request,
      responseSchema: LearningEnrollmentProgressSchema,
    });
  }
  if (path.length === 3 && path[0] === "enrollments" && Uuid.test(path[1] ?? "") && path[2] === "upgrade-preview") {
    return forwardGuidedLearningRequest({
      apiPath: `/v1/guided-learning/enrollments/${path[1]}/upgrade-preview`,
      method: "GET",
      request,
      responseSchema: LearningEnrollmentUpgradePreviewResponseSchema,
    });
  }
  if (path.length === 2 && path[0] === "attempts" && Uuid.test(path[1] ?? "")) {
    return forwardGuidedLearningRequest({
      apiPath: `/v1/guided-learning/attempts/${path[1]}`,
      method: "GET",
      request,
      responseSchema: LearningAttemptSchema,
    });
  }
  if (path.length === 3 && path[0] === "attempts" && Uuid.test(path[1] ?? "") && path[2] === "media") {
    return forwardGuidedLearningRequest({
      apiPath: `/v1/guided-learning/attempts/${path[1]}/media`,
      method: "GET",
      request,
      responseSchema: LearningAttemptMediaResponseSchema,
    });
  }
  return Response.json({ error: "not_found" }, { status: 404 });
}

export async function POST(request: Request, context: RouteContext) {
  const path = await segments(context);
  if (path.length === 1 && path[0] === "review-sessions") {
    return forwardGuidedLearningRequest({
      apiPath: "/v1/guided-learning/review-sessions",
      method: "POST",
      request,
      responseSchema: LearningAttemptMutationResponseSchema,
    });
  }
  if (path.length === 1 && path[0] === "enrollments") {
    return forwardGuidedLearningRequest({
      apiPath: "/v1/guided-learning/enrollments",
      method: "POST",
      request,
      responseSchema: LearningEnrollmentResponseSchema,
    });
  }
  if (path.length === 3 && path[0] === "enrollments" && Uuid.test(path[1] ?? "") && path[2] === "upgrade") {
    return forwardGuidedLearningRequest({
      apiPath: `/v1/guided-learning/enrollments/${path[1]}/upgrade`,
      method: "POST",
      request,
      responseSchema: LearningEnrollmentUpgradeResponseSchema,
    });
  }
  if (path.length === 1 && path[0] === "attempts") {
    return forwardGuidedLearningRequest({
      apiPath: "/v1/guided-learning/attempts",
      method: "POST",
      request,
      responseSchema: LearningAttemptMutationResponseSchema,
    });
  }
  if (path.length === 3 && path[0] === "attempts" && Uuid.test(path[1] ?? "") && path[2] === "responses") {
    return forwardGuidedLearningRequest({
      apiPath: `/v1/guided-learning/attempts/${path[1]}/responses`,
      method: "POST",
      request,
      responseSchema: LearningAttemptMutationResponseSchema,
    });
  }
  if (path.length === 3 && path[0] === "attempts" && Uuid.test(path[1] ?? "") && path[2] === "complete") {
    return forwardGuidedLearningRequest({
      apiPath: `/v1/guided-learning/attempts/${path[1]}/complete`,
      method: "POST",
      request,
      responseSchema: LearningAttemptMutationResponseSchema,
    });
  }
  if (path.length === 5 && path[0] === "attempts" && Uuid.test(path[1] ?? "") && path[2] === "items" && Uuid.test(path[3] ?? "") && path[4] === "reveal") {
    return forwardGuidedLearningRequest({
      apiPath: `/v1/guided-learning/attempts/${path[1]}/items/${path[3]}/reveal`,
      method: "POST",
      request,
      responseSchema: LearningAttemptMutationResponseSchema,
    });
  }
  return Response.json({ error: "not_found" }, { status: 404 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const path = await segments(context);
  if (path.length === 1 && path[0] === "preferences") {
    return forwardGuidedLearningRequest({
      apiPath: "/v1/guided-learning/preferences",
      method: "PATCH",
      request,
      responseSchema: LearningPreferencesSchema,
    });
  }
  if (path.length === 2 && path[0] === "tasks" && path[1] === "override") {
    return forwardGuidedLearningRequest({
      apiPath: "/v1/guided-learning/tasks/override",
      method: "PATCH",
      request,
      responseSchema: LearningTaskOverrideResponseSchema,
    });
  }
  if (path.length === 3 && path[0] === "steps" && Uuid.test(path[1] ?? "") && path[2] === "preference") {
    return forwardGuidedLearningRequest({
      apiPath: `/v1/guided-learning/steps/${path[1]}/preference`,
      method: "PATCH",
      request,
      responseSchema: LearningEnrollmentProgressSchema,
    });
  }
  if (path.length === 2 && path[0] === "enrollments" && Uuid.test(path[1] ?? "")) {
    return forwardGuidedLearningRequest({
      apiPath: `/v1/guided-learning/enrollments/${path[1]}`,
      method: "PATCH",
      request,
      responseSchema: LearningEnrollmentResponseSchema,
    });
  }
  if (path.length === 3 && path[0] === "attempts" && Uuid.test(path[1] ?? "") && path[2] === "resume") {
    return forwardGuidedLearningRequest({
      apiPath: `/v1/guided-learning/attempts/${path[1]}/resume`,
      method: "PATCH",
      request,
      responseSchema: LearningAttemptMutationResponseSchema,
    });
  }
  return Response.json({ error: "not_found" }, { status: 404 });
}
