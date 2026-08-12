import { ContentItemSchema } from "@cediah/contracts";
import {
  forwardEditorContentRequest,
  noStoreContentJson,
  readContentJson,
} from "@/lib/server/editor-content-route";

export const dynamic = "force-dynamic";

export async function GET() {
  return forwardEditorContentRequest({
    method: "GET",
    path: "/v1/editor/content",
  });
}

export async function POST(request: Request) {
  const parsed = await readContentJson(request);
  if (parsed.status === "invalid") {
    return noStoreContentJson({ error: "invalid_content" }, 400);
  }

  return forwardEditorContentRequest({
    body: parsed.body,
    method: "POST",
    path: "/v1/editor/content",
    responseSchema: ContentItemSchema,
  });
}
