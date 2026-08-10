import "server-only";
import {
  AdminRoleResponseSchema,
  type AdminRoleMutationRequest,
  type AdminRoleUser,
} from "@cediah/contracts";
import { getContentApiError, requestContentApi } from "./content-api";

export type AdminRoleUserResult =
  | { status: "forbidden" | "not_found" | "unavailable" }
  | { status: "ready"; user: AdminRoleUser };

export async function getAdminRoleUser(
  accessToken: string,
  email: string,
): Promise<AdminRoleUserResult> {
  const response = await requestContentApi({
    accessToken,
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
  accessToken: string,
  input: AdminRoleMutationRequest,
): Promise<
  | { status: "ready"; user: AdminRoleUser }
  | { status: "forbidden" | "last_administrator" | "not_found" | "conflict" | "unavailable" }
> {
  const response = await requestContentApi({
    accessToken,
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
