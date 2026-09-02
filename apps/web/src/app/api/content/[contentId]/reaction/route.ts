import { NextResponse } from "next/server";
import { z } from "zod";
import { ContentReactionRequestSchema, ContentReactionResponseSchema } from "@cediah/contracts";
import { getApiRequestCookie } from "@/lib/server/api-session";
import { requestContentApi, safeContentApiStatus } from "@/lib/server/content-api";
import { isSameOriginRequest } from "@/lib/request-origin";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ contentId: string }> };

async function reactionRequest(request: Request, context: Context, method: "GET" | "PATCH") {
  if (method === "PATCH" && !isSameOriginRequest(request)) {
    return NextResponse.json({ error: "forbidden" }, { headers, status: 403 });
  }
  const params = z.object({ contentId: z.string().uuid() }).safeParse(await context.params);
  if (!params.success) return NextResponse.json({ error: "invalid_content_id" }, { headers, status: 400 });
  const session = await getApiRequestCookie();
  if (session.status === "anonymous") return NextResponse.json({ error: "unauthorized" }, { headers, status: 401 });
  const payload = method === "PATCH"
    ? ContentReactionRequestSchema.safeParse(await request.json().catch(() => null))
    : null;
  if (payload && !payload.success) return NextResponse.json({ error: "invalid_reaction" }, { headers, status: 400 });
  const response = await requestContentApi({
    body: payload?.success ? payload.data : undefined,
    cookie: session.cookie,
    method,
    path: `/v1/content/${params.data.contentId}/reaction`,
  });
  const result = response.status === 200 ? ContentReactionResponseSchema.safeParse(response.body) : null;
  if (result?.success) return NextResponse.json(result.data, { headers });
  return NextResponse.json({ error: "reactions_unavailable" }, {
    headers, status: response.status === 200 ? 503 : safeContentApiStatus(response.status),
  });
}

export function GET(request: Request, context: Context) {
  return reactionRequest(request, context, "GET");
}

export function PATCH(request: Request, context: Context) {
  return reactionRequest(request, context, "PATCH");
}
