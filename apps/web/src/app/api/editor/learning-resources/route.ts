import { LearningEditorResourceCatalogResponseSchema } from "@cediah/contracts";
import { forwardGuidedLearningRequest } from "@/lib/server/guided-learning-route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return forwardGuidedLearningRequest({
    apiPath: `/v1/editor/learning-resources${new URL(request.url).search}`,
    method: "GET",
    request,
    responseSchema: LearningEditorResourceCatalogResponseSchema,
  });
}
