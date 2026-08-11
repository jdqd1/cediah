import "server-only";
import type { CurrentUser } from "@cediah/contracts";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CurrentUserResult =
  | { accessToken: string; status: "authenticated"; user: CurrentUser }
  | { status: "anonymous" }
  | { status: "unavailable" };

export async function getCurrentUser(): Promise<CurrentUserResult> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { status: "unavailable" };

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (claimsError || !claims) return { status: "anonymous" };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return { status: "anonymous" };

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user?.email || user.id !== claims.sub) return { status: "anonymous" };

  return {
    accessToken: session.access_token,
    status: "authenticated",
    user: { email: user.email, id: user.id },
  };
}
