"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Books,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
import type { ContentItem, Subject } from "@cediah/contracts";
import { type MouseEvent, useMemo, useState } from "react";
import { publishedContentHref } from "@/lib/content-navigation";
import { contentItemSearchText, getContentSearchExcerpt } from "@/lib/content-search";
import { uniqueRegions } from "@/lib/content-regions";
import { AppShell } from "./app-shell";
import { IconBackLink } from "./compact-navigation";
import { ContentResourceList } from "./content-resource-list";

type GuideItem = ContentItem & { kind: "guide" };

const UNASSIGNED = "sin-asignatura";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");
}

function guideTopics(guide: GuideItem) {
  return uniqueRegions(guide.content.regions.length > 0 ? guide.content.regions : [guide.topic]);
}

function queryHref(pathname: string, subjectSlug = "", topic = "") {
  const params = new URLSearchParams();
  if (subjectSlug) params.set("asignatura", subjectSlug);
  if (topic) params.set("tema", topic);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function GuideList({ guides, searchQuery = "", showSubject = false, subjectSlug, subjects, topic }: {
  guides: GuideItem[];
  searchQuery?: string;
  showSubject?: boolean;
  subjectSlug: string;
  subjects: Subject[];
  topic: string;
}) {
  return (
    <ContentResourceList
      ariaLabel="Guías disponibles"
      className="guide-directory-list"
      contextForItem={(guide) => [
        ...(showSubject
          ? guide.subjectIds.map((subjectId) => subjects.find((subject) => subject.id === subjectId)?.name ?? "")
          : []),
      ]}
      hrefForItem={(guide) => {
        const fallbackSubject = subjects.find((subject) => guide.subjectIds.includes(subject.id));
        return publishedContentHref(guide, {
          origin: "guias",
          subjectSlug: subjectSlug === UNASSIGNED ? undefined : subjectSlug || fallbackSubject?.slug,
          topic: topic || guideTopics(guide)[0],
        });
      }}
      items={guides}
      searchQuery={searchQuery}
      summaryForItem={(guide) => {
        const content = contentItemSearchText(guide);
        return searchQuery.trim() && normalize(content).includes(normalize(searchQuery.trim()))
          ? getContentSearchExcerpt(content, searchQuery)
          : guide.summary;
      }}
    />
  );
}

export function GuideDashboardScreen({
  available,
  guides,
  isAdministrator = false,
  subjects,
}: {
  available: boolean;
  guides: GuideItem[];
  isAdministrator?: boolean;
  subjects: Subject[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const selectedSlug = searchParams.get("asignatura")?.trim() ?? "";
  const selectedTopic = searchParams.get("tema")?.trim() ?? "";
  const selectedSubject = subjects.find((subject) => subject.slug === selectedSlug);
  const isUnassigned = selectedSlug === UNASSIGNED;
  const hasSelection = Boolean(selectedSubject || isUnassigned);
  const buckets = useMemo(() => {
    const assigned = subjects.map((subject) => ({
      count: guides.filter((guide) => guide.subjectIds.includes(subject.id)).length,
      id: subject.id,
      name: subject.name,
      slug: subject.slug,
    })).filter((subject) => subject.count > 0);
    const unassignedCount = guides.filter((guide) => guide.subjectIds.length === 0).length;
    if (unassignedCount > 0) {
      assigned.push({ count: unassignedCount, id: UNASSIGNED, name: "Sin materia", slug: UNASSIGNED });
    }
    return assigned;
  }, [guides, subjects]);
  const selectedGuides = useMemo(() => {
    if (isUnassigned) return guides.filter((guide) => guide.subjectIds.length === 0);
    if (selectedSubject) return guides.filter((guide) => guide.subjectIds.includes(selectedSubject.id));
    return [];
  }, [guides, isUnassigned, selectedSubject]);
  const topicGroups = useMemo(() => {
    const groups = new Map<string, { guides: GuideItem[]; name: string }>();
    for (const guide of selectedGuides) {
      for (const name of guideTopics(guide)) {
        const key = normalize(name);
        const current = groups.get(key);
        if (current) current.guides.push(guide);
        else groups.set(key, { guides: [guide], name });
      }
    }
    return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name, "es"));
  }, [selectedGuides]);
  const topicGuides = useMemo(() => {
    if (!selectedTopic) return selectedGuides;
    return selectedGuides.filter((guide) => (
      guideTopics(guide).some((topic) => normalize(topic) === normalize(selectedTopic))
    ));
  }, [selectedGuides, selectedTopic]);
  const visibleGuides = useMemo(() => {
    const search = normalize(query.trim());
    return topicGuides.filter((guide) => {
      return !search || normalize(`${guide.title} ${guide.summary} ${guide.topic} ${guideTopics(guide).join(" ")} ${contentItemSearchText(guide)}`).includes(search);
    });
  }, [query, topicGuides]);
  const globalSearchResults = useMemo(() => {
    const search = normalize(query.trim());
    if (!search || hasSelection) return [];

    return guides.filter((guide) => {
      const subjectNames = guide.subjectIds
        .map((subjectId) => subjects.find((subject) => subject.id === subjectId)?.name ?? "")
        .join(" ");
      return normalize(`${guide.title} ${guide.summary} ${guide.topic} ${guideTopics(guide).join(" ")} ${subjectNames} ${contentItemSearchText(guide)}`).includes(search);
    });
  }, [guides, hasSelection, query, subjects]);
  function push(nextSubject = "", nextTopic = "") {
    setQuery("");
    const href = queryHref(pathname, nextSubject, nextTopic);
    const currentHref = window.location.pathname + window.location.search;
    if (currentHref !== href) window.history.pushState(null, "", href);
  }

  function navigate(event: MouseEvent<HTMLAnchorElement>, nextSubject = "", nextTopic = "") {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    push(nextSubject, nextTopic);
  }

  const hasGlobalQuery = !hasSelection && Boolean(query.trim());
  const hasSelectionQuery = hasSelection && Boolean(query.trim());

  return (
    <AppShell
      activeKey="guides"
      isAdministrator={isAdministrator}
      headerTitle="Guías"
      mainClassName="guide-catalog-main"
    >
      <section className="guide-directory" aria-label="Guías de estudio">
        <h2 className="sr-only">Guías de estudio</h2>

        {hasSelection && (
          <header className="guide-directory-context">
            <nav className="compact-navigation-row" aria-label="Navegación de guías">
              <IconBackLink
                href={selectedTopic ? queryHref(pathname, selectedSlug) : "/guias"}
                label={selectedTopic ? "Volver a los temas" : "Volver a todas las materias"}
                onClick={(event) => navigate(event, selectedTopic ? selectedSlug : "")}
              />
            </nav>
          </header>
        )}

        <div className="guide-directory-filters" role="search" aria-label="Buscar guías">
          <label className="guide-directory-search">
            <MagnifyingGlass aria-hidden="true" size={18} />
            <input
              aria-label="Buscar guía"
              autoComplete="off"
              placeholder="Buscar guía"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button aria-label="Limpiar búsqueda" type="button" onClick={() => setQuery("")}>
                <X aria-hidden="true" size={16} />
              </button>
            )}
          </label>
        </div>

        {!hasSelection && !hasGlobalQuery && buckets.length > 0 && (
          <nav className="guide-subject-browser" aria-label="Guías por materia">
            <ul>
              {buckets.map((bucket) => {
                const href = queryHref(pathname, bucket.slug);
                return (
                  <li key={bucket.id}>
                    <Link href={href} onClick={(event) => navigate(event, bucket.slug)}>
                      <span className="guide-subject-icon" aria-hidden="true"><Books size={21} /></span>
                      <span>
                        <strong>{bucket.name}</strong>
                        <small>{bucket.count === 1 ? "1 guía" : `${bucket.count} guías`}</small>
                      </span>
                      <ArrowRight aria-hidden="true" size={18} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        {hasGlobalQuery && globalSearchResults.length > 0 && (
          <div className="subject-search-results guide-search-results" aria-live="polite">
            <span>
              {globalSearchResults.length === 1 ? "1 resultado" : `${globalSearchResults.length} resultados`}
            </span>
            <GuideList
              guides={globalSearchResults}
              searchQuery={query}
              showSubject
              subjectSlug=""
              subjects={subjects}
              topic=""
            />
          </div>
        )}

        {hasSelection && !selectedTopic && !hasSelectionQuery && topicGroups.length > 0 && (
          <nav className="guide-topic-browser" aria-label="Temas con guías">
            <ul className="subject-topic-list subject-topic-list-guide">
              {topicGroups.map((group) => {
                const href = queryHref(pathname, selectedSlug, group.name);
                return (
                  <li key={normalize(group.name)}>
                    <Link href={href} onClick={(event) => navigate(event, selectedSlug, group.name)}>
                      <span className="subject-topic-icon" aria-hidden="true"><BookOpen size={20} /></span>
                      <span>
                        <strong>{group.name}</strong>
                        <small>{group.guides.length === 1 ? "1 guía" : `${group.guides.length} guías`}</small>
                      </span>
                      <ArrowRight aria-hidden="true" size={18} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        {hasSelection && (selectedTopic || hasSelectionQuery) && visibleGuides.length > 0 && (
          <div className="subject-search-results guide-search-results" aria-live="polite">
            {hasSelectionQuery && (
              <span>{visibleGuides.length === 1 ? "1 resultado" : `${visibleGuides.length} resultados`}</span>
            )}
            <GuideList
              guides={visibleGuides}
              searchQuery={query}
              subjectSlug={selectedSlug}
              subjects={subjects}
              topic={selectedTopic}
            />
          </div>
        )}

        {((!hasSelection && (hasGlobalQuery ? globalSearchResults.length === 0 : buckets.length === 0)) ||
          (hasSelection && (selectedTopic || hasSelectionQuery) && visibleGuides.length === 0) ||
          (hasSelection && !selectedTopic && !hasSelectionQuery && topicGroups.length === 0)) && (
          <div className="guide-catalog-empty" role="status">
            <BookOpen size={34} aria-hidden="true" />
            <h3>
              {query
                ? "No encontramos guías con esa búsqueda."
                : available
                  ? selectedTopic
                    ? "Aún no hay guías en este tema."
                    : "Aún no hay temas con guías en esta selección."
                  : "No pudimos cargar las guías."}
            </h3>
            {query && (
              <button type="button" onClick={() => setQuery("")}>
                Limpiar búsqueda
              </button>
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}
