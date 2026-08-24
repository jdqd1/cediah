import "server-only";
import { NextResponse } from "next/server";
import { getApiAccessToken } from "./api-session";
import {
  getContentApiError,
  requestContentApi,
  safeContentApiStatus,
} from "./content-api";

export function noStoreContentJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

export async function readContentJson(request: Request) {
  try {
    return { body: (await request.json()) as unknown, status: "ready" as const };
  } catch {
    return { status: "invalid" as const };
  }
}

export async function forwardEditorContentRequest(input: {
  body?: unknown;
  method: "DELETE" | "GET" | "PATCH" | "POST";
  path: string;
  responseSchema?: {
    safeParse: (body: unknown) =>
      | { data: unknown; success: true }
      | { success: false };
  };
}) {
  const session = await getApiAccessToken();
  if (session.status === "anonymous") {
    return noStoreContentJson({ error: "unauthorized" }, 401);
  }
  if (session.status === "unavailable") {
    return noStoreContentJson({ error: "identity_unavailable" }, 503);
  }

  const response = await requestContentApi({
    accessToken: session.accessToken,
    body: input.body,
    method: input.method,
    path: input.path,
  });
  if (response.status >= 400) {
    return noStoreContentJson(
      { error: getContentApiError(response.body) },
      safeContentApiStatus(response.status),
    );
  }

  if (input.responseSchema) {
    const parsed = input.responseSchema.safeParse(response.body);
    if (!parsed.success) {
      return noStoreContentJson({ error: "content_unavailable" }, 502);
    }
    return noStoreContentJson(parsed.data, response.status);
  }

  return noStoreContentJson(response.body, response.status);
}
