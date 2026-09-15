import { NextResponse } from "next/server";
import { isContentSearchResponse } from "@/lib/content-search";
import { requestContentApi } from "@/lib/server/content-api";
import { getCurrentUser } from "@/lib/server/current-user";

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

  const response = await requestContentApi({
    cachePublic: false,
    method: "GET",
    path: `/v1/content/search?query=${encodeURIComponent(query)}`,
    timeoutMs: 8_000,
  });
  if (response.status !== 200 || !isContentSearchResponse(response.body)) {
    return NextResponse.json(
      { error: "search_unavailable" },
      { headers: noStoreHeaders, status: 503 },
    );
  }

  return NextResponse.json(response.body, {
    headers: noStoreHeaders,
  });
}
