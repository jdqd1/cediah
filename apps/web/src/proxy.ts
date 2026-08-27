import { NextRequest, NextResponse } from "next/server";
import {
  getPublicTurnstileSiteKey,
  getPublicVideoStorageOrigin,
} from "@/lib/auth/environment";

function createNonce() {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const developmentScriptPolicy =
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  const videoStorageOrigin = getPublicVideoStorageOrigin();
  const turnstileEnabled = Boolean(getPublicTurnstileSiteKey());
  const turnstileOrigin = "https://challenges.cloudflare.com";
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developmentScriptPolicy}${turnstileEnabled ? ` ${turnstileOrigin}` : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `media-src 'self'${videoStorageOrigin ? ` ${videoStorageOrigin}` : ""} blob:`,
    `connect-src 'self'${videoStorageOrigin ? ` ${videoStorageOrigin}` : ""}${turnstileEnabled ? ` ${turnstileOrigin}` : ""}`,
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

  const response = NextResponse.next({ request: { headers: requestHeaders } });

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
