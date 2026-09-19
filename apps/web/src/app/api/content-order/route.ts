import { NextResponse } from "next/server";
import { z } from "zod";
import { requestContentApi } from "@/lib/server/content-api";

const ContentTopicOrdersResponseSchema = z.object({
  topicOrder: z.array(z.string().trim().min(1).max(120)).default([]),
  topics: z.array(z.object({
    contentIds: z.array(z.string().uuid()),
    topic: z.string().trim().min(1).max(120),
  })),
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const subjectId = new URL(request.url).searchParams.get("subjectId")?.trim() ?? "";
  if (!z.string().uuid().safeParse(subjectId).success) {
    return NextResponse.json(
      { error: "invalid_subject" },
      { headers: { "Cache-Control": "no-store" }, status: 400 },
    );
  }

  const response = await requestContentApi({
    cachePublic: false,
    method: "GET",
    path: `/v1/content/topic-order?subjectId=${encodeURIComponent(subjectId)}`,
  });
  const parsed = ContentTopicOrdersResponseSchema.safeParse(response.body);
  if (response.status !== 200 || !parsed.success) {
    return NextResponse.json(
      { error: "content_unavailable" },
      { headers: { "Cache-Control": "no-store" }, status: response.status === 400 ? 400 : 503 },
    );
  }

  return NextResponse.json(parsed.data, {
    headers: { "Cache-Control": "no-store" },
  });
}
