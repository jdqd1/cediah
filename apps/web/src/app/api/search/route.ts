import type { ContentItem } from "@cediah/contracts";
import { NextResponse } from "next/server";
import { getGuideCatalog } from "@/lib/content-guide-links";
import { isContentSearchResponse, searchPublishedContent } from "@/lib/content-search";
import { getPublishedContent, requestContentApi } from "@/lib/server/content-api";
import { getCurrentUser } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";
const noStoreHeaders = { "Cache-Control": "private, no-store" };
const fallbackCatalogTtlMilliseconds = 30_000;

type FallbackCatalogCache = {
  expiresAt: number;
  items: ContentItem[];
};

let fallbackCatalogCache: FallbackCatalogCache | null = null;
let fallbackCatalogRefresh: Promise<ContentItem[]> | null = null;

function emptySearchResponse(query = "") {
  return { guides: [], query, videos: [] };
}

async function refreshFallbackCatalog() {
  const [videosResult, guidesResult] = await Promise.all([
    getPublishedContent({ cachePublic: false, kind: "video", limit: 100, timeoutMs: 20_000 }),
    getPublishedContent({ cachePublic: false, kind: "guide", limit: 100, timeoutMs: 20_000 }),
  ]);
  if (videosResult.status !== "ready" || guidesResult.status !== "ready") {
    throw new Error("fallback_search_catalog_unavailable");
  }

  const source = [...videosResult.catalog.items, ...guidesResult.catalog.items];
  const items = [...videosResult.catalog.items, ...getGuideCatalog(source)];
  fallbackCatalogCache = {
    expiresAt: Date.now() + fallbackCatalogTtlMilliseconds,
    items,
  };
  return items;
}

async function getFallbackCatalog() {
  if (fallbackCatalogCache && fallbackCatalogCache.expiresAt > Date.now()) {
    return fallbackCatalogCache.items;
  }

  fallbackCatalogRefresh ??= refreshFallbackCatalog().finally(() => {
    fallbackCatalogRefresh = null;
  });

  try {
    return await fallbackCatalogRefresh;
  } catch (error) {
    if (fallbackCatalogCache) return fallbackCatalogCache.items;
    throw error;
  }
}

async function indexedSearch(query: string) {
  const response = await requestContentApi({
    cachePublic: false,
    method: "GET",
    path: `/v1/content/search?query=${encodeURIComponent(query)}`,
    timeoutMs: 8_000,
  });
  return response.status === 200 && isContentSearchResponse(response.body)
    ? response.body
    : null;
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

  const indexed = await indexedSearch(query);
  if (indexed) {
    return NextResponse.json(indexed, {
      headers: noStoreHeaders,
    });
  }

  try {
    // Keep the previous bounded catalog search only as a rollout/outage fallback.
    // Normal traffic uses PostgreSQL FTS and is not limited to the newest 100 guides.
    return NextResponse.json(searchPublishedContent(await getFallbackCatalog(), query), {
      headers: noStoreHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "search_unavailable" },
      { headers: noStoreHeaders, status: 503 },
    );
  }
}
