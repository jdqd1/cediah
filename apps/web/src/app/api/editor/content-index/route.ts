import { ContentEditorIndexPageSchema } from "@cediah/contracts";
import { forwardEditorContentRequest } from "@/lib/server/editor-content-route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const source = new URL(request.url);
  const query = source.searchParams.toString();
  return forwardEditorContentRequest({
    method: "GET",
    path: `/v1/editor/content-index${query ? `?${query}` : ""}`,
    responseSchema: ContentEditorIndexPageSchema,
  });
}
