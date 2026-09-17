import {
  forwardInteractiveTermAdminRequest,
  noStoreInteractiveTermAdminJson,
  readInteractiveTermAdminJson,
} from "@/lib/server/interactive-term-admin-route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = await readInteractiveTermAdminJson(request);
  if (parsed.status === "invalid") {
    return noStoreInteractiveTermAdminJson({ error: "invalid_interactive_term_preview" }, 400);
  }
  return forwardInteractiveTermAdminRequest({
    body: parsed.body,
    method: "POST",
    path: "/v1/admin/interactive-terms/preview",
  });
}
