const DEFAULT_PRODUCTION_SITE_ORIGIN = "https://koraz-app.vercel.app";

export const LEGACY_SITE_HOSTS = [
  "cediah.vercel.app",
  "web-cediah.onrender.com",
] as const;

export function getCanonicalSiteUrl(
  configuredUrl = process.env.NEXT_PUBLIC_SITE_URL,
) {
  const candidate = configuredUrl?.trim() || DEFAULT_PRODUCTION_SITE_ORIGIN;

  try {
    const url = new URL(candidate);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return new URL(DEFAULT_PRODUCTION_SITE_ORIGIN);
    }

    return new URL(url.origin);
  } catch {
    return new URL(DEFAULT_PRODUCTION_SITE_ORIGIN);
  }
}
