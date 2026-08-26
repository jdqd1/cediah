import "server-only";
import type { CurrentUser } from "@cediah/contracts";
import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminRoleUser } from "./admin-role-api";

export type CurrentUserResult =
  | { accessToken: string; status: "authenticated"; user: CurrentUser }
  | { status: "anonymous" }
  | { status: "unavailable" };

async function resolveCurrentUser(): Promise<CurrentUserResult> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { status: "unavailable" };

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (
    claimsError ||
    !claims ||
    claims.role !== "authenticated" ||
    claims.is_anonymous === true
  ) {
    return { status: "anonymous" };
  }

  const sessionResult = await supabase.auth.getSession();
  const session = sessionResult.data.session;
  const email = typeof claims.email === "string" ? claims.email : null;
  if (!session?.access_token || !email || typeof claims.sub !== "string") {
    return { status: "anonymous" };
  }

  return {
    accessToken: session.access_token,
    status: "authenticated",
    user: { email, id: claims.sub },
  };
}

export const getCurrentUser = cache(resolveCurrentUser);

export async function currentUserIsAdministrator(): Promise<boolean> {
  const current = await getCurrentUser();
  if (current.status !== "authenticated") return false;
  const result = await getAdminRoleUser(current.accessToken, current.user.email);
  return result.status === "ready" && result.user.roles.includes("administrator");
}
