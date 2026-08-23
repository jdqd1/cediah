import { SubjectResponseSchema } from "@cediah/contracts";
import {
  forwardEditorContentRequest,
  noStoreContentJson,
  readContentJson,
} from "@/lib/server/editor-content-route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = await readContentJson(request);
  if (parsed.status === "invalid") {
    return noStoreContentJson({ error: "invalid_subject" }, 400);
  }

  return forwardEditorContentRequest({
    body: parsed.body,
    method: "POST",
    path: "/v1/editor/subjects",
    responseSchema: SubjectResponseSchema,
  });
}
