import { forwardInteractiveTermAdminRequest } from "@/lib/server/interactive-term-admin-route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = new URLSearchParams();
  const q = url.searchParams.get("q")?.trim();
  const minGuides = url.searchParams.get("minGuides")?.trim();
  const limit = url.searchParams.get("limit")?.trim();
  const includeGeneric = url.searchParams.get("includeGeneric")?.trim();

  if (q) params.set("q", q);
  if (minGuides) params.set("minGuides", minGuides);
  if (limit) params.set("limit", limit);
  if (includeGeneric) params.set("includeGeneric", includeGeneric);

  const suffix = params.toString();
  return forwardInteractiveTermAdminRequest({
    method: "GET",
    path: `/v1/admin/interactive-term-suggestions${suffix ? `?${suffix}` : ""}`,
  });
}
