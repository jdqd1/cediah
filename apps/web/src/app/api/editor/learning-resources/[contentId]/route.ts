import { LearningEditorMaterialDetailSchema } from "@cediah/contracts";
import { forwardGuidedLearningRequest } from "@/lib/server/guided-learning-route";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ contentId: string }> };
const Uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const Projection = new Set(["flashcards", "guide", "quiz", "video"]);

export async function GET(request: Request, context: RouteContext) {
  const { contentId } = await context.params;
  const searchParams = new URL(request.url).searchParams;
  const projection = searchParams.get("projection");
  if (
    !Uuid.test(contentId)
    || !projection
    || !Projection.has(projection)
    || [...searchParams.keys()].some((key) => key !== "projection")
  ) {
    return Response.json({ error: "not_found" }, {
      headers: { "Cache-Control": "private, no-store" },
      status: 404,
    });
  }
  const query = new URLSearchParams({ projection });
  return forwardGuidedLearningRequest({
    apiPath: `/v1/editor/learning-resources/${encodeURIComponent(contentId)}?${query.toString()}`,
    method: "GET",
    request,
    responseSchema: LearningEditorMaterialDetailSchema,
  });
}
