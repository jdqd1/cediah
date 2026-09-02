/** Check the public request host, not Next's internal listening address. */
export function isSameOriginRequest(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const source = new URL(origin);
    const internal = new URL(request.url);
    const host = request.headers.get("host") ?? internal.host;
    const protocol = request.headers.get("x-forwarded-proto") ?? internal.protocol.slice(0, -1);
    return ["http", "https"].includes(protocol) && source.origin === `${protocol}://${host}`;
  } catch {
    return false;
  }
}
