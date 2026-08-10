import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function GET(request: NextRequest) {
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
  const code = request.nextUrl.searchParams.get("code");
  const redirectUrl = new URL(nextPath, request.url);

  if (!code) {
    redirectUrl.pathname = "/acceder";
    redirectUrl.search = "?error=confirmacion";
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    redirectUrl.pathname = "/acceder";
    redirectUrl.search = "?error=configuracion";
    return NextResponse.redirect(redirectUrl);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    redirectUrl.pathname = "/acceder";
    redirectUrl.search = "?error=confirmacion";
  }

  return NextResponse.redirect(redirectUrl);
}
