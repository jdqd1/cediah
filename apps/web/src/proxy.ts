import { NextRequest } from "next/server";
import { getPublicSupabaseConfiguration } from "@/lib/supabase/environment";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

function createNonce() {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const developmentScriptPolicy =
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  const supabaseUrl = getPublicSupabaseConfiguration()?.url;
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developmentScriptPolicy}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${supabaseUrl ? ` ${new URL(supabaseUrl).origin}` : ""}`,
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
  const response = await updateSupabaseSession(requestWithNonce);
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
