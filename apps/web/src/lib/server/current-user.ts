import "server-only";
import {
  CurrentUserResponseSchema,
  type CurrentUser,
  type PlatformRole,
} from "@cediah/contracts";
import { cache } from "react";
import { getApiRequestCookie } from "./api-session";
import { requestContentApi } from "./content-api";

export type CurrentUserResult =
  | { roles: PlatformRole[]; status: "authenticated"; user: CurrentUser }
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
    ? { roles: parsed.data.roles, status: "authenticated", user: parsed.data.user }
    : { status: "unavailable" };
}

export const getCurrentUser = cache(resolveCurrentUser);

export async function currentUserIsAdministrator(): Promise<boolean> {
  const current = await getCurrentUser();
  if (current.status !== "authenticated") return false;
  return current.roles.includes("administrator");
}
