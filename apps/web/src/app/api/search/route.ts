import type { ContentItem } from "@cediah/contracts";
import { NextResponse } from "next/server";
import { getGuideCatalog } from "@/lib/content-guide-links";
import {
  isContentSearchResponse,
  searchPublishedContent,
  type ContentSearchResponse,
} from "@/lib/content-search";
import { getPublishedContent, requestContentApi } from "@/lib/server/content-api";
import { getCurrentUser } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";
const noStoreHeaders = { "Cache-Control": "private, no-store" };
const searchSuccessHeaders = {
  "Cache-Control": "private, max-age=20, stale-while-revalidate=60",
};
const fallbackCatalogTtlMilliseconds = 30_000;
const indexedSearchTtlMilliseconds = 60_000;
const maxIndexedSearchCacheEntries = 120;

type FallbackCatalogCache = {
  expiresAt: number;
  items: ContentItem[];
};

type IndexedSearchCacheEntry = {
  expiresAt: number;
  response: ContentSearchResponse;
};

let fallbackCatalogCache: FallbackCatalogCache | null = null;
let fallbackCatalogRefresh: Promise<ContentItem[]> | null = null;
const indexedSearchCache = new Map<string, IndexedSearchCacheEntry>();
const indexedSearchInFlight = new Map<string, Promise<ContentSearchResponse | null>>();

function emptySearchResponse(query = "") {
  return { guides: [], query, videos: [] };
}

function normalizedCacheKey(query: string) {
  return query.trim().toLocaleLowerCase("es");
}

function cacheIndexedSearch(key: string, response: ContentSearchResponse) {
  indexedSearchCache.delete(key);
  indexedSearchCache.set(key, {
    expiresAt: Date.now() + indexedSearchTtlMilliseconds,
    response,
  });

  while (indexedSearchCache.size > maxIndexedSearchCacheEntries) {
    const oldest = indexedSearchCache.keys().next().value;
    if (typeof oldest !== "string") break;
    indexedSearchCache.delete(oldest);
  }
}

async function refreshFallbackCatalog() {
  const [videosResult, guidesResult] = await Promise.all([
    getPublishedContent({ cachePublic: true, kind: "video", limit: 100, timeoutMs: 20_000 }),
    getPublishedContent({ cachePublic: true, kind: "guide", limit: 100, timeoutMs: 20_000 }),
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

async function indexedSearch(query: string): Promise<ContentSearchResponse | null> {
  const key = normalizedCacheKey(query);
  const cached = indexedSearchCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    // Refresh recency so frequently reused searches stay hot.
    indexedSearchCache.delete(key);
    indexedSearchCache.set(key, cached);
    return cached.response;
  }
  if (cached) indexedSearchCache.delete(key);

  const pending = indexedSearchInFlight.get(key);
  if (pending) return pending;

  const request = (async () => {
    const response = await requestContentApi({
      // Search only touches published content, so the server-to-API request can
      // share Next's short public cache even though this BFF remains private.
      cachePublic: true,
      method: "GET",
      path: `/v1/content/search?query=${encodeURIComponent(query)}`,
      timeoutMs: 6_000,
    });
    if (response.status !== 200 || !isContentSearchResponse(response.body)) return null;
    cacheIndexedSearch(key, response.body);
    return response.body;
  })().finally(() => {
    indexedSearchInFlight.delete(key);
  });

  indexedSearchInFlight.set(key, request);
  return request;
}

export async function GET(request: Request) {
  const requestedQuery = new URL(request.url).searchParams.get("query")?.trim() ?? "";
  const query = requestedQuery.slice(0, 120);

  // Authentication and the public published-content lookup are independent.
  // Starting them together removes one full network round-trip from the
  // perceived search latency.
  const currentPromise = getCurrentUser();
  const indexedPromise = query ? indexedSearch(query) : Promise.resolve(null);
  const [current, indexed] = await Promise.all([currentPromise, indexedPromise]);

  if (current.status !== "authenticated") {
    return NextResponse.json(
      { error: current.status === "unavailable" ? "search_unavailable" : "unauthorized" },
      { headers: noStoreHeaders, status: current.status === "unavailable" ? 503 : 401 },
    );
  }

  if (!query) {
    return NextResponse.json(emptySearchResponse(), {
      headers: noStoreHeaders,
    });
  }

  if (indexed) {
    return NextResponse.json(indexed, {
      headers: searchSuccessHeaders,
    });
  }

  try {
    // Keep the previous bounded catalog search only as a rollout/outage fallback.
    // Normal traffic uses PostgreSQL FTS and is not limited to the newest 100 guides.
    return NextResponse.json(searchPublishedContent(await getFallbackCatalog(), query), {
      headers: searchSuccessHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "search_unavailable" },
      { headers: noStoreHeaders, status: 503 },
    );
  }
}
