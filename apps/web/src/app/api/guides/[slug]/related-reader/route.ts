import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublishedContentItem } from "@/lib/server/content-api";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

const ParamsSchema = z.object({
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export async function GET(_request: Request, context: Context) {
  const params = ParamsSchema.safeParse(await context.params);
  if (!params.success) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const result = await getPublishedContentItem(params.data.slug);
  if (result.status !== "ready" || result.item.kind !== "guide") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      document: result.item.content.document,
      sections: result.item.content.sections,
      slug: result.item.slug,
      title: result.item.title,
    },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
