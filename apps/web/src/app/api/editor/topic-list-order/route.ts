import { z } from "zod";
import {
  forwardEditorContentRequest,
  noStoreContentJson,
  readContentJson,
} from "@/lib/server/editor-content-route";

const ContentTopicListOrderMutationResponseSchema = z.object({
  order: z.object({
    subjectId: z.string().uuid(),
    topics: z.array(z.string().trim().min(1).max(120)),
  }),
});

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const parsed = await readContentJson(request);
  if (parsed.status === "invalid") {
    return noStoreContentJson({ error: "invalid_topic_order" }, 400);
  }

  return forwardEditorContentRequest({
    body: parsed.body,
    method: "PATCH",
    path: "/v1/editor/topic-list-order",
    responseSchema: ContentTopicListOrderMutationResponseSchema,
    timeoutMs: 20_000,
  });
}
