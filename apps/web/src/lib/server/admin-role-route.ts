import "server-only";
import { NextResponse } from "next/server";
import { getApiRequestCookie } from "./api-session";
import { getContentApiError, requestContentApi, safeContentApiStatus } from "./content-api";

export function noStoreAdminRoleJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

export async function readAdminRoleJson(request: Request) {
  try {
    return { body: (await request.json()) as unknown, status: "ready" as const };
  } catch {
    return { status: "invalid" as const };
  }
}

export async function forwardAdminRoleRequest(input: {
  body?: unknown;
  method: "GET" | "POST";
  path: string;
}) {
  const session = await getApiRequestCookie();
  if (session.status === "anonymous") {
    return noStoreAdminRoleJson({ error: "unauthorized" }, 401);
  }

  const response = await requestContentApi({
    cookie: session.cookie,
    body: input.body,
    method: input.method,
    path: input.path,
  });
  if (response.status >= 400) {
    return noStoreAdminRoleJson(
      { error: getContentApiError(response.body) },
      safeContentApiStatus(response.status),
    );
  }

  return noStoreAdminRoleJson(response.body, response.status);
}
