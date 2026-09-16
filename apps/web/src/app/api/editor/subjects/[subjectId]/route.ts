import { DeletedSubjectSchema, SubjectResponseSchema } from "@cediah/contracts";
import {
  forwardEditorContentRequest,
  noStoreContentJson,
  readContentJson,
} from "@/lib/server/editor-content-route";

export const dynamic = "force-dynamic";

type SubjectRouteProps = {
  params: Promise<{ subjectId: string }>;
};

export async function PATCH(request: Request, { params }: SubjectRouteProps) {
  const parsed = await readContentJson(request);
  if (parsed.status === "invalid") {
    return noStoreContentJson({ error: "invalid_subject" }, 400);
  }

  const { subjectId } = await params;
  return forwardEditorContentRequest({
    body: parsed.body,
    method: "PATCH",
    path: "/v1/editor/subjects/" + encodeURIComponent(subjectId),
    responseSchema: SubjectResponseSchema,
  });
}

export async function DELETE(_request: Request, { params }: SubjectRouteProps) {
  const { subjectId } = await params;
  return forwardEditorContentRequest({
    method: "DELETE",
    path: "/v1/editor/subjects/" + encodeURIComponent(subjectId),
    responseSchema: DeletedSubjectSchema,
  });
}
