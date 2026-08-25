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
import { uniqueRegions } from "@/lib/content-regions";
import { AppShell } from "./app-shell";
import { IconBackLink, NavigationTrail } from "./compact-navigation";
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

function queryHref(pathname: string, subjectSlug = "") {
  const params = new URLSearchParams();
  if (subjectSlug) params.set("asignatura", subjectSlug);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function GuideList({ guides, showSubject = false, subjectSlug, subjects, topic }: {
  guides: GuideItem[];
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
        ...(topic ? [topic] : guideTopics(guide)),
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
      assigned.push({ count: unassignedCount, id: UNASSIGNED, name: "Sin asignatura", slug: UNASSIGNED });
    }
    return assigned;
  }, [guides, subjects]);
  const selectedGuides = useMemo(() => {
    if (isUnassigned) return guides.filter((guide) => guide.subjectIds.length === 0);
    if (selectedSubject) return guides.filter((guide) => guide.subjectIds.includes(selectedSubject.id));
    return [];
  }, [guides, isUnassigned, selectedSubject]);
  const visibleGuides = useMemo(() => {
    const search = normalize(query.trim());
    return selectedGuides.filter((guide) => {
      return !search || normalize(`${guide.title} ${guide.summary} ${guide.topic} ${guideTopics(guide).join(" ")}`).includes(search);
    });
  }, [query, selectedGuides]);
  const globalSearchResults = useMemo(() => {
    const search = normalize(query.trim());
    if (!search || hasSelection) return [];

    return guides.filter((guide) => {
      const subjectNames = guide.subjectIds
        .map((subjectId) => subjects.find((subject) => subject.id === subjectId)?.name ?? "")
        .join(" ");
      return normalize(`${guide.title} ${guide.summary} ${guide.topic} ${guideTopics(guide).join(" ")} ${subjectNames}`).includes(search);
    });
  }, [guides, hasSelection, query, subjects]);
  const topicGroups = useMemo(() => {
    const groups = new Map<string, GuideItem[]>();
    for (const guide of visibleGuides) {
      for (const name of guideTopics(guide)) {
        const current = groups.get(name);
        if (current) current.push(guide);
        else groups.set(name, [guide]);
      }
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, "es"));
  }, [visibleGuides]);

  function push(nextSubject = "") {
    setQuery("");
    const href = queryHref(pathname, nextSubject);
    const currentHref = window.location.pathname + window.location.search;
    if (currentHref !== href) window.history.pushState(null, "", href);
  }

  function navigate(event: MouseEvent<HTMLAnchorElement>, nextSubject = "") {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    push(nextSubject);
  }

  const selectionName = selectedSubject?.name ?? (isUnassigned ? "Sin asignatura" : "");
  const hasGlobalQuery = !hasSelection && Boolean(query.trim());

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
              <IconBackLink href="/guias" label="Volver a todas las asignaturas" onClick={(event) => navigate(event)} />
              <NavigationTrail segments={["guias", selectedSubject?.slug ?? UNASSIGNED]} />
            </nav>
            <div>
              <span>Guías</span>
              <h3>{selectionName}</h3>
            </div>
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
          <nav className="guide-subject-browser" aria-label="Guías por asignatura">
            <h3>Asignaturas</h3>
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
              showSubject
              subjectSlug=""
              subjects={subjects}
              topic=""
            />
          </div>
        )}

        {hasSelection && visibleGuides.length > 0 && (
          <div className="guide-topic-groups" aria-live="polite">
            {topicGroups.map(([topic, topicGuides]) => (
              <section key={topic} aria-labelledby={`guide-topic-${normalize(topic).replace(/[^a-z0-9]+/g, "-")}`}>
                <header>
                  <h3 id={`guide-topic-${normalize(topic).replace(/[^a-z0-9]+/g, "-")}`}>{topic}</h3>
                  <span>{topicGuides.length}</span>
                </header>
                <GuideList guides={topicGuides} subjectSlug={selectedSlug} subjects={subjects} topic={topic} />
              </section>
            ))}
          </div>
        )}

        {((!hasSelection && (hasGlobalQuery ? globalSearchResults.length === 0 : buckets.length === 0)) ||
          (hasSelection && visibleGuides.length === 0)) && (
          <div className="guide-catalog-empty" role="status">
            <BookOpen size={34} aria-hidden="true" />
            <h3>
              {query
                ? "No encontramos guías con esa búsqueda."
                : available
                  ? "Aún no hay guías en esta selección."
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
