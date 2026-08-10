import {
  forwardEditorContentRequest,
  noStoreContentJson,
  readContentJson,
} from "@/lib/server/editor-content-route";

export const dynamic = "force-dynamic";

type ContentAssetRouteProps = {
  params: Promise<{ contentId: string }>;
};

export async function POST(request: Request, { params }: ContentAssetRouteProps) {
  const parsed = await readContentJson(request);
  if (parsed.status === "invalid") {
    return noStoreContentJson({ error: "invalid_content_asset" }, 400);
  }

  const { contentId } = await params;
  return forwardEditorContentRequest({
    body: parsed.body,
    method: "POST",
    path: "/v1/editor/content/" + encodeURIComponent(contentId) + "/assets",
  });
}
