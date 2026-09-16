import { z } from "zod";
import { forwardEditorContentRequest } from "@/lib/server/editor-content-route";

const ContentTopicItemsResponseSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    kind: z.enum(["guide", "video"]),
    status: z.enum([
      "draft",
      "in_review",
      "changes_requested",
      "approved",
      "published",
      "archived",
    ]),
    subjectIds: z.array(z.string().uuid()),
    title: z.string().max(200),
    topics: z.array(z.string().trim().min(1).max(120)),
  })),
  topics: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    subjectIds: z.array(z.string().uuid()),
  })),
});

export const dynamic = "force-dynamic";

export async function GET() {
  return forwardEditorContentRequest({
    method: "GET",
    path: "/v1/editor/topic-items",
    responseSchema: ContentTopicItemsResponseSchema,
  });
}
