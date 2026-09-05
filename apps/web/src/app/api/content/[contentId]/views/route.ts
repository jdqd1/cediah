import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { ContentViewResponseSchema } from "@cediah/contracts";
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
  const result = response.status === 200 ? ContentViewResponseSchema.safeParse(response.body) : null;
  if (result?.success && result.data.counted) revalidateTag("published-content", { expire: 0 });
  return NextResponse.json(result?.success ? result.data : { error: "views_unavailable" }, {
    headers, status: result?.success ? 200 : response.status === 200 ? 503 : safeContentApiStatus(response.status),
  });
}
