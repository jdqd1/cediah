import { ContentItemSchema, ContentTransitionRequestSchema } from "@cediah/contracts";
import {
  forwardEditorContentRequest,
  noStoreContentJson,
  readContentJson,
} from "@/lib/server/editor-content-route";
import { requestContentApi } from "@/lib/server/content-api";

export const dynamic = "force-dynamic";

type ContentTransitionRouteProps = {
  params: Promise<{ contentId: string }>;
};

async function warmInteractiveTerms(contentId: string) {
  // Publication is the normal compilation point. The public endpoint keeps its
  // lazy stale-snapshot fallback for resilience, but readers should almost
  // always hit a precompiled annotation snapshot.
  await requestContentApi({
    method: "GET",
    path: `/v1/content/${encodeURIComponent(contentId)}/interactive-terms`,
    timeoutMs: 10_000,
  });
}

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
    const response = await forwardEditorContentRequest({
      body: transition.data,
      method: "POST",
      path,
      responseSchema: ContentItemSchema,
    });
    if (response.ok && transition.data.status === "published") {
      await warmInteractiveTerms(contentId);
    }
    return response;
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

  const publicationResponse = await forwardEditorContentRequest({
    body: { status: "published" },
    method: "POST",
    path,
    responseSchema: ContentItemSchema,
  });
  if (publicationResponse.ok) {
    await warmInteractiveTerms(contentId);
  }
  return publicationResponse;
}
