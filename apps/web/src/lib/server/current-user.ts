import "server-only";
import {
  CurrentUserResponseSchema,
  type CurrentUser,
} from "@cediah/contracts";
import { cache } from "react";
import { getAdminRoleUser } from "./admin-role-api";
import { getApiRequestCookie } from "./api-session";
import { requestContentApi } from "./content-api";

export type CurrentUserResult =
  | { status: "authenticated"; user: CurrentUser }
  | { status: "anonymous" }
  | { status: "unavailable" };

async function resolveCurrentUser(): Promise<CurrentUserResult> {
  const credentials = await getApiRequestCookie();
  if (credentials.status === "anonymous") return credentials;

  const response = await requestContentApi({
    cookie: credentials.cookie,
    method: "GET",
    path: "/v1/auth/me",
  });
  if (response.status === 401) return { status: "anonymous" };
  if (response.status !== 200) return { status: "unavailable" };

  const parsed = CurrentUserResponseSchema.safeParse(response.body);
  return parsed.success
    ? { status: "authenticated", user: parsed.data.user }
    : { status: "unavailable" };
}

export const getCurrentUser = cache(resolveCurrentUser);

export async function currentUserIsAdministrator(): Promise<boolean> {
  const current = await getCurrentUser();
  if (current.status !== "authenticated") return false;
  const result = await getAdminRoleUser(current.user.email);
  return result.status === "ready" && result.user.roles.includes("administrator");
}
