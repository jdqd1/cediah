import "server-only";
import { GuideTermManifestSchema, type GuideTermManifest } from "../guide-terms";
import { requestContentApi } from "./content-api";

export type PublishedGuideTermManifestResult =
  | { manifest: GuideTermManifest; status: "ready" }
  | { status: "not_found" | "unavailable" };

export async function getPublishedGuideTermManifest(
  slug: string,
): Promise<PublishedGuideTermManifestResult> {
  const response = await requestContentApi({
    cachePublic: true,
    method: "GET",
    path: "/v1/guide-terms/" + encodeURIComponent(slug),
    timeoutMs: 8_000,
  });
  if (response.status === 404) return { status: "not_found" };
  if (response.status !== 200) return { status: "unavailable" };
  const parsed = GuideTermManifestSchema.safeParse(response.body);
  return parsed.success
    ? { manifest: parsed.data, status: "ready" }
    : { status: "unavailable" };
}
