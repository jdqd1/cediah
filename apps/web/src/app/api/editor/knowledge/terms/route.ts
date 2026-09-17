import {
  KnowledgeTermAdminListSchema,
  KnowledgeTermAdminSchema,
} from "@cediah/contracts";
import {
  forwardEditorContentRequest,
  noStoreContentJson,
  readContentJson,
} from "@/lib/server/editor-content-route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  const path = query
    ? `/v1/editor/knowledge/terms?q=${encodeURIComponent(query)}`
    : "/v1/editor/knowledge/terms";
  return forwardEditorContentRequest({
    method: "GET",
    path,
    responseSchema: KnowledgeTermAdminListSchema,
  });
}

export async function POST(request: Request) {
  const parsed = await readContentJson(request);
  if (parsed.status === "invalid") {
    return noStoreContentJson({ error: "invalid_knowledge_term" }, 400);
  }
  return forwardEditorContentRequest({
    body: parsed.body,
    method: "POST",
    path: "/v1/editor/knowledge/terms",
    responseSchema: KnowledgeTermAdminSchema,
  });
}
