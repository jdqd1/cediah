import "server-only";
import {
  GuideKnowledgeIndexSchema,
  type GuideKnowledgeIndex,
} from "@cediah/contracts";
import { requestContentApi } from "./content-api";

export type GuideKnowledgeResult =
  | { knowledge: GuideKnowledgeIndex; status: "ready" }
  | { status: "not_found" | "unavailable" };

export async function getGuideKnowledge(slug: string): Promise<GuideKnowledgeResult> {
  const response = await requestContentApi({
    method: "GET",
    path: "/v1/knowledge/guides/" + encodeURIComponent(slug),
    cachePublic: true,
  });
  if (response.status === 404) return { status: "not_found" };
  if (response.status !== 200) return { status: "unavailable" };

  const knowledge = GuideKnowledgeIndexSchema.safeParse(response.body);
  return knowledge.success
    ? { knowledge: knowledge.data, status: "ready" }
    : { status: "unavailable" };
}
