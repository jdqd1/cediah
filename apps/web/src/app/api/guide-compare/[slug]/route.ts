import { GuideKnowledgeIndexSchema, ContentItemSchema } from "@cediah/contracts";
import { getPublishedContentItem } from "@/lib/server/content-api";
import { getGuideKnowledge } from "@/lib/server/guide-knowledge-api";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const [content, knowledge] = await Promise.all([
    getPublishedContentItem(slug),
    getGuideKnowledge(slug),
  ]);

  if (content.status !== "ready" || content.item.kind !== "guide") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const item = ContentItemSchema.parse(content.item);
  const guideKnowledge = knowledge.status === "ready"
    ? GuideKnowledgeIndexSchema.parse(knowledge.knowledge)
    : null;

  return Response.json(
    { item, knowledge: guideKnowledge },
    {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
      },
    },
  );
}
