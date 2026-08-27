"use client";

import {
  ArrowRight,
  Atom,
  Books,
  Brain,
  Dna,
  Flask,
  Heartbeat,
  MagnifyingGlass,
  PersonArmsSpread,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ContentItem, Subject } from "@cediah/contracts";
import {
  publishedContentHref,
  subjectContentHref,
  studyContentKindLabels,
  type StudyContentKind,
} from "@/lib/content-navigation";
import { uniqueRegions } from "@/lib/content-regions";
import { AppShell } from "./app-shell";
import { ContentResourceList } from "./content-resource-list";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");
}

const subjectVisuals = [
  { icon: PersonArmsSpread, pattern: /anatom/, tone: "anatomy" },
  { icon: Dna, pattern: /biolog|celul|genet/, tone: "biology" },
  { icon: Flask, pattern: /bioquim|quim/, tone: "chemistry" },
  { icon: Heartbeat, pattern: /fisiolog|cardio/, tone: "physiology" },
  { icon: Brain, pattern: /neuro|psico/, tone: "neuro" },
  { icon: Atom, pattern: /fisic|biofis/, tone: "science" },
] as const;

const kindSearchLabels: Record<StudyContentKind, string> = {
  flashcards: "Buscar flashcard",
  guide: "Buscar guía",
  quiz: "Buscar cuestionario",
  video: "Buscar video",
};

function visualFor(subject: Subject) {
  const normalized = normalize(`${subject.slug} ${subject.name}`);
  return subjectVisuals.find(({ pattern }) => pattern.test(normalized)) ?? {
    icon: Books,
    tone: "default",
  };
}

export function SubjectDirectoryScreen({
  available,
  initialKind,
  isAdministrator = false,
  items,
  subjects,
}: {
  available: boolean;
  initialKind?: StudyContentKind;
  isAdministrator?: boolean;
  items: ContentItem[];
  subjects: Subject[];
}) {
  const [search, setSearch] = useState("");
  const subjectById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects],
  );
  const subjectCounts = useMemo(
    () => new Map(subjects.map((subject) => [
      subject.id,
      initialKind
        ? items.filter((item) => item.subjectIds.includes(subject.id)).length
        : subject.contentCount,
    ])),
    [initialKind, items, subjects],
  );
  const visibleSubjects = useMemo(() => {
    const query = normalize(search.trim());
    return subjects.filter((subject) => {
      const matchesSearch = !query || normalize(subject.name).includes(query);
      const hasRequestedContent = !initialKind || (subjectCounts.get(subject.id) ?? 0) > 0;
      return matchesSearch && hasRequestedContent;
    });
  }, [initialKind, search, subjectCounts, subjects]);
  const resourceSearchResults = useMemo(() => {
    const query = normalize(search.trim());
    if (!initialKind || !query) return [];

    return items.filter((item) => {
      const subjectNames = item.subjectIds
        .map((subjectId) => subjectById.get(subjectId)?.name ?? "")
        .join(" ");
      const regions = uniqueRegions(item.content.regions.length > 0 ? item.content.regions : [item.topic]);
      return normalize(`${item.title} ${item.summary} ${item.topic} ${regions.join(" ")} ${subjectNames}`).includes(query);
    });
  }, [initialKind, items, search, subjectById]);
  const activeKey = initialKind === "guide" ? "guides" : initialKind ?? "subjects";
  const headerTitle = initialKind ? studyContentKindLabels[initialKind] : "Materias";
  const showingResourceResults = Boolean(initialKind && search.trim());

  return (
    <AppShell
      activeKey={activeKey}
      headerTitle={headerTitle}
      isAdministrator={isAdministrator}
      mainClassName="subject-directory-main"
    >
      <section className="subject-directory-page" aria-label={headerTitle}>
        <h2 className="sr-only">{initialKind ? `${headerTitle} por materia` : headerTitle}</h2>

        <label className="subject-directory-search">
          <MagnifyingGlass aria-hidden="true" size={19} />
          <input
            aria-label={initialKind ? kindSearchLabels[initialKind] : "Buscar materia"}
            autoComplete="off"
            placeholder={initialKind ? kindSearchLabels[initialKind] : "Buscar materia"}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button aria-label="Limpiar búsqueda" type="button" onClick={() => setSearch("")}>
              <X aria-hidden="true" size={17} />
            </button>
          )}
        </label>

        {showingResourceResults && resourceSearchResults.length > 0 ? (
          <div className="subject-search-results" aria-live="polite">
            <span>
              {resourceSearchResults.length === 1 ? "1 resultado" : `${resourceSearchResults.length} resultados`}
            </span>
            <ContentResourceList
              ariaLabel={`Resultados en ${headerTitle.toLocaleLowerCase("es")}`}
              className="subject-resource-list"
              contextForItem={(item) => [
                ...item.subjectIds.map((subjectId) => subjectById.get(subjectId)?.name ?? ""),
              ]}
              hrefForItem={(item) => {
                const subject = item.subjectIds.map((subjectId) => subjectById.get(subjectId)).find(Boolean);
                const topic = uniqueRegions(item.content.regions.length > 0 ? item.content.regions : [item.topic])[0];
                return publishedContentHref(item, {
                  origin: "asignatura",
                  subjectSlug: subject?.slug,
                  topic,
                });
              }}
              items={resourceSearchResults}
            />
          </div>
        ) : !showingResourceResults && visibleSubjects.length > 0 ? (
          <ul className="subject-directory-grid">
            {visibleSubjects.map((subject) => {
              const visual = visualFor(subject);
              const Icon = visual.icon;
              return (
                <li key={subject.id}>
                  <Link
                    className="subject-directory-item"
                    href={subjectContentHref(subject.slug, initialKind)}
                  >
                    <span className={`subject-directory-icon subject-directory-icon-${visual.tone}`} aria-hidden="true">
                      <Icon size={23} weight="regular" />
                    </span>
                    <span className="subject-directory-copy">
                      <strong>{subject.name}</strong>
                    </span>
                    <ArrowRight className="subject-directory-arrow" aria-hidden="true" size={18} />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="subject-directory-empty" role="status">
            <Books aria-hidden="true" size={34} />
            <h3>
              {available
                ? showingResourceResults
                  ? "No encontramos recursos"
                  : "No encontramos materias"
                : "Las materias no están disponibles"}
            </h3>
            <p>
              {available
                ? showingResourceResults
                  ? "Prueba con otro título, tema o materia."
                  : initialKind
                    ? `No hay ${headerTitle.toLocaleLowerCase("es")} en esta selección.`
                  : "Prueba con otra búsqueda."
                : "Intenta de nuevo en unos minutos."}
            </p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
