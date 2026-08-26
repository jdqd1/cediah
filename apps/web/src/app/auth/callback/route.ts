import { type NextRequest, NextResponse } from "next/server";
import { getSafeNextPath } from "@/lib/auth/validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function noStoreRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));
  const code = request.nextUrl.searchParams.get("code");
  const redirectUrl = new URL(nextPath, request.nextUrl.origin);

  if (!code || code.length < 16 || code.length > 4_096 || /[\u0000-\u001f\u007f]/.test(code)) {
    redirectUrl.pathname = "/acceder";
    redirectUrl.search = "?error=confirmacion";
    return noStoreRedirect(redirectUrl);
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirectUrl.pathname = "/acceder";
    redirectUrl.search = "?error=configuracion";
    return noStoreRedirect(redirectUrl);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  const claimsResult = error ? null : await supabase.auth.getClaims();
  const claims = claimsResult?.data?.claims;
  const hasVerifiedAccountClaims = Boolean(
    typeof claims?.sub === "string" &&
      typeof claims.email === "string" &&
      claims.role === "authenticated" &&
      claims.is_anonymous !== true,
  );
  if (
    error ||
    claimsResult?.error ||
    !hasVerifiedAccountClaims
  ) {
    redirectUrl.pathname = "/acceder";
    redirectUrl.search = "?error=confirmacion";
  }

  return noStoreRedirect(redirectUrl);
}
