import "server-only";
import type { CurrentUser } from "@cediah/contracts";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminRoleUser } from "./admin-role-api";

export type CurrentUserResult =
  | { accessToken: string; status: "authenticated"; user: CurrentUser }
  | { status: "anonymous" }
  | { status: "unavailable" };

export async function getCurrentUser(): Promise<CurrentUserResult> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { status: "unavailable" };

  const [claimsResult, sessionResult] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.auth.getSession(),
  ]);
  const { data: claimsData, error: claimsError } = claimsResult;
  const claims = claimsData?.claims;
  if (claimsError || !claims) return { status: "anonymous" };

  const session = sessionResult.data.session;
  const email = typeof claims.email === "string" ? claims.email : null;
  if (!session?.access_token || !email) {
    return { status: "anonymous" };
  }

  return {
    accessToken: session.access_token,
    status: "authenticated",
    user: { email, id: claims.sub },
  };
}

export async function currentUserIsAdministrator(): Promise<boolean> {
  const current = await getCurrentUser();
  if (current.status !== "authenticated") return false;
  const result = await getAdminRoleUser(current.accessToken, current.user.email);
  return result.status === "ready" && result.user.roles.includes("administrator");
}
