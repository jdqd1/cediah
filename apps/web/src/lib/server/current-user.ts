import "server-only";
import { CurrentUserResponseSchema, type CurrentUser } from "@cediah/contracts";
import { getServerEnvironment } from "./env";
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);

  try {
    const environment = getServerEnvironment();
    const response = await fetch(new URL("/v1/auth/me", environment.API_BASE_URL), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      signal: controller.signal,
    });

    if (response.status === 401) return { status: "anonymous" };
    if (!response.ok) return { status: "unavailable" };

    const result = CurrentUserResponseSchema.parse(await response.json());
    if (result.user.id !== claims.sub) return { status: "anonymous" };

    return { accessToken: session.access_token, status: "authenticated", user: result.user };
  } catch {
    return { status: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}
