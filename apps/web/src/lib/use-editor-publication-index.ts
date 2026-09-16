"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ContentEditorIndexPageSchema,
  ContentWorkspaceResponseSchema,
  type ContentItem,
  type ContentKind,
  type ContentStatus,
  type ContentWorkspaceResponse,
} from "@cediah/contracts";
import { getIndependentPublications } from "./content-guide-links";

type PublicationFilters = {
  kind: "all" | ContentKind;
  query: string;
  status: "all" | ContentStatus;
};

type RemoteIndexState = {
  index: {
    nextCursor: string | null;
    totalItems: number;
    totalPublications: number;
  };
  items: ContentItem[];
  key: string;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");
}

function filterLocal(items: readonly ContentItem[], filters: PublicationFilters) {
  const text = normalizeSearch(filters.query.trim());
  return getIndependentPublications(items)
    .filter((current) => {
      const regions = current.content.regions.length > 0
        ? current.content.regions
        : [current.topic];
      const haystack = normalizeSearch(
        `${current.title} ${current.summary} ${current.topic} ${regions.join(" ")} ${current.slug}`,
      );
      return (
        (!text || haystack.includes(text)) &&
        (filters.kind === "all" || current.kind === filters.kind) &&
        (filters.status === "all" || current.status === filters.status)
      );
    })
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function publicationFilterKey(filters: PublicationFilters) {
  return JSON.stringify([
    filters.query.trim(),
    filters.kind,
    filters.status,
  ]);
}

function corpusVersion(items: readonly ContentItem[]) {
  let latest = 0;
  for (const item of items) {
    latest = Math.max(latest, new Date(item.updatedAt).getTime());
  }
  return `${items.length}:${latest}`;
}

async function requestPublicationPage(
  filters: PublicationFilters,
  cursor: string | null,
  signal?: AbortSignal,
) {
  const filtersActive = Boolean(
    filters.query.trim() || filters.kind !== "all" || filters.status !== "all",
  );
  const params = new URLSearchParams({
    includeWorkspace: "0",
    limit: String(filtersActive ? 100 : 500),
    scope: "publications",
  });
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.kind !== "all") params.set("kind", filters.kind);
  if (filters.status !== "all") params.set("status", filters.status);
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(`/api/editor/content-index?${params.toString()}`, {
    cache: "no-store",
    signal,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error("No se pudo actualizar el índice editorial.");

  const page = ContentEditorIndexPageSchema.safeParse(body);
  if (page.success) return page.data;

  // Deployment-order compatibility: an older API may still answer with the
  // complete workspace shape while Render and Vercel finish rolling out.
  const workspace = ContentWorkspaceResponseSchema.safeParse(body);
  if (workspace.success) {
    const items = filterLocal(workspace.data.items, filters);
    return {
      index: workspace.data.index ?? {
        nextCursor: null,
        totalItems: items.length,
        totalPublications: items.length,
      },
      items,
    };
  }

  throw new Error("El servidor devolvió un índice editorial no válido.");
}

export function useEditorPublicationIndex(input: {
  initialWorkspace: ContentWorkspaceResponse;
  items: ContentItem[];
  kindFilter: "all" | ContentKind;
  query: string;
  statusFilter: "all" | ContentStatus;
}) {
  const filters = useMemo<PublicationFilters>(() => ({
    kind: input.kindFilter,
    query: input.query,
    status: input.statusFilter,
  }), [input.kindFilter, input.query, input.statusFilter]);
  const key = publicationFilterKey(filters);
  const localItems = useMemo(
    () => filterLocal(input.items, filters),
    [filters, input.items],
  );
  const version = corpusVersion(input.items);
  const filtersActive = Boolean(
    filters.query.trim() || filters.kind !== "all" || filters.status !== "all",
  );
  const legacyMayBeTruncated = !input.initialWorkspace.index && input.initialWorkspace.items.length >= 200;
  const initialMayBeTruncated = Boolean(input.initialWorkspace.index?.nextCursor);
  const remoteRequired = filtersActive || legacyMayBeTruncated || initialMayBeTruncated;

  const [remote, setRemote] = useState<RemoteIndexState | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!remoteRequired) {
      setRemote(null);
      setLoadingKey(null);
      setLoadingMore(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const delay = filtersActive ? 180 : 0;
    setLoadingKey(key);
    setError(null);
    const timer = window.setTimeout(() => {
      void requestPublicationPage(filters, null, controller.signal)
        .then((page) => {
          if (controller.signal.aborted) return;
          setRemote({ index: page.index, items: page.items, key });
        })
        .catch((requestError: unknown) => {
          if (controller.signal.aborted) return;
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No se pudo cargar la lista completa de publicaciones.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoadingKey(null);
        });
    }, delay);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [filters, filtersActive, key, remoteRequired, version]);

  const remoteReady = remoteRequired && remote?.key === key;
  const visibleItems = remoteReady ? remote.items : localItems;
  const publicationCount = remoteReady
    ? remote.index.totalPublications
    : localItems.length;
  const hasMorePublications = Boolean(remoteReady && remote.index.nextCursor);
  const publicationIndexBusy = loadingKey === key || loadingMore;

  const loadMorePublications = useCallback(async () => {
    if (!remoteReady || !remote.index.nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await requestPublicationPage(filters, remote.index.nextCursor);
      setRemote((current) => {
        if (!current || current.key !== key) return current;
        const seen = new Set(current.items.map((item) => item.id));
        const items = [...current.items];
        for (const item of page.items) {
          if (!seen.has(item.id)) items.push(item);
        }
        return { index: page.index, items, key };
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudieron cargar más publicaciones.",
      );
    } finally {
      setLoadingMore(false);
    }
  }, [filters, key, loadingMore, remote, remoteReady]);

  return {
    hasMorePublications,
    loadMorePublications,
    publicationCount,
    publicationIndexBusy,
    publicationIndexError: error,
    visibleItems,
  };
}
