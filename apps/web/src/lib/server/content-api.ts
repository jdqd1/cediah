import "server-only";
import {
  ContentCatalogResponseSchema,
  ContentItemSchema,
  ContentWorkspaceResponseSchema,
  StudyCatalogResponseSchema,
  SubjectCatalogResponseSchema,
  SubjectDetailResponseSchema,
  SubjectStudyCatalogResponseSchema,
  type Subject,
  type SubjectDetailResponse,
  type ContentCatalogResponse,
  type ContentItem,
  type ContentKind,
  type ContentWorkspaceResponse,
  type StudyCatalogKind,
  type StudyCatalogResponse,
  type SubjectStudyCatalogResponse,
} from "@cediah/contracts";
import { summarizeContentItem } from "../study-catalog";
import { getServerEnvironment } from "./env";
import { getApiRequestCookie } from "./api-session";

type ContentApiRequest = {
  body?: unknown;
  cookie?: string;
  headers?: Record<string, string>;
  method: "DELETE" | "GET" | "PATCH" | "POST";
  path: string;
  cachePublic?: boolean;
  timeoutMs?: number;
};

type ContentApiResponse = {
  body: unknown;
  status: number;
};

export type PublishedContentResult =
  | { catalog: ContentCatalogResponse; status: "ready" }
  | { status: "unavailable" };

export type PublishedStudyCatalogResult =
  | { catalog: StudyCatalogResponse; status: "ready" }
  | { status: "unavailable" };

export type PublishedContentItemResult =
  | { item: ContentItem; status: "ready" }
  | { status: "not_found" | "unavailable" };

export type ContentWorkspaceResult =
  | { status: "forbidden" }
  | { status: "unavailable" }
  | { status: "ready"; workspace: ContentWorkspaceResponse };

export type SubjectsResult =
  | { status: "ready"; subjects: Subject[] }
  | { status: "unavailable" };

export type SubjectDetailResult =
  | { status: "not_found" | "unavailable" }
  | { status: "ready"; detail: SubjectDetailResponse };

export type SubjectStudyCatalogResult =
  | { status: "not_found" | "unavailable" }
  | { status: "ready"; detail: SubjectStudyCatalogResponse };

export function getContentApiError(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }

  return "content_unavailable";
}

export function safeContentApiStatus(status: number) {
  return [400, 401, 403, 404, 409, 413, 503].includes(status) ? status : 503;
}

