import {
  forwardInteractiveTermAdminRequest,
  noStoreInteractiveTermAdminJson,
  readInteractiveTermAdminJson,
} from "@/lib/server/interactive-term-admin-route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  const active = url.searchParams.get("active")?.trim() || "all";
  const params = new URLSearchParams({ active });
  if (q) params.set("q", q);
  return forwardInteractiveTermAdminRequest({
    method: "GET",
    path: `/v1/admin/interactive-terms?${params.toString()}`,
  });
}

export async function POST(request: Request) {
  const parsed = await readInteractiveTermAdminJson(request);
  if (parsed.status === "invalid") {
    return noStoreInteractiveTermAdminJson({ error: "invalid_interactive_term" }, 400);
  }
  return forwardInteractiveTermAdminRequest({
    body: parsed.body,
    method: "POST",
    path: "/v1/admin/interactive-terms",
  });
}
