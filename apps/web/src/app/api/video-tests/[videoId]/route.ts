import { NextResponse } from "next/server";
import { TestVideoAssetResponseSchema } from "@cediah/contracts";
import { getApiAccessToken } from "@/lib/server/api-session";
import {
  getVideoTestApiError,
  requestVideoTestApi,
  safeVideoTestStatus,
} from "@/lib/server/video-test-api";

export const dynamic = "force-dynamic";

type VideoTestRouteProps = {
  params: Promise<{ videoId: string }>;
};

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

export async function GET(_request: Request, { params }: VideoTestRouteProps) {
  const session = await getApiAccessToken();
  if (session.status === "anonymous") return noStoreJson({ error: "unauthorized" }, 401);
  if (session.status === "unavailable") return noStoreJson({ error: "identity_unavailable" }, 503);

  const { videoId } = await params;
  const response = await requestVideoTestApi({
    accessToken: session.accessToken,
    method: "GET",
    path: "/v1/videos/test-assets/" + encodeURIComponent(videoId),
  });
  if (response.status >= 400) {
    return noStoreJson(
      { error: getVideoTestApiError(response.body) },
      safeVideoTestStatus(response.status),
    );
  }

  const result = TestVideoAssetResponseSchema.safeParse(response.body);
  if (!result.success) return noStoreJson({ error: "video_test_unavailable" }, 503);

  return noStoreJson(result.data);
}
