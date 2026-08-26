import type { NextConfig } from "next";
import { getCanonicalSiteUrl, LEGACY_SITE_HOSTS } from "./src/lib/site-url";

const canonicalSiteOrigin = getCanonicalSiteUrl().origin;
const legacySiteRedirects = LEGACY_SITE_HOSTS.map((hostname) => ({
  source: "/:path*",
  has: [{ type: "host" as const, value: hostname }],
  destination: `${canonicalSiteOrigin}/:path*`,
  permanent: true as const,
}));

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  output: "standalone",
  async redirects() {
    return legacySiteRedirects;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
