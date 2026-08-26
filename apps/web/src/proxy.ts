import { NextRequest, NextResponse } from "next/server";
import { getSafeNextPath } from "@/lib/auth/validation";
import {
  getPublicSupabaseConfiguration,
  getPublicTurnstileSiteKey,
} from "@/lib/supabase/environment";
import {
  type SupabaseCookie,
  updateSupabaseSession,
} from "@/lib/supabase/proxy";

function createNonce() {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

const publicPagePaths = new Set([
  "/",
  "/acceder",
  "/auth/callback",
  "/recuperar-acceso",
]);

function normalizePathname(pathname: string) {
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}

function applySessionCookies(
  response: NextResponse,
  cookies: SupabaseCookie[],
) {
  cookies.forEach(({ name, options, value }) => {
    response.cookies.set(name, value, options);
  });
}

export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const developmentScriptPolicy =
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  const supabaseUrl = getPublicSupabaseConfiguration()?.url;
  const turnstileEnabled = Boolean(getPublicTurnstileSiteKey());
  const turnstileOrigin = "https://challenges.cloudflare.com";
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developmentScriptPolicy}${turnstileEnabled ? ` ${turnstileOrigin}` : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `media-src 'self'${supabaseUrl ? ` ${new URL(supabaseUrl).origin}` : ""} blob:`,
    `connect-src 'self'${supabaseUrl ? ` ${new URL(supabaseUrl).origin}` : ""}${turnstileEnabled ? ` ${turnstileOrigin}` : ""}`,
    ...(turnstileEnabled ? [`frame-src ${turnstileOrigin}`] : []),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(process.env.NODE_ENV === "production"
      ? ["upgrade-insecure-requests"]
      : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const requestWithNonce = new NextRequest(request, { headers: requestHeaders });
  const session = await updateSupabaseSession(requestWithNonce);
  const pathname = normalizePathname(request.nextUrl.pathname);
  const isPublicPage = publicPagePaths.has(pathname);
  let response = session.response;

  if (!session.isAuthenticated && !isPublicPage) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/acceder";
    destination.search = "";
    destination.searchParams.set(
      "next",
      getSafeNextPath(`${request.nextUrl.pathname}${request.nextUrl.search}`),
    );
    response = NextResponse.redirect(destination, 307);
    applySessionCookies(response, session.cookiesToSet);
  } else if (
    session.isAuthenticated &&
    (pathname === "/" || pathname === "/acceder" || pathname === "/recuperar-acceso")
  ) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/dashboard";
    destination.search = "";
    response = NextResponse.redirect(destination, 307);
    applySessionCookies(response, session.cookiesToSet);
  }

  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cache-Control", "private, no-store");

  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:css|js|map|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|eot|txt|xml)$).*)",
    },
  ],
};
