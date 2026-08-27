import { type NextRequest, NextResponse } from "next/server";
import { getSafeNextPath } from "@/lib/auth/validation";

function noStoreRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));
  const error = request.nextUrl.searchParams.get("error");
  const redirectUrl = new URL(nextPath, request.nextUrl.origin);

  if (error) {
    redirectUrl.pathname = "/acceder";
    redirectUrl.search = "?error=confirmacion";
  }

  return noStoreRedirect(redirectUrl);
}
