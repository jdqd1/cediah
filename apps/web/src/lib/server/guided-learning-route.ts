import "server-only";
import { NextResponse } from "next/server";
import { getApiRequestCookie } from "./api-session";
import { getContentApiError, requestContentApi } from "./content-api";
import { isSameOriginRequest } from "../request-origin";

type ResponseSchema = {
  safeParse: (body: unknown) => { data: unknown; success: true } | { success: false };
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" }, status });
}

export async function forwardGuidedLearningRequest(input: {
  apiPath: string;
  method: "GET" | "PATCH" | "POST";
  request: Request;
  responseSchema?: ResponseSchema;
}) {
  if (input.method !== "GET" && !isSameOriginRequest(input.request)) {
    return json({ error: "forbidden" }, 403);
  }
  const session = await getApiRequestCookie();
  if (session.status === "anonymous") return json({ error: "unauthorized" }, 401);
  let body: unknown;
  if (input.method !== "GET") {
    try {
      body = await input.request.json();
    } catch {
      return json({ error: "invalid_request" }, 400);
    }
  }
  const response = await requestContentApi({
    body,
    cookie: session.cookie,
    headers: input.request.headers.get("Idempotency-Key")
      ? { "Idempotency-Key": input.request.headers.get("Idempotency-Key")! }
      : undefined,
    method: input.method,
    path: input.apiPath,
  });
  if (response.status >= 400) {
    const safeStatus = [400, 401, 403, 404, 409, 422, 429, 503].includes(response.status)
      ? response.status
      : 503;
    return json(response.body && typeof response.body === "object"
      ? response.body
      : { error: getContentApiError(response.body) }, safeStatus);
  }
  if (input.responseSchema) {
    const parsed = input.responseSchema.safeParse(response.body);
    if (!parsed.success) return json({ error: "learning_unavailable" }, 502);
    return json(parsed.data, response.status);
  }
  return json(response.body, response.status);
}
