import { getServerEnvironment } from "@/lib/server/env";

export const dynamic = "force-dynamic";

type AuthProxyRouteProps = {
  params: Promise<{ path: string[] }>;
};

const forwardedRequestHeaders = [
  "accept",
  "accept-language",
  "content-type",
  "cookie",
  "origin",
  "referer",
  "sec-fetch-mode",
  "sec-fetch-site",
  "user-agent",
  "x-captcha-response",
  "x-forwarded-for",
] as const;

function createUpstreamHeaders(request: Request) {
  const headers = new Headers();
  for (const name of forwardedRequestHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const publicUrl = new URL(request.url);
  headers.set("x-forwarded-host", publicUrl.host);
  headers.set("x-forwarded-proto", publicUrl.protocol.slice(0, -1));
  return headers;
}

function getSetCookieHeaders(headers: Headers) {
  const extendedHeaders = headers as Headers & {
    getSetCookie?: () => string[];
  };
  return extendedHeaders.getSetCookie?.() ?? [];
}

async function forwardAuthRequest(
  request: Request,
  { params }: AuthProxyRouteProps,
) {
  const { path } = await params;
  if (
    path.length === 0 ||
    path.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        /[\\/\u0000-\u001f\u007f]/.test(segment),
    )
  ) {
    return Response.json(
      { code: "INVALID_AUTH_PATH", message: "Invalid authentication path" },
      { headers: { "Cache-Control": "private, no-store" }, status: 400 },
    );
  }
  const environment = getServerEnvironment();
  const requestUrl = new URL(request.url);
  const encodedPath = path.map(encodeURIComponent).join("/");
  const upstreamUrl = new URL(
    `/api/auth/${encodedPath}${requestUrl.search}`,
    environment.API_BASE_URL,
  );
  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      headers: createUpstreamHeaders(request),
      method: request.method,
      redirect: "manual",
    });
    const responseHeaders = new Headers(upstreamResponse.headers);
    const setCookieHeaders = getSetCookieHeaders(upstreamResponse.headers);
    responseHeaders.delete("connection");
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    responseHeaders.delete("set-cookie");
    responseHeaders.delete("transfer-encoding");
    for (const value of setCookieHeaders) responseHeaders.append("set-cookie", value);
    responseHeaders.set("Cache-Control", "private, no-store");

    return new Response(upstreamResponse.body, {
      headers: responseHeaders,
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
    });
  } catch {
    return Response.json(
      { code: "AUTH_SERVICE_UNAVAILABLE", message: "Authentication service unavailable" },
      {
        headers: { "Cache-Control": "private, no-store" },
        status: 503,
      },
    );
  }
}

export const DELETE = forwardAuthRequest;
export const GET = forwardAuthRequest;
export const OPTIONS = forwardAuthRequest;
export const PATCH = forwardAuthRequest;
export const POST = forwardAuthRequest;
export const PUT = forwardAuthRequest;
