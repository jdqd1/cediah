import "server-only";
import {
  AdminRoleResponseSchema,
  type AdminRoleMutationRequest,
  type AdminRoleUser,
} from "@cediah/contracts";
import { getContentApiError, requestContentApi } from "./content-api";
import { getApiRequestCookie } from "./api-session";

export type AdminRoleUserResult =
  | { status: "forbidden" | "not_found" | "unavailable" }
  | { status: "ready"; user: AdminRoleUser };

export async function getAdminRoleUser(
  email: string,
): Promise<AdminRoleUserResult> {
  const session = await getApiRequestCookie();
  if (session.status === "anonymous") return { status: "forbidden" };
  const response = await requestContentApi({
    cookie: session.cookie,
    method: "GET",
    path: "/v1/admin/roles?email=" + encodeURIComponent(email),
  });
  if (response.status === 403) return { status: "forbidden" };
  if (response.status === 404) return { status: "not_found" };
  if (response.status !== 200) return { status: "unavailable" };

  const parsed = AdminRoleResponseSchema.safeParse(response.body);
  return parsed.success ? { status: "ready", user: parsed.data.user } : { status: "unavailable" };
}

export async function mutateAdminRole(
  input: AdminRoleMutationRequest,
): Promise<
  | { status: "ready"; user: AdminRoleUser }
  | { status: "forbidden" | "last_administrator" | "not_found" | "conflict" | "unavailable" }
> {
  const session = await getApiRequestCookie();
  if (session.status === "anonymous") return { status: "forbidden" };
  const response = await requestContentApi({
    cookie: session.cookie,
    body: input,
    method: "POST",
    path: "/v1/admin/roles",
  });
  if (response.status === 403) return { status: "forbidden" };
  if (response.status === 404) return { status: "not_found" };
  if (response.status === 409) {
    return getContentApiError(response.body) === "last_administrator"
      ? { status: "last_administrator" }
      : { status: "conflict" };
  }
  if (response.status !== 200) return { status: "unavailable" };

  const parsed = AdminRoleResponseSchema.safeParse(response.body);
  return parsed.success ? { status: "ready", user: parsed.data.user } : { status: "unavailable" };
}
