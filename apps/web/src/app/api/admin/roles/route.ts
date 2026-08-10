import {
  forwardAdminRoleRequest,
  noStoreAdminRoleJson,
  readAdminRoleJson,
} from "@/lib/server/admin-role-route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const email = new URL(request.url).searchParams.get("email")?.trim();
  if (!email) return noStoreAdminRoleJson({ error: "invalid_role_lookup" }, 400);

  return forwardAdminRoleRequest({
    method: "GET",
    path: "/v1/admin/roles?email=" + encodeURIComponent(email),
  });
}

export async function POST(request: Request) {
  const parsed = await readAdminRoleJson(request);
  if (parsed.status === "invalid") {
    return noStoreAdminRoleJson({ error: "invalid_role_assignment" }, 400);
  }

  return forwardAdminRoleRequest({
    body: parsed.body,
    method: "POST",
    path: "/v1/admin/roles",
  });
}