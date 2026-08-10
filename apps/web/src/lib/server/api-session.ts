import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ApiAccessTokenResult =
  | { status: "authenticated"; accessToken: string }
  | { status: "anonymous" }
  | { status: "unavailable" };

export async function getApiAccessToken(): Promise<ApiAccessTokenResult> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { status: "unavailable" };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return { status: "anonymous" };

  return { accessToken: session.access_token, status: "authenticated" };
}
