"use client";

import {
  ArrowRight,
  BookOpen,
  CircleNotch,
  MagnifyingGlass,
  PlayCircle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import {
  getSearchMatchRanges,
  isContentSearchResponse,
  type ContentSearchResponse,
  type ContentSearchResult,
} from "@/lib/content-search";

const emptyResponse: ContentSearchResponse = { guides: [], query: "", videos: [] };

function HighlightedText({ query, value }: { query: string; value: string }) {
  const ranges = getSearchMatchRanges(value, query);
  if (ranges.length === 0) return value;

  const parts: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((range, index) => {
    if (range.start > cursor) parts.push(value.slice(cursor, range.start));
    parts.push(
      <mark className="content-search-match" key={`${range.start}-${range.end}-${index}`}>
        {value.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  });
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts;
}

function resultCountLabel(count: number) {
  return count === 1 ? "1 resultado" : `${count} resultados`;
}

function SearchResultItem({
  onNavigate,
  query,
  result,
}: {
  onNavigate: () => void;
  query: string;
  result: ContentSearchResult;
}) {
  const contentTypeLabel = result.kind === "guide" ? "Guía" : "Video";
  return (
    <li>
      <Link
        aria-label={`${contentTypeLabel}: ${result.title}`}
        className="global-search-result"
        href={result.href}
        onClick={onNavigate}
      >
        <span className={`global-search-result-icon is-${result.kind}`} aria-hidden="true">
          {result.kind === "guide" ? <BookOpen size={18} /> : <PlayCircle size={18} weight="fill" />}
        </span>
        <span className="global-search-result-copy">
          <strong><HighlightedText query={query} value={result.title} /></strong>
          <span className={`global-search-result-excerpt is-${result.excerptType}`}>
            <HighlightedText query={query} value={result.excerpt} />
          </span>
        </span>
        <ArrowRight aria-hidden="true" size={17} />
      </Link>
    </li>
  );
}

function SearchSection({
  icon,
  label,
  onNavigate,
  query,
  results,
}: {
  icon: ReactNode;
  label: string;
  onNavigate: () => void;
  query: string;
  results: ContentSearchResult[];
}) {
  if (results.length === 0) return null;

  return (
    <section
      className="global-search-section"
      aria-label={label}
      data-search-section={label.toLocaleLowerCase("es")}
    >
      <header className="global-search-section-heading">
        <span className="global-search-section-icon" aria-hidden="true">{icon}</span>
        <strong>{label}</strong>
        <span>{resultCountLabel(results.length)}</span>
      </header>
      <ul className="global-search-results">
        {results.slice(0, 4).map((result) => (
          <SearchResultItem key={result.id} onNavigate={onNavigate} query={query} result={result} />
        ))}
      </ul>
    </section>
  );
}

export function GlobalContentSearch() {
  const [error, setError] = useState(false);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<ContentSearchResponse>(emptyResponse);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasQuery = query.trim().length > 0;
  const panelOpen = focused;

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setFocused(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const result = await fetch(`/api/search?query=${encodeURIComponent(normalizedQuery)}`, {
          signal: controller.signal,
        });
        const payload: unknown = await result.json();
        if (!result.ok || !isContentSearchResponse(payload)) throw new Error("Search request failed");
        setResponse(payload);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(true);
        setResponse({ guides: [], query: normalizedQuery, videos: [] });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function updateQuery(nextQuery: string) {
    const normalizedQuery = nextQuery.trim();
    setQuery(nextQuery);
    setError(false);
    setLoading(Boolean(normalizedQuery));
    setResponse(normalizedQuery ? { guides: [], query: normalizedQuery, videos: [] } : emptyResponse);
  }

  function clearSearch() {
    updateQuery("");
    inputRef.current?.focus();
  }

  function closeSearch() {
    setFocused(false);
    updateQuery("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <div className="global-content-search" ref={containerRef}>
      <form
        aria-label="Buscar videos y guías"
        className="global-content-search-form"
        onSubmit={handleSubmit}
        role="search"
      >
        <MagnifyingGlass aria-hidden="true" className="global-content-search-icon" size={19} />
        <input
          aria-controls="global-content-search-panel"
          aria-expanded={panelOpen}
          aria-haspopup="dialog"
          aria-label="Buscar videos y guías"
          aria-autocomplete="list"
          autoComplete="off"
          onChange={(event) => updateQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setFocused(false);
              inputRef.current?.blur();
            }
          }}
          placeholder="Buscar videos y guías"
          ref={inputRef}
          role="combobox"
          type="search"
          value={query}
        />
        {loading && (
          <span aria-label="Buscando" className="global-content-search-spinner" role="status">
            <CircleNotch aria-hidden="true" size={17} />
          </span>
        )}
        {!loading && query && (
          <button aria-label="Limpiar búsqueda" className="global-content-search-clear" onClick={clearSearch} type="button">
            <X aria-hidden="true" size={17} />
          </button>
        )}
      </form>

      {panelOpen && (
        <div
          aria-label="Resultados de búsqueda"
          aria-live="polite"
          className="global-content-search-panel"
          id="global-content-search-panel"
          role="dialog"
        >
          {!hasQuery ? (
            <p className="global-search-hint">Busca por título, tema o dentro del contenido de una guía.</p>
          ) : loading ? (
            <p className="global-search-status">
              <span className="global-search-status-spinner" aria-hidden="true">
                <CircleNotch size={17} />
              </span>
              Buscando coincidencias…
            </p>
          ) : error ? (
            <p className="global-search-status is-error">No pudimos cargar la búsqueda. Inténtalo de nuevo.</p>
          ) : (
            <>
              <p className="global-search-summary">
                {response.videos.length + response.guides.length === 0
                  ? "No encontramos coincidencias."
                  : `${response.videos.length + response.guides.length} coincidencias principales`}
              </p>
              <SearchSection
                icon={<PlayCircle size={17} weight="fill" />}
                label="Videos"
                onNavigate={closeSearch}
                query={response.query || query}
                results={response.videos}
              />
              <SearchSection
                icon={<BookOpen size={17} />}
                label="Guías"
                onNavigate={closeSearch}
                query={response.query || query}
                results={response.guides}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
