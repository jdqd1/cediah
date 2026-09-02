import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiRequestCookie } from "@/lib/server/api-session";
import { requestContentApi, safeContentApiStatus } from "@/lib/server/content-api";
import { isSameOriginRequest } from "@/lib/request-origin";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request, context: { params: Promise<{ contentId: string }> }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "forbidden" }, { headers, status: 403 });
  }
  const params = z.object({ contentId: z.string().uuid() }).safeParse(await context.params);
  if (!params.success) return NextResponse.json({ error: "invalid_content_id" }, { headers, status: 400 });
  const session = await getApiRequestCookie();
  if (session.status === "anonymous") return NextResponse.json({ error: "unauthorized" }, { headers, status: 401 });
  const response = await requestContentApi({
    cookie: session.cookie, method: "POST", path: `/v1/content/${params.data.contentId}/views`,
  });
  return NextResponse.json(response.status === 200 ? { recorded: true } : { error: "views_unavailable" }, {
    headers, status: response.status === 200 ? 200 : safeContentApiStatus(response.status),
  });
}
