import {
  LearningPathDetailSchema,
  LearningPathValidationResponseSchema,
} from "@cediah/contracts";
import { forwardGuidedLearningRequest } from "@/lib/server/guided-learning-route";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };
const Uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function pathParts(context: RouteContext) {
  return (await context.params).path;
}

export async function GET(request: Request, context: RouteContext) {
  const parts = await pathParts(context);
  if (parts.length === 1 && Uuid.test(parts[0] ?? "")) {
    return forwardGuidedLearningRequest({ apiPath: `/v1/editor/learning-paths/${parts[0]}`, method: "GET", request, responseSchema: LearningPathDetailSchema });
  }
  if (parts.length === 2 && Uuid.test(parts[0] ?? "") && parts[1] === "preview") {
    return forwardGuidedLearningRequest({ apiPath: `/v1/editor/learning-paths/${parts[0]}/preview`, method: "GET", request, responseSchema: LearningPathDetailSchema });
  }
  return Response.json({ error: "not_found" }, { status: 404 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const parts = await pathParts(context);
  if (parts.length === 1 && Uuid.test(parts[0] ?? "")) {
    return forwardGuidedLearningRequest({ apiPath: `/v1/editor/learning-paths/${parts[0]}`, method: "PATCH", request, responseSchema: LearningPathDetailSchema });
  }
  return Response.json({ error: "not_found" }, { status: 404 });
}

export async function POST(request: Request, context: RouteContext) {
  const parts = await pathParts(context);
  if (parts.length !== 2 || !Uuid.test(parts[0] ?? "")) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const operation = parts[1];
  if (!operation || !["transition", "validate", "versions"].includes(operation)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return forwardGuidedLearningRequest({
    apiPath: `/v1/editor/learning-paths/${parts[0]}/${operation}`,
    method: "POST",
    request,
    responseSchema: operation === "validate" ? LearningPathValidationResponseSchema : LearningPathDetailSchema,
  });
}
