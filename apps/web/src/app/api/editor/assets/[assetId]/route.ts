import { forwardEditorContentRequest } from "@/lib/server/editor-content-route";

export const dynamic = "force-dynamic";

type ContentAssetRouteProps = {
  params: Promise<{ assetId: string }>;
};

export async function DELETE(_request: Request, { params }: ContentAssetRouteProps) {
  const { assetId } = await params;
  return forwardEditorContentRequest({
    method: "DELETE",
    path: "/v1/editor/assets/" + encodeURIComponent(assetId),
  });
}
