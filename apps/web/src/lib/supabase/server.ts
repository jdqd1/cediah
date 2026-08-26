import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getPublicSupabaseConfiguration,
  getSupabaseCookieOptions,
} from "./environment";

export async function createServerSupabaseClient() {
  const configuration = getPublicSupabaseConfiguration();
  if (!configuration) return null;

  const cookieStore = await cookies();

  return createServerClient(configuration.url, configuration.publishableKey, {
    cookieOptions: getSupabaseCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, options, value }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot persist refreshed cookies. The proxy does it before rendering.
        }
      },
    },
  });
}
