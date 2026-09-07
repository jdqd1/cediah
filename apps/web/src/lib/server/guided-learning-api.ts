import "server-only";
import {
  LearningAttemptSchema,
  LearningEditorPathListResponseSchema,
  LearningEditorResourceCatalogResponseSchema,
  LearningEnrollmentProgressSchema,
  LearningEnrollmentUpgradePreviewResponseSchema,
  LearningHomeSchema,
  LearningLibraryOptionsResponseSchema,
  LearningPathCatalogResponseSchema,
  LearningPathDetailSchema,
  type LearningAttempt,
  type LearningEnrollmentProgress,
  type LearningEnrollmentUpgradePreviewResponse,
  type LearningEditorResourceCatalogResponse,
  type LearningHome,
  type LearningLibraryOption,
  type LearningPathCard,
  type LearningPathDetail,
} from "@cediah/contracts";
import { getApiRequestCookie } from "./api-session";
import { requestContentApi } from "./content-api";

export type LearningCatalogResult =
  | { items: LearningPathCard[]; nextCursor: string | null; status: "ready" }
  | { status: "unauthorized" | "unavailable" };
export type LearningPathResult =
  | { path: LearningPathDetail; status: "ready" }
  | { status: "not_found" | "unauthorized" | "unavailable" };
export type LearningEditorWorkspaceResult =
  | { items: LearningPathDetail[]; status: "ready" }
  | { status: "forbidden" | "unauthorized" | "unavailable" };
export type LearningEditorResourceResult =
  | ({ status: "ready" } & LearningEditorResourceCatalogResponse)
  | { status: "forbidden" | "unauthorized" | "unavailable" };
export type LearningUpgradePreviewResult =
  | ({ status: "ready" } & LearningEnrollmentUpgradePreviewResponse)
  | { status: "not_found" | "unauthorized" | "unavailable" };
export type LearningAttemptResult =
  | { attempt: LearningAttempt; status: "ready" }
  | { status: "not_found" | "unauthorized" | "unavailable" };
export type LearningProgressResult =
  | { progress: LearningEnrollmentProgress; status: "ready" }
  | { status: "not_found" | "unauthorized" | "unavailable" };
export type LearningLibraryOptionsResult =
  | { items: LearningLibraryOption[]; status: "ready" }
  | { status: "unauthorized" | "unavailable" };
export type LearningHomeResult =
  | { home: LearningHome; status: "ready" }
  | { status: "unauthorized" | "unavailable" };

async function sessionRequest(path: string) {
  const session = await getApiRequestCookie();
  if (session.status === "anonymous") return { body: null, status: 401 };
  return requestContentApi({ cookie: session.cookie, method: "GET", path });
}

export async function getLearningPaths(): Promise<LearningCatalogResult> {
  const response = await sessionRequest("/v1/guided-learning/paths?limit=20");
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status !== 200) return { status: "unavailable" };
  const parsed = LearningPathCatalogResponseSchema.safeParse(response.body);
  return parsed.success
    ? { ...parsed.data, status: "ready" }
    : { status: "unavailable" };
}

export async function getLearningHome(minutes?: 5 | 10 | 20): Promise<LearningHomeResult> {
  const suffix = minutes ? `?minutes=${minutes}` : "";
  const response = await sessionRequest(`/v1/guided-learning/home${suffix}`);
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status !== 200) return { status: "unavailable" };
  const parsed = LearningHomeSchema.safeParse(response.body);
  return parsed.success ? { home: parsed.data, status: "ready" } : { status: "unavailable" };
}

export async function getLearningPath(slug: string): Promise<LearningPathResult> {
  const response = await sessionRequest(`/v1/guided-learning/paths/${encodeURIComponent(slug)}`);
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 404) return { status: "not_found" };
  if (response.status !== 200) return { status: "unavailable" };
  const parsed = LearningPathDetailSchema.safeParse(response.body);
  return parsed.success
    ? { path: parsed.data, status: "ready" }
    : { status: "unavailable" };
}

