import {
  forwardEditorContentRequest,
  noStoreContentJson,
  readContentJson,
} from "@/lib/server/editor-content-route";

export const dynamic = "force-dynamic";

type ContentTransitionRouteProps = {
  params: Promise<{ contentId: string }>;
};

export async function POST(
  request: Request,
  { params }: ContentTransitionRouteProps,
) {
  const parsed = await readContentJson(request);
  if (parsed.status === "invalid") {
    return noStoreContentJson({ error: "invalid_content_transition" }, 400);
  }

  const { contentId } = await params;
  return forwardEditorContentRequest({
    body: parsed.body,
    method: "POST",
    path:
      "/v1/editor/content/" +
      encodeURIComponent(contentId) +
      "/transition",
  });
}
