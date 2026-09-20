export type EditorQueryScope = readonly ["route-editor", string, string];
export type MaterialFilters = {
  projection: "" | "flashcards" | "guide" | "quiz" | "video";
  q: string;
  topic: string;
};

export const editorQueryKeys = {
  catalog(scope: EditorQueryScope, filters: MaterialFilters) {
    return [...scope, "catalog", filters] as const;
  },
  currentDetail(
    scope: EditorQueryScope,
    sourceContentId: string,
    projection: Exclude<MaterialFilters["projection"], "">,
    expectedSourceVersion?: number,
  ) {
    return [...scope, "current-material", sourceContentId, projection, expectedSourceVersion ?? null] as const;
  },
  fixedDetail(scope: EditorQueryScope, optionId: string, resourceRevisionId: string) {
    return [...scope, "fixed-material", optionId, resourceRevisionId] as const;
  },
  scope(actorUserId: string, pathSessionId: string): EditorQueryScope {
    return ["route-editor", actorUserId, pathSessionId] as const;
  },
};

export function normalizeMaterialFilters(filters: MaterialFilters): MaterialFilters {
  return { ...filters, q: filters.q.trim() };
}
