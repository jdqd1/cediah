"use client";

import { ArrowRight, GraduationCap, MagnifyingGlass, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Subject } from "@cediah/contracts";
import { AppShell } from "./app-shell";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");
}

export function SubjectDirectoryScreen({
  available,
  isAdministrator = false,
  subjects,
}: {
  available: boolean;
  isAdministrator?: boolean;
  subjects: Subject[];
}) {
  const [search, setSearch] = useState("");
  const visibleSubjects = useMemo(() => {
    const query = normalize(search.trim());
    return subjects.filter((subject) => !query || normalize(subject.name).includes(query));
  }, [search, subjects]);

  return (
    <AppShell
      activeKey="subjects"
      headerTitle="Asignaturas"
      isAdministrator={isAdministrator}
      mainClassName="subject-directory-main"
    >
      <section className="subject-directory-page" aria-labelledby="subject-directory-title">
        <header className="subject-directory-heading">
          <div>
            <span className="eyebrow dark">Biblioteca académica</span>
            <h2 id="subject-directory-title">Explora por asignatura</h2>
            <p>Encuentra videos, guías y recursos organizados según la materia que estás estudiando.</p>
          </div>
          <div className="subject-directory-total" aria-label={`${subjects.length} asignaturas disponibles`}>
            <strong>{subjects.length}</strong>
            <span>asignaturas</span>
          </div>
        </header>

        <label className="subject-directory-search">
          <MagnifyingGlass aria-hidden="true" size={19} />
          <input
            aria-label="Buscar asignaturas"
            autoComplete="off"
            placeholder="Buscar una asignatura"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button aria-label="Limpiar búsqueda" type="button" onClick={() => setSearch("")}>
              <X size={17} />
            </button>
          )}
        </label>

        {visibleSubjects.length > 0 ? (
          <ul className="subject-directory-grid">
            {visibleSubjects.map((subject) => (
              <li key={subject.id}>
                <Link className="subject-directory-item" href={`/asignaturas/${subject.slug}`}>
                  <span className="subject-directory-icon" aria-hidden="true">
                    <GraduationCap size={25} weight="regular" />
                  </span>
                  <span className="subject-directory-copy">
                    <strong>{subject.name}</strong>
                    <span>
                      {subject.contentCount === 1 ? "1 recurso publicado" : `${subject.contentCount} recursos publicados`}
                    </span>
                  </span>
                  <ArrowRight className="subject-directory-arrow" aria-hidden="true" size={19} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="subject-directory-empty" role="status">
            <GraduationCap aria-hidden="true" size={38} />
            <h3>{available ? "No encontramos esa asignatura" : "Las asignaturas no están disponibles"}</h3>
            <p>{available ? "Prueba con otra búsqueda." : "Intenta de nuevo en unos minutos."}</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
