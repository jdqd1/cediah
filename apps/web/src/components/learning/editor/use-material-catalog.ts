"use client";

import { useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LearningEditorResourceCatalogResponse } from "@cediah/contracts";
import { unwrapEditorReadResult } from "./editor-api";
import { useEditorTransport } from "./editor-query-provider";
import {
  editorQueryKeys,
  normalizeMaterialFilters,
  type EditorQueryScope,
  type MaterialFilters,
} from "./editor-query-keys";

const emptyFilters: MaterialFilters = { projection: "", q: "", topic: "" };

export function dedupeCatalogItems(pages: LearningEditorResourceCatalogResponse[]) {
  return [...new Map(pages.flatMap((page) => page.items).map((item) => [item.id, item])).values()];
}

export function useMaterialCatalog(input: {
  initialCatalog: LearningEditorResourceCatalogResponse;
  open: boolean;
  scope: EditorQueryScope;
  selectedProjection: "" | "flashcards" | "guide" | "quiz" | "video";
  selectedResourceId: string | null;
}) {
  const queryClient = useQueryClient();
  const transport = useEditorTransport();
  const [filterDraft, setFilterDraft] = useState<MaterialFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<MaterialFilters>(emptyFilters);
  const [initialData] = useState(() => ({
    pageParams: [null] as Array<string | null>,
    pages: [input.initialCatalog],
  }));
  const hasAppliedFilters = Boolean(appliedFilters.q || appliedFilters.projection || appliedFilters.topic);
  const catalogKey = editorQueryKeys.catalog(input.scope, appliedFilters);
  const catalog = useInfiniteQuery({
    enabled: input.open,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialData: hasAppliedFilters ? undefined : initialData,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => unwrapEditorReadResult(await transport.search({
      cursor: pageParam ?? undefined,
      limit: 24,
      projection: appliedFilters.projection || undefined,
      q: appliedFilters.q || undefined,
      topic: appliedFilters.topic || undefined,
    }, signal)),
    queryKey: catalogKey,
  });
  const resources = useMemo(() => dedupeCatalogItems(catalog.data?.pages ?? []), [catalog.data?.pages]);
  const selectedResource = resources.find((resource) => resource.id === input.selectedResourceId);
  const selectedProjection = input.selectedProjection || undefined;
  const detail = useQuery({
    enabled: input.open && Boolean(selectedResource && selectedProjection),
    queryFn: async ({ signal }) => unwrapEditorReadResult(await transport.currentDetail(
      selectedResource!.id,
      selectedProjection!,
      signal,
    )),
    queryKey: selectedResource && selectedProjection
      ? editorQueryKeys.currentDetail(
          input.scope,
          selectedResource.id,
          selectedProjection,
          selectedResource.version,
        )
      : [...input.scope, "current-material", "none"] as const,
  });

  return {
    appliedFilters,
    applyFilters() {
      setAppliedFilters(normalizeMaterialFilters(filterDraft));
    },
    cancel() {
      return queryClient.cancelQueries({ queryKey: input.scope });
    },
    catalog,
    clearFilters() {
      setFilterDraft(emptyFilters);
      setAppliedFilters(emptyFilters);
    },
    detail,
    filterDraft,
    resources,
    selectedResource,
    setFilterDraft,
  };
}
