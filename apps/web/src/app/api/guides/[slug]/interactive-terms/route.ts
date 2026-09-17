import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublishedContentItem, requestContentApi, safeContentApiStatus } from "@/lib/server/content-api";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

const ParamsSchema = z.object({
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

const ResponseSchema = z.object({
  annotations: z.array(z.object({
    end: z.number().int().nonnegative(),
    path: z.string().min(1).max(200),
    start: z.number().int().nonnegative(),
    termId: z.string().uuid(),
  }).strict()),
  dictionaryVersion: z.number().int().positive(),
  terms: z.array(z.object({
    category: z.string().nullable(),
    id: z.string().uuid(),
    link: z.object({
      anchor: z.string().nullable(),
      contentId: z.string().uuid(),
      slug: z.string(),
      title: z.string(),
    }).strict().nullable(),
    name: z.string(),
    shortDefinition: z.string(),
    slug: z.string(),
  }).strict()),
}).strict();

export async function GET(_request: Request, context: Context) {
  const params = ParamsSchema.safeParse(await context.params);
  if (!params.success) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const published = await getPublishedContentItem(params.data.slug);
  if (published.status !== "ready" || (published.item.kind !== "guide" && published.item.kind !== "video")) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const response = await requestContentApi({
    method: "GET",
    path: `/v1/content/${published.item.id}/interactive-terms`,
  });
  const parsed = response.status === 200 ? ResponseSchema.safeParse(response.body) : null;
  if (!parsed?.success) {
    return NextResponse.json(
      { error: "interactive_terms_unavailable" },
      { status: response.status === 200 ? 503 : safeContentApiStatus(response.status) },
    );
  }

  return NextResponse.json(parsed.data, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
