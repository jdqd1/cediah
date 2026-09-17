import {
  forwardInteractiveTermAdminRequest,
  noStoreInteractiveTermAdminJson,
  readInteractiveTermAdminJson,
} from "@/lib/server/interactive-term-admin-route";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ termId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { termId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(termId)) {
    return noStoreInteractiveTermAdminJson({ error: "not_found" }, 404);
  }
  const parsed = await readInteractiveTermAdminJson(request);
  if (parsed.status === "invalid") {
    return noStoreInteractiveTermAdminJson({ error: "invalid_interactive_term" }, 400);
  }
  return forwardInteractiveTermAdminRequest({
    body: parsed.body,
    method: "PATCH",
    path: `/v1/admin/interactive-terms/${encodeURIComponent(termId)}`,
  });
}
