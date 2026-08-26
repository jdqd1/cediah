import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ApiAccessTokenResult =
  | { status: "authenticated"; accessToken: string }
  | { status: "anonymous" }
  | { status: "unavailable" };

export async function getApiAccessToken(): Promise<ApiAccessTokenResult> {
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

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return { status: "anonymous" };

  return { accessToken: session.access_token, status: "authenticated" };
}
