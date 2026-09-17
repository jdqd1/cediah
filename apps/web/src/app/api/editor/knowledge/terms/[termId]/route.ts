import { z } from "zod";
import { KnowledgeTermAdminSchema } from "@cediah/contracts";
import {
  forwardEditorContentRequest,
  noStoreContentJson,
  readContentJson,
} from "@/lib/server/editor-content-route";

export const dynamic = "force-dynamic";

const TermIdSchema = z.string().uuid();
const KnowledgeTermDeactivateResponseSchema = z.object({
  active: z.literal(false),
  id: z.string().uuid(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ termId: string }> },
) {
  const { termId } = await context.params;
  const parsedId = TermIdSchema.safeParse(termId);
  if (!parsedId.success) {
    return noStoreContentJson({ error: "not_found" }, 404);
  }
  const parsed = await readContentJson(request);
  if (parsed.status === "invalid") {
    return noStoreContentJson({ error: "invalid_knowledge_term" }, 400);
  }

  return forwardEditorContentRequest({
    body: parsed.body,
    method: "PATCH",
    path: `/v1/editor/knowledge/terms/${encodeURIComponent(parsedId.data)}`,
    responseSchema: KnowledgeTermAdminSchema,
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ termId: string }> },
) {
  const { termId } = await context.params;
  const parsedId = TermIdSchema.safeParse(termId);
  if (!parsedId.success) {
    return noStoreContentJson({ error: "not_found" }, 404);
  }

  return forwardEditorContentRequest({
    method: "DELETE",
    path: `/v1/editor/knowledge/terms/${encodeURIComponent(parsedId.data)}`,
    responseSchema: KnowledgeTermDeactivateResponseSchema,
  });
}
