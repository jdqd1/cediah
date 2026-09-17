import "server-only";
import { NextResponse } from "next/server";
import { getApiRequestCookie } from "./api-session";
import { getContentApiError, requestContentApi, safeContentApiStatus } from "./content-api";

export function noStoreInteractiveTermAdminJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

export async function readInteractiveTermAdminJson(request: Request) {
  try {
    return { body: (await request.json()) as unknown, status: "ready" as const };
  } catch {
    return { status: "invalid" as const };
  }
}

export async function forwardInteractiveTermAdminRequest(input: {
  body?: unknown;
  method: "GET" | "POST" | "PATCH";
  path: string;
}) {
  const session = await getApiRequestCookie();
  if (session.status === "anonymous") {
    return noStoreInteractiveTermAdminJson({ error: "unauthorized" }, 401);
  }

  const response = await requestContentApi({
    body: input.body,
    cookie: session.cookie,
    method: input.method,
    path: input.path,
  });
  if (response.status >= 400) {
    return noStoreInteractiveTermAdminJson(
      { error: getContentApiError(response.body) },
      safeContentApiStatus(response.status),
    );
  }

  return noStoreInteractiveTermAdminJson(response.body, response.status);
}