export async function getLearningAttempt(attemptId: string): Promise<LearningAttemptResult> {
  const response = await sessionRequest(`/v1/guided-learning/attempts/${encodeURIComponent(attemptId)}`);
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 404) return { status: "not_found" };
  if (response.status !== 200) return { status: "unavailable" };
  const parsed = LearningAttemptSchema.safeParse(response.body);
  return parsed.success ? { attempt: parsed.data, status: "ready" } : { status: "unavailable" };
}

export async function getLearningProgress(enrollmentId: string): Promise<LearningProgressResult> {
  const response = await sessionRequest(`/v1/guided-learning/enrollments/${encodeURIComponent(enrollmentId)}/progress`);
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 404) return { status: "not_found" };
  if (response.status !== 200) return { status: "unavailable" };
  const parsed = LearningEnrollmentProgressSchema.safeParse(response.body);
  return parsed.success ? { progress: parsed.data, status: "ready" } : { status: "unavailable" };
}

export async function getLearningUpgradePreview(
  enrollmentId: string,
): Promise<LearningUpgradePreviewResult> {
  const response = await sessionRequest(
    `/v1/guided-learning/enrollments/${encodeURIComponent(enrollmentId)}/upgrade-preview`,
  );
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 404) return { status: "not_found" };
  if (response.status !== 200) return { status: "unavailable" };
  const parsed = LearningEnrollmentUpgradePreviewResponseSchema.safeParse(response.body);
  return parsed.success ? { ...parsed.data, status: "ready" } : { status: "unavailable" };
}

export async function getLearningLibraryOptions(
  sourceContentId: string,
  projection: "flashcards" | "guide" | "quiz" | "video",
): Promise<LearningLibraryOptionsResult> {
  const query = new URLSearchParams({ projection, sourceContentId });
  const response = await sessionRequest(`/v1/guided-learning/library/options?${query.toString()}`);
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status !== 200) return { status: "unavailable" };
  const parsed = LearningLibraryOptionsResponseSchema.safeParse(response.body);
  return parsed.success ? { items: parsed.data.items, status: "ready" } : { status: "unavailable" };
}

export async function getLearningEditorWorkspace(): Promise<LearningEditorWorkspaceResult> {
  const response = await sessionRequest("/v1/editor/learning-paths");
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 403) return { status: "forbidden" };
  if (response.status !== 200) return { status: "unavailable" };
  const parsed = LearningEditorPathListResponseSchema.safeParse(response.body);
  return parsed.success
    ? { items: parsed.data.items, status: "ready" }
    : { status: "unavailable" };
}

export async function getLearningEditorPath(pathId: string): Promise<LearningPathResult> {
  const response = await sessionRequest(`/v1/editor/learning-paths/${encodeURIComponent(pathId)}`);
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 404) return { status: "not_found" };
  if (response.status !== 200) return { status: "unavailable" };
  const parsed = LearningPathDetailSchema.safeParse(response.body);
  return parsed.success ? { path: parsed.data, status: "ready" } : { status: "unavailable" };
}

export async function getLearningEditorResources(input: {
  cursor?: string;
  limit?: number;
  projection?: "flashcards" | "guide" | "quiz" | "video";
  q?: string;
  topic?: string;
} = {}): Promise<LearningEditorResourceResult> {
  const query = new URLSearchParams({ limit: String(input.limit ?? 24) });
  if (input.cursor) query.set("cursor", input.cursor);
  if (input.projection) query.set("projection", input.projection);
  if (input.q) query.set("q", input.q);
  if (input.topic) query.set("topic", input.topic);
  const response = await sessionRequest(`/v1/editor/learning-resources?${query.toString()}`);
  if (response.status === 401) return { status: "unauthorized" };
  if (response.status === 403) return { status: "forbidden" };
  if (response.status !== 200) return { status: "unavailable" };
  const parsed = LearningEditorResourceCatalogResponseSchema.safeParse(response.body);
  return parsed.success ? { ...parsed.data, status: "ready" } : { status: "unavailable" };
}
