import "server-only";
import {
  ContentCatalogResponseSchema,
  ContentItemSchema,
  ContentWorkspaceResponseSchema,
  SubjectCatalogResponseSchema,
  SubjectDetailResponseSchema,
  type Subject,
  type SubjectDetailResponse,
  type ContentCatalogResponse,
  type ContentItem,
  type ContentKind,
  type ContentWorkspaceResponse,
} from "@cediah/contracts";
import { getServerEnvironment } from "./env";
import { getApiRequestCookie } from "./api-session";

type ContentApiRequest = {
  body?: unknown;
  cookie?: string;
  method: "DELETE" | "GET" | "PATCH" | "POST";
  path: string;
};

type ContentApiResponse = {
  body: unknown;
  status: number;
};

export type PublishedContentResult =
  | { catalog: ContentCatalogResponse; status: "ready" }
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
  const timeout = setTimeout(() => controller.abort(), 6_000);

  try {
    const environment = getServerEnvironment();
    const headers = new Headers({ Accept: "application/json" });
    if (input.cookie) headers.set("Cookie", input.cookie);
    if (input.body !== undefined) headers.set("Content-Type", "application/json");

    const response = await fetch(new URL(input.path, environment.API_BASE_URL), {
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
      cache: "no-store",
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
  kind?: ContentKind;
  linkedVideoId?: string;
  limit?: number;
  subjectId?: string;
} = {}): Promise<PublishedContentResult> {
  const query = new URLSearchParams();
  if (input.kind) query.set("kind", input.kind);
  if (input.linkedVideoId) query.set("linkedVideoId", input.linkedVideoId);
  if (input.subjectId) query.set("subjectId", input.subjectId);
  query.set("limit", String(input.limit ?? 40));
  const response = await requestContentApi({
    method: "GET",
    path: "/v1/content?" + query.toString(),
  });
  if (response.status !== 200) return { status: "unavailable" };

  const catalog = ContentCatalogResponseSchema.safeParse(response.body);
  return catalog.success
    ? { catalog: catalog.data, status: "ready" }
    : { status: "unavailable" };
}
export async function getSubjects(): Promise<SubjectsResult> {
  const response = await requestContentApi({ method: "GET", path: "/v1/subjects" });
  if (response.status !== 200) return { status: "unavailable" };
  const parsed = SubjectCatalogResponseSchema.safeParse(response.body);
  return parsed.success ? { status: "ready", subjects: parsed.data.subjects } : { status: "unavailable" };
}

export async function getSubjectContent(slug: string): Promise<SubjectDetailResult> {
  const response = await requestContentApi({
    method: "GET",
    path: "/v1/subjects/" + encodeURIComponent(slug),
  });
  if (response.status === 404) return { status: "not_found" };
  if (response.status !== 200) return { status: "unavailable" };
  const detail = SubjectDetailResponseSchema.safeParse(response.body);
  return detail.success ? { status: "ready", detail: detail.data } : { status: "unavailable" };
}
export async function getPublishedContentItem(
  slug: string,
): Promise<PublishedContentItemResult> {
  const response = await requestContentApi({
    method: "GET",
    path: "/v1/content/" + encodeURIComponent(slug),
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
  });
  if (response.status === 403) return { status: "forbidden" };
  if (response.status !== 200) return { status: "unavailable" };

  const workspace = ContentWorkspaceResponseSchema.safeParse(response.body);
  return workspace.success
    ? { status: "ready", workspace: workspace.data }
    : { status: "unavailable" };
}
