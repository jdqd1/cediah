import { ContentItemSchema, ContentTransitionRequestSchema } from "@cediah/contracts";
import {
  forwardEditorContentRequest,
  noStoreContentJson,
  readContentJson,
} from "@/lib/server/editor-content-route";

export const dynamic = "force-dynamic";

type ContentTransitionRouteProps = {
  params: Promise<{ contentId: string }>;
};

export async function POST(
  request: Request,
  { params }: ContentTransitionRouteProps,
) {
  const parsed = await readContentJson(request);
  if (parsed.status === "invalid") {
    return noStoreContentJson({ error: "invalid_content_transition" }, 400);
  }

  const transition = ContentTransitionRequestSchema.safeParse(parsed.body);
  if (!transition.success) {
    return noStoreContentJson({ error: "invalid_content_transition" }, 400);
  }

  const { contentId } = await params;
  const path =
    "/v1/editor/content/" +
    encodeURIComponent(contentId) +
    "/transition";

  if (transition.data.status !== "approved") {
    return forwardEditorContentRequest({
      body: transition.data,
      method: "POST",
      path,
      responseSchema: ContentItemSchema,
    });
  }

  // Reviewers and publishers are currently the same platform roles. Keep the
  // backend's explicit approval and publication transitions for auditability,
  // but expose them as one user action so publishing does not require a second click.
  const approvalResponse = await forwardEditorContentRequest({
    body: { status: "approved" },
    method: "POST",
    path,
    responseSchema: ContentItemSchema,
  });
  if (!approvalResponse.ok) return approvalResponse;

  return forwardEditorContentRequest({
    body: { status: "published" },
    method: "POST",
    path,
    responseSchema: ContentItemSchema,
  });
}
