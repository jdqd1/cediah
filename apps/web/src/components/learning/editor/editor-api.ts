import { z } from "zod";
import {
  LearningEditorMaterialDetailSchema,
  LearningEditorResourceCatalogResponseSchema,
  LearningPathDetailSchema,
  LearningPathValidationIssueSchema,
  LearningPathValidationResponseSchema,
  type LearningEditorMaterialDetail,
  type LearningEditorResourceCatalogResponse,
  type LearningPathCreateRequest,
  type LearningPathDetail,
  type LearningPathUpdateRequest,
  type LearningPathValidationResponse,
} from "@cediah/contracts";

const EditorErrorSchema = z.object({
  error: z.string().trim().min(1).max(120),
  fieldErrors: z.array(z.strictObject({
    code: z.string().trim().min(1).max(80),
    path: z.string().max(500),
  })).max(200).optional(),
  issues: z.array(LearningPathValidationIssueSchema).max(5_000).optional(),
});

export type EditorHttpStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 503;
export type EditorApiFailure = {
  errorCode: string;
  fieldErrors?: Array<{ code: string; path: string }>;
  issues?: z.infer<typeof LearningPathValidationIssueSchema>[];
  ok: false;
  status: EditorHttpStatus;
};
export type EditorApiResult<T> = { ok: true; status: number; value: T } | EditorApiFailure;

export class EditorQueryError extends Error {
  readonly errorCode: string;
  readonly status: EditorHttpStatus;

  constructor(failure: EditorApiFailure) {
    super("No se pudo completar la lectura del editor.");
    this.name = "EditorQueryError";
    this.errorCode = failure.errorCode;
    this.status = failure.status;
  }
}

export function unwrapEditorReadResult<T>(result: EditorApiResult<T>): T {
  if (result.ok) return result.value;
  throw new EditorQueryError(result);
}

type EditorFetch = typeof fetch;
type Projection = "flashcards" | "guide" | "quiz" | "video";
type SearchInput = {
  cursor?: string;
  limit?: number;
  projection?: Projection;
  q?: string;
  topic?: string;
};

const safeStatus = (status: number): EditorHttpStatus => (
  [400, 401, 403, 404, 409, 422, 429, 503].includes(status)
    ? status as EditorHttpStatus
    : 503
);

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function createEditorApi(fetcher: EditorFetch = fetch) {
  async function request<T>(input: {
    body?: unknown;
    method?: "GET" | "PATCH" | "POST";
    path: string;
    schema: z.ZodType<T>;
    signal?: AbortSignal;
  }): Promise<EditorApiResult<T>> {
    let response: Response;
    try {
      response = await fetcher(input.path, {
        ...(input.body === undefined ? {} : {
          body: JSON.stringify(input.body),
          headers: { "Content-Type": "application/json" },
        }),
        method: input.method ?? "GET",
        signal: input.signal,
      });
    } catch (error) {
      if (input.signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
      return { errorCode: "network_error", ok: false, status: 503 };
    }

    const body = await readJson(response);
    if (!response.ok) {
      const parsed = EditorErrorSchema.safeParse(body);
      return parsed.success
        ? {
            errorCode: parsed.data.error,
            fieldErrors: parsed.data.fieldErrors,
            issues: parsed.data.issues,
            ok: false,
            status: safeStatus(response.status),
          }
        : { errorCode: "invalid_response", ok: false, status: safeStatus(response.status) };
    }
    const parsed = input.schema.safeParse(body);
    return parsed.success
      ? { ok: true, status: response.status, value: parsed.data }
      : { errorCode: "invalid_response", ok: false, status: 503 };
  }

  return {
    create(draft: LearningPathCreateRequest) {
      return request({ body: draft, method: "POST", path: "/api/editor/learning-paths", schema: LearningPathDetailSchema });
    },
    createVersion(pathId: string, releaseNotes: string) {
      return request({
        body: { releaseNotes },
        method: "POST",
        path: `/api/editor/learning-paths/${encodeURIComponent(pathId)}/versions`,
        schema: LearningPathDetailSchema,
      });
    },
    currentDetail(sourceContentId: string, projection: Projection, signal?: AbortSignal) {
      const query = new URLSearchParams({ projection });
      return request({
        path: `/api/editor/learning-resources/${encodeURIComponent(sourceContentId)}?${query.toString()}`,
        schema: LearningEditorMaterialDetailSchema,
        signal,
      });
    },
    fixedDetail(pathId: string, optionId: string, signal?: AbortSignal) {
      return request({
        path: `/api/editor/learning-paths/${encodeURIComponent(pathId)}/materials/${encodeURIComponent(optionId)}`,
        schema: LearningEditorMaterialDetailSchema,
        signal,
      });
    },
    save(pathId: string, update: LearningPathUpdateRequest) {
      return request({
        body: update,
        method: "PATCH",
        path: `/api/editor/learning-paths/${encodeURIComponent(pathId)}`,
        schema: LearningPathDetailSchema,
      });
    },
    search(input: SearchInput = {}, signal?: AbortSignal) {
      const query = new URLSearchParams({ limit: String(input.limit ?? 24) });
      if (input.cursor) query.set("cursor", input.cursor);
      if (input.projection) query.set("projection", input.projection);
      if (input.q) query.set("q", input.q);
      if (input.topic) query.set("topic", input.topic);
      return request({
        path: `/api/editor/learning-resources?${query.toString()}`,
        schema: LearningEditorResourceCatalogResponseSchema,
        signal,
      });
    },
    transition(
      pathId: string,
      expectedVersion: number,
      status: "approved" | "archived" | "changes_requested" | "in_review" | "published",
    ) {
      return request({
        body: { expectedVersion, status },
        method: "POST",
        path: `/api/editor/learning-paths/${encodeURIComponent(pathId)}/transition`,
        schema: LearningPathDetailSchema,
      });
    },
    validate(pathId: string, expectedVersion: number) {
      return request({
        body: { expectedVersion },
        method: "POST",
        path: `/api/editor/learning-paths/${encodeURIComponent(pathId)}/validate`,
        schema: LearningPathValidationResponseSchema,
      });
    },
  };
}

export type EditorApi = ReturnType<typeof createEditorApi>;
export type EditorCreateResult = EditorApiResult<LearningPathDetail>;
export type EditorMaterialDetailResult = EditorApiResult<LearningEditorMaterialDetail>;
export type EditorResourceCatalogResult = EditorApiResult<LearningEditorResourceCatalogResponse>;
export type EditorValidationResult = EditorApiResult<LearningPathValidationResponse>;

export const editorApi = createEditorApi();
