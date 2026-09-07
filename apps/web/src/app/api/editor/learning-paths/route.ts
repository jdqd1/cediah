import {
  LearningEditorPathListResponseSchema,
  LearningPathDetailSchema,
} from "@cediah/contracts";
import { forwardGuidedLearningRequest } from "@/lib/server/guided-learning-route";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return forwardGuidedLearningRequest({
    apiPath: "/v1/editor/learning-paths",
    method: "GET",
    request,
    responseSchema: LearningEditorPathListResponseSchema,
  });
}

export function POST(request: Request) {
  return forwardGuidedLearningRequest({
    apiPath: "/v1/editor/learning-paths",
    method: "POST",
    request,
    responseSchema: LearningPathDetailSchema,
  });
}
