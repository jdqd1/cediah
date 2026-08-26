import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { getPublishedContent } from "@/lib/server/content-api";
import { searchPublishedContent } from "@/lib/content-search";

export const dynamic = "force-dynamic";
const noStoreHeaders = { "Cache-Control": "private, no-store" };

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

  const [videosResult, guidesResult] = await Promise.all([
    getPublishedContent({ kind: "video", limit: 100 }),
    getPublishedContent({ kind: "guide", limit: 100 }),
  ]);
  if (videosResult.status !== "ready" || guidesResult.status !== "ready") {
    return NextResponse.json(
      { error: "search_unavailable" },
      { headers: noStoreHeaders, status: 503 },
    );
  }

  const response = searchPublishedContent(
    [...videosResult.catalog.items, ...guidesResult.catalog.items],
    query,
  );
  return NextResponse.json(response, {
    headers: noStoreHeaders,
  });
}
