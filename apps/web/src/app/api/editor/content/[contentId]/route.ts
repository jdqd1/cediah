import {
  forwardEditorContentRequest,
  noStoreContentJson,
  readContentJson,
} from "@/lib/server/editor-content-route";

export const dynamic = "force-dynamic";

type ContentRouteProps = {
  params: Promise<{ contentId: string }>;
};

export async function PATCH(request: Request, { params }: ContentRouteProps) {
  const parsed = await readContentJson(request);
  if (parsed.status === "invalid") {
    return noStoreContentJson({ error: "invalid_content" }, 400);
  }

  const { contentId } = await params;
  return forwardEditorContentRequest({
    body: parsed.body,
    method: "PATCH",
    path: "/v1/editor/content/" + encodeURIComponent(contentId),
  });
}
