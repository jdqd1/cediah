import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { getPublishedContent } from "@/lib/server/content-api";
import { searchPublishedContent } from "@/lib/content-search";
import { getGuideCatalog } from "@/lib/content-guide-links";

export const dynamic = "force-dynamic";
const noStoreHeaders = { "Cache-Control": "private, no-store" };

const getSearchCatalog = unstable_cache(
  async () => {
    const [videosResult, guidesResult] = await Promise.all([
      getPublishedContent({ kind: "video", limit: 100, timeoutMs: 20_000 }),
      getPublishedContent({ kind: "guide", limit: 100, timeoutMs: 20_000 }),
    ]);
    if (videosResult.status !== "ready" || guidesResult.status !== "ready") {
      throw new Error("search_catalog_unavailable");
    }

    const source = [...videosResult.catalog.items, ...guidesResult.catalog.items];
    return [...videosResult.catalog.items, ...getGuideCatalog(source)];
  },
  ["global-content-search-catalog-v1"],
  { revalidate: 30, tags: ["published-content"] },
);

function emptySearchResponse(query = "") {
  return { guides: [], query, videos: [] };
}

export async function GET(request: Request) {
  const current = await getCurrentUser();
  if (current.status !== "authenticated") {
    return NextResponse.json(
      { error: current.status === "unavailable" ? "search_unavailable" : "unauthorized" },
      { headers: noStoreHeaders, status: current.status === "unavailable" ? 503 : 401 },
    );
  }

  const requestedQuery = new URL(request.url).searchParams.get("query")?.trim() ?? "";
  const query = requestedQuery.slice(0, 120);
  if (!query) {
    return NextResponse.json(emptySearchResponse(), {
      headers: noStoreHeaders,
    });
  }

  try {
    const response = searchPublishedContent(await getSearchCatalog(), query);
    return NextResponse.json(response, {
      headers: noStoreHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "search_unavailable" },
      { headers: noStoreHeaders, status: 503 },
    );
  }
}
