import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import {
  getPublicSupabaseConfiguration,
  getSupabaseCookieOptions,
} from "./environment";

export type SupabaseCookie = {
  name: string;
  options: CookieOptions;
  value: string;
};

export async function updateSupabaseSession(request: NextRequest) {
  const configuration = getPublicSupabaseConfiguration();
  let response = NextResponse.next({ request });
  let cookiesToSet: SupabaseCookie[] = [];
  if (!configuration) {
    return { cookiesToSet, isAuthenticated: false, response };
  }

  const supabase = createServerClient(configuration.url, configuration.publishableKey, {
    cookieOptions: getSupabaseCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(nextCookies) {
        cookiesToSet = nextCookies;
        nextCookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        nextCookies.forEach(({ name, options, value }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const isAuthenticated = Boolean(
    !error &&
      claims &&
      typeof claims.sub === "string" &&
      typeof claims.email === "string" &&
      claims.role === "authenticated" &&
      claims.is_anonymous !== true,
  );

  return { cookiesToSet, isAuthenticated, response };
}