export async function requestContentApi(
  input: ContentApiRequest,
): Promise<ContentApiResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 6_000);

  try {
    const environment = getServerEnvironment();
    const headers = new Headers({ Accept: "application/json" });
    if (input.cookie) headers.set("Cookie", input.cookie);
    if (input.body !== undefined) headers.set("Content-Type", "application/json");
    for (const [name, value] of Object.entries(input.headers ?? {})) headers.set(name, value);

    const publicCache = input.cachePublic === true && input.method === "GET" && !input.cookie;
    const response = await fetch(new URL(input.path, environment.API_BASE_URL), {
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
      cache: publicCache ? "force-cache" : "no-store",
      ...(publicCache ? { next: { revalidate: 30, tags: ["published-content"] } } : {}),
      headers,
      method: input.method,
      signal: controller.signal,
    });
    const body: unknown = await response
      .json()
      .catch(() => ({ error: "content_unavailable" }));
    return { body, status: response.status };
  } catch {
    return { body: { error: "content_unavailable" }, status: 503 };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getPublishedContent(input: {
  cachePublic?: boolean;
  kind?: ContentKind;
  linkedVideoId?: string;
  limit?: number;
  subjectId?: string;
  sort?: "recent" | "views";
  timeoutMs?: number;
} = {}): Promise<PublishedContentResult> {
  const query = new URLSearchParams();
  if (input.kind) query.set("kind", input.kind);
  if (input.linkedVideoId) query.set("linkedVideoId", input.linkedVideoId);
  if (input.subjectId) query.set("subjectId", input.subjectId);
  if (input.sort) query.set("sort", input.sort);
  query.set("limit", String(input.limit ?? 40));
  const response = await requestContentApi({
    method: "GET",
    path: "/v1/content?" + query.toString(),
    cachePublic: input.cachePublic ?? true,
    timeoutMs: input.timeoutMs,
  });
  if (response.status !== 200) return { status: "unavailable" };

  const catalog = ContentCatalogResponseSchema.safeParse(response.body);
  return catalog.success
    ? { catalog: catalog.data, status: "ready" }
    : { status: "unavailable" };
}

export async function getPublishedStudyCatalog(input: {
  kind?: StudyCatalogKind;
  limit?: number;
  sort?: "recent" | "views";
  timeoutMs?: number;
} = {}): Promise<PublishedStudyCatalogResult> {
  const query = new URLSearchParams();
  if (input.kind) query.set("kind", input.kind);
  if (input.sort) query.set("sort", input.sort);
  query.set("limit", String(input.limit ?? 500));
  const response = await requestContentApi({
    method: "GET",
    path: "/v1/study/catalog?" + query.toString(),
    cachePublic: true,
    timeoutMs: input.timeoutMs ?? 8_000,
  });
  if (response.status === 200) {
    const catalog = StudyCatalogResponseSchema.safeParse(response.body);
    if (catalog.success) return { catalog: catalog.data, status: "ready" };
  }

  // Keep the site usable while Render and Vercel roll out independently.
  // The legacy path is intentionally only a fallback because it carries full documents.
  const legacy = await getPublishedContent({
    kind: input.kind,
    limit: Math.min(input.limit ?? 100, 100),
    sort: input.sort,
    timeoutMs: 20_000,
  });
  return legacy.status === "ready"
    ? { catalog: { items: legacy.catalog.items.map(summarizeContentItem) }, status: "ready" }
    : { status: "unavailable" };
}

export async function getSubjects(): Promise<SubjectsResult> {
  const response = await requestContentApi({ method: "GET", path: "/v1/subjects", cachePublic: true });
  if (response.status !== 200) return { status: "unavailable" };
  const parsed = SubjectCatalogResponseSchema.safeParse(response.body);
  return parsed.success ? { status: "ready", subjects: parsed.data.subjects } : { status: "unavailable" };
}

export async function getSubjectContent(slug: string): Promise<SubjectDetailResult> {
  const response = await requestContentApi({
    method: "GET",
    path: "/v1/subjects/" + encodeURIComponent(slug),
    cachePublic: true,
    // This legacy route still includes complete content documents. New list
    // screens use getSubjectStudyCatalog instead.
    timeoutMs: 20_000,
  });
  if (response.status === 404) return { status: "not_found" };
  if (response.status !== 200) return { status: "unavailable" };
  const detail = SubjectDetailResponseSchema.safeParse(response.body);
  return detail.success ? { status: "ready", detail: detail.data } : { status: "unavailable" };
}

export async function getSubjectStudyCatalog(slug: string): Promise<SubjectStudyCatalogResult> {
  const response = await requestContentApi({
    method: "GET",
    path: "/v1/study/subjects/" + encodeURIComponent(slug),
    cachePublic: true,
    timeoutMs: 8_000,
  });
  if (response.status === 404) return { status: "not_found" };
  if (response.status === 200) {
    const detail = SubjectStudyCatalogResponseSchema.safeParse(response.body);
    if (detail.success) return { status: "ready", detail: detail.data };
  }

  // Deployment-order fallback. Once the API route is live this path is not used.
  const [legacySubject, legacyGuides] = await Promise.all([
    getSubjectContent(slug),
    getPublishedContent({ kind: "guide", limit: 100, timeoutMs: 20_000 }),
  ]);
  if (legacySubject.status !== "ready") return legacySubject;

  const items = legacySubject.detail.items.map(summarizeContentItem);
  const videoIds = new Set(items.filter((item) => item.kind === "video").map((item) => item.id));
  const byId = new Map(items.map((item) => [item.id, item]));
  if (legacyGuides.status === "ready" && videoIds.size > 0) {
    for (const guide of legacyGuides.catalog.items.map(summarizeContentItem)) {
      if (guide.linkedVideoId && videoIds.has(guide.linkedVideoId)) byId.set(guide.id, guide);
    }
  }

  return {
    status: "ready",
    detail: {
      items: [...byId.values()],
      subject: legacySubject.detail.subject,
    },
  };
}

export async function getPublishedContentItem(
  slug: string,
): Promise<PublishedContentItemResult> {
  const response = await requestContentApi({
    method: "GET",
    path: "/v1/content/" + encodeURIComponent(slug),
    cachePublic: true,
  });
  if (response.status === 404) return { status: "not_found" };
  if (response.status !== 200) return { status: "unavailable" };

  const item = ContentItemSchema.safeParse(response.body);
  return item.success
    ? { item: item.data, status: "ready" }
    : { status: "unavailable" };
}

export async function getContentWorkspace(): Promise<ContentWorkspaceResult> {
  const session = await getApiRequestCookie();
  if (session.status === "anonymous") return { status: "forbidden" };
  const response = await requestContentApi({
    cookie: session.cookie,
    method: "GET",
    path: "/v1/editor/content",
    // The editorial workspace can legitimately include many rich guide documents.
    // Give cold API/database starts enough time while the backend keeps this path no-store.
    timeoutMs: 20_000,
  });
  if (response.status === 403) return { status: "forbidden" };
  if (response.status !== 200) return { status: "unavailable" };

  const workspace = ContentWorkspaceResponseSchema.safeParse(response.body);
  return workspace.success
    ? { status: "ready", workspace: workspace.data }
    : { status: "unavailable" };
}
