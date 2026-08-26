type PublicSupabaseConfiguration = {
  publishableKey: string;
  url: string;
};

const exampleValues = ["your-project.supabase.co", "replace_me"];

function readLegacyJwtRole(key: string) {
  const segments = key.split(".");
  if (segments.length !== 3) return null;
  const payloadSegment = segments[1];
  if (!payloadSegment) return null;

  try {
    const payload = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (payload.length % 4)) % 4);
    const parsed = JSON.parse(atob(payload + padding)) as { role?: unknown };
    return typeof parsed.role === "string" ? parsed.role : null;
  } catch {
    return null;
  }
}

export function isSafePublicSupabaseKey(key: string) {
  if (key.length > 2_048 || key.startsWith("sb_secret_")) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  return readLegacyJwtRole(key) === "anon";
}

export function getPublicSupabaseConfiguration(): PublicSupabaseConfiguration | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (
    !url ||
    !publishableKey ||
    !isSafePublicSupabaseKey(publishableKey) ||
    exampleValues.some((value) => url.includes(value) || publishableKey.includes(value))
  ) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    const isLocalUrl = parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1";
    if (
      parsedUrl.username ||
      parsedUrl.password ||
      (parsedUrl.protocol !== "https:" && !(isLocalUrl && parsedUrl.protocol === "http:"))
    ) {
      return null;
    }

    return { publishableKey, url: parsedUrl.origin };
  } catch {
    return null;
  }
}

export function getPublicTurnstileSiteKey() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return siteKey && /^[A-Za-z0-9_-]{20,100}$/.test(siteKey) ? siteKey : null;
}

function usesLocalHttpSiteUrl() {
  try {
    const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
    return (
      siteUrl.protocol === "http:" &&
      (siteUrl.hostname === "localhost" || siteUrl.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

export function getSupabaseCookieOptions() {
  const secureOverride = process.env.NEXT_PUBLIC_SUPABASE_COOKIE_SECURE;
  const localInsecureOverride =
    secureOverride === "false" && usesLocalHttpSiteUrl();
  const secure =
    secureOverride === "true" ||
    (process.env.NODE_ENV === "production" && !localInsecureOverride);

  return {
    path: "/",
    sameSite: "lax" as const,
    secure,
  };
}
