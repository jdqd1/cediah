import { DeletedSubjectSchema } from "@cediah/contracts";
import { forwardEditorContentRequest } from "@/lib/server/editor-content-route";

export const dynamic = "force-dynamic";

type SubjectRouteProps = {
  params: Promise<{ subjectId: string }>;
};

export async function DELETE(_request: Request, { params }: SubjectRouteProps) {
  const { subjectId } = await params;
  return forwardEditorContentRequest({
    method: "DELETE",
    path: "/v1/editor/subjects/" + encodeURIComponent(subjectId),
    responseSchema: DeletedSubjectSchema,
  });
}
