import { forwardEditorContentRequest } from "@/lib/server/editor-content-route";

export const dynamic = "force-dynamic";

type ContentAssetFinalizeRouteProps = {
  params: Promise<{ assetId: string }>;
};

export async function POST(
  _request: Request,
  { params }: ContentAssetFinalizeRouteProps,
) {
  const { assetId } = await params;
  return forwardEditorContentRequest({
    method: "POST",
    path: "/v1/editor/assets/" + encodeURIComponent(assetId) + "/finalize",
  });
}
