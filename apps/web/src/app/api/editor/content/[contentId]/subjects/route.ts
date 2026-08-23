import { ContentItemSchema } from "@cediah/contracts";
import {
  forwardEditorContentRequest,
  readContentJson,
  noStoreContentJson,
} from "@/lib/server/editor-content-route";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ contentId: string }> },
) {
  const parsed = await readContentJson(request);
  if (parsed.status === "invalid") {
    return noStoreContentJson({ error: "invalid_subject" }, 400);
  }

  const { contentId } = await context.params;
  return forwardEditorContentRequest({
    body: parsed.body,
    method: "PATCH",
    path: `/v1/editor/content/${encodeURIComponent(contentId)}/subjects`,
    responseSchema: ContentItemSchema,
  });
}
