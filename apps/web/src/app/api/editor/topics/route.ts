import { z } from "zod";
import {
  forwardEditorContentRequest,
  noStoreContentJson,
  readContentJson,
} from "@/lib/server/editor-content-route";

const ContentTopicResponseSchema = z.object({
  topic: z.object({
    name: z.string().trim().min(1).max(120),
    subjectIds: z.array(z.string().uuid()),
  }),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = await readContentJson(request);
  if (parsed.status === "invalid") {
    return noStoreContentJson({ error: "invalid_topic" }, 400);
  }

  return forwardEditorContentRequest({
    body: parsed.body,
    method: "POST",
    path: "/v1/editor/topics",
    responseSchema: ContentTopicResponseSchema,
  });
}
