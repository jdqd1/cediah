import { NextResponse } from "next/server";
import { TestVideoUploadResponseSchema } from "@cediah/contracts";
import { getApiRequestCookie } from "@/lib/server/api-session";
import {
  getVideoTestApiError,
  requestVideoTestApi,
  safeVideoTestStatus,
} from "@/lib/server/video-test-api";

export const dynamic = "force-dynamic";

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

export async function POST(request: Request) {
  const session = await getApiRequestCookie();
  if (session.status === "anonymous") return noStoreJson({ error: "unauthorized" }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStoreJson({ error: "invalid_video_test_upload" }, 400);
  }

  const response = await requestVideoTestApi({
    cookie: session.cookie,
    body,
    method: "POST",
    path: "/v1/videos/test-uploads",
  });
  if (response.status >= 400) {
    return noStoreJson(
      { error: getVideoTestApiError(response.body) },
      safeVideoTestStatus(response.status),
    );
  }

  const result = TestVideoUploadResponseSchema.safeParse(response.body);
  if (!result.success) return noStoreJson({ error: "video_test_unavailable" }, 503);

  return noStoreJson(result.data);
}
