"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
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

type GuideItem = ContentItem & { kind: "guide" };

const UNASSIGNED = "sin-asignatura";
const guideImages = [
  "/anatomy/skull-light.png",
  "/anatomy/heart-light.png",
  "/anatomy/back-light.png",
  "/anatomy/intestines.png",
  "/anatomy/thigh-light.png",
] as const;

function guideImage(guide: GuideItem) {
  const position = Array.from(guide.slug).reduce(
    (total, character) => total + character.codePointAt(0)!,
    0,
  );
  return guideImages[position % guideImages.length]!;
}

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

function GuideList({ guides, subjectSlug, topic }: {
  guides: GuideItem[];
  subjectSlug: string;
  topic: string;
}) {
  return (
    <ul className="guide-directory-list">
      {guides.map((guide) => (
        <li key={guide.id}>
          <Link
            className="guide-directory-item"
            href={publishedContentHref(guide, {
              origin: "guias",
              subjectSlug: subjectSlug === UNASSIGNED ? undefined : subjectSlug,
              topic,
            })}
          >
            <span className="guide-directory-cover">
              <Image alt="" fill sizes="(max-width: 620px) 64px, 78px" src={guideImage(guide)} />
            </span>
            <span className="guide-directory-copy">
              <strong>{guide.title}</strong>
              <span>{guide.summary}</span>
            </span>
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </li>
      ))}
    </ul>
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
      assigned.push({ count: unassignedCount, id: UNASSIGNED, name: "Sin asignatura", slug: UNASSIGNED });
    }
    return assigned;
  }, [guides, subjects]);
  const selectedGuides = useMemo(() => {
    if (isUnassigned) return guides.filter((guide) => guide.subjectIds.length === 0);
    if (selectedSubject) return guides.filter((guide) => guide.subjectIds.includes(selectedSubject.id));
    return [];
  }, [guides, isUnassigned, selectedSubject]);
  const topics = useMemo(
    () => uniqueRegions(selectedGuides.flatMap(guideTopics)).sort((left, right) => left.localeCompare(right, "es")),
    [selectedGuides],
  );
  const visibleGuides = useMemo(() => {
    const search = normalize(query.trim());
    const topic = normalize(selectedTopic);
    return selectedGuides.filter((guide) => {
      const matchesTopic = !topic || guideTopics(guide).some((value) => normalize(value) === topic);
      const matchesSearch = !search || normalize(`${guide.title} ${guide.summary} ${guide.topic}`).includes(search);
      return matchesTopic && matchesSearch;
    });
  }, [query, selectedGuides, selectedTopic]);
  const visibleBuckets = useMemo(() => {
    const search = normalize(query.trim());
    return buckets.filter((bucket) => !search || normalize(bucket.name).includes(search));
  }, [buckets, query]);
  const topicGroups = useMemo(() => {
    const groups = new Map<string, GuideItem[]>();
    for (const guide of visibleGuides) {
      for (const name of guideTopics(guide)) {
        if (selectedTopic && normalize(name) !== normalize(selectedTopic)) continue;
        const current = groups.get(name);
        if (current) current.push(guide);
        else groups.set(name, [guide]);
      }
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, "es"));
  }, [selectedTopic, visibleGuides]);

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

  const selectionName = selectedSubject?.name ?? (isUnassigned ? "Sin asignatura" : "");

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
            <Link href="/guias" onClick={(event) => navigate(event)}>
              <ArrowLeft aria-hidden="true" size={16} /> Todas las asignaturas
            </Link>
            <div>
              <span>Guías</span>
              <h3>{selectionName}</h3>
            </div>
          </header>
        )}

        <div className="guide-directory-filters" role="search" aria-label="Buscar y filtrar guías">
          <label className="guide-directory-search">
            <MagnifyingGlass aria-hidden="true" size={18} />
            <input
              aria-label={hasSelection ? "Buscar guías" : "Buscar asignatura"}
              autoComplete="off"
              placeholder={hasSelection ? "Buscar por título o descripción" : "Buscar asignatura"}
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
          <label className="guide-directory-select">
            <span className="sr-only">Asignatura</span>
            <select value={hasSelection ? selectedSlug : ""} onChange={(event) => push(event.target.value)}>
              <option value="">Asignatura</option>
              {buckets.map((bucket) => (
                <option key={bucket.id} value={bucket.slug}>{bucket.name}</option>
              ))}
            </select>
          </label>
          <label className="guide-directory-select">
            <span className="sr-only">Tema</span>
            <select
              disabled={!hasSelection}
              value={selectedTopic}
              onChange={(event) => push(selectedSlug, event.target.value)}
            >
              <option value="">Todos los temas</option>
              {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
            </select>
          </label>
        </div>

        {!hasSelection && visibleBuckets.length > 0 && (
          <nav className="guide-subject-browser" aria-label="Guías por asignatura">
            <h3>Asignaturas</h3>
            <ul>
              {visibleBuckets.map((bucket) => {
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

        {hasSelection && visibleGuides.length > 0 && (
          <div className="guide-topic-groups" aria-live="polite">
            {topicGroups.map(([topic, topicGuides]) => (
              <section key={topic} aria-labelledby={`guide-topic-${normalize(topic).replace(/[^a-z0-9]+/g, "-")}`}>
                <header>
                  <h3 id={`guide-topic-${normalize(topic).replace(/[^a-z0-9]+/g, "-")}`}>{topic}</h3>
                  <span>{topicGuides.length}</span>
                </header>
                <GuideList guides={topicGuides} subjectSlug={selectedSlug} topic={topic} />
              </section>
            ))}
          </div>
        )}

        {((!hasSelection && visibleBuckets.length === 0) || (hasSelection && visibleGuides.length === 0)) && (
          <div className="guide-catalog-empty" role="status">
            <BookOpen size={34} aria-hidden="true" />
            <h3>
              {query || selectedTopic
                ? "No encontramos guías con esos filtros."
                : available
                  ? "Aún no hay guías en esta selección."
                  : "No pudimos cargar las guías."}
            </h3>
            {(query || selectedTopic) && (
              <button type="button" onClick={() => selectedTopic ? push(selectedSlug) : setQuery("")}>
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}
