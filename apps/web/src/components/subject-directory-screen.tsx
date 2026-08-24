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
  subjectContentHref,
  studyContentKindLabels,
  type StudyContentKind,
} from "@/lib/content-navigation";
import { AppShell } from "./app-shell";

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

function visualFor(subject: Subject) {
  const normalized = normalize(`${subject.slug} ${subject.name}`);
  return subjectVisuals.find(({ pattern }) => pattern.test(normalized)) ?? {
    icon: Books,
    tone: "default",
  };
}

function resourceLabel(count: number, kind?: StudyContentKind) {
  if (!kind) return count === 1 ? "1 recurso" : `${count} recursos`;
  const label = studyContentKindLabels[kind].toLocaleLowerCase("es");
  return `${count} ${count === 1 ? label.replace(/s$/, "") : label}`;
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
  const activeKey = initialKind === "guide" ? "guides" : initialKind ?? "subjects";
  const headerTitle = initialKind ? studyContentKindLabels[initialKind] : "Asignaturas";

  return (
    <AppShell
      activeKey={activeKey}
      headerTitle={headerTitle}
      isAdministrator={isAdministrator}
      mainClassName="subject-directory-main"
    >
      <section className="subject-directory-page" aria-label={headerTitle}>
        <h2 className="sr-only">{headerTitle} por asignatura</h2>

        <label className="subject-directory-search">
          <MagnifyingGlass aria-hidden="true" size={19} />
          <input
            aria-label="Buscar asignaturas"
            autoComplete="off"
            placeholder={initialKind ? `Buscar asignatura con ${headerTitle.toLocaleLowerCase("es")}` : "Buscar asignatura"}
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

        {visibleSubjects.length > 0 ? (
          <ul className="subject-directory-grid">
            {visibleSubjects.map((subject, index) => {
              const visual = visualFor(subject);
              const Icon = visual.icon;
              const count = subjectCounts.get(subject.id) ?? 0;
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
                      <span>{resourceLabel(count, initialKind)}</span>
                    </span>
                    <span className="subject-directory-index" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
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
            <h3>{available ? "No encontramos asignaturas" : "Las asignaturas no están disponibles"}</h3>
            <p>
              {available
                ? initialKind
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
