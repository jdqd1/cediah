"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CardsThree,
  ClipboardText,
  PlayCircle,
} from "@phosphor-icons/react";
import type { ContentItem, ContentKind, Subject } from "@cediah/contracts";
import { AppShell } from "./app-shell";

const sectionDefinitions: Array<{
  icon: typeof BookOpen;
  kind: ContentKind;
  label: string;
  description: string;
}> = [
  { icon: PlayCircle, kind: "video", label: "Videos", description: "Clases y explicaciones audiovisuales" },
  { icon: BookOpen, kind: "guide", label: "Guías", description: "Lecturas estructuradas y herramientas de estudio" },
  { icon: CardsThree, kind: "flashcards", label: "Flashcards", description: "Tarjetas para practicar recuerdo activo" },
  { icon: ClipboardText, kind: "quiz", label: "Cuestionarios", description: "Preguntas para comprobar lo aprendido" },
];

export function SubjectDetailScreen({
  isAdministrator = false,
  items,
  subject,
}: {
  isAdministrator?: boolean;
  items: ContentItem[];
  subject: Subject;
}) {
  const sections = sectionDefinitions.map((definition) => ({
    ...definition,
    count: items.filter((item) => item.kind === definition.kind).length,
  }));
  return (
    <AppShell
      activeKey="subjects"
      breadcrumbs={["Asignaturas", subject.name]}
      headerTitle="Asignaturas"
      isAdministrator={isAdministrator}
      mainClassName="subject-detail-main"
    >
      <section className="subject-detail-page" aria-labelledby="subject-detail-title">
        <header className="subject-detail-heading">
          <Link className="subject-detail-back" href="/asignaturas">
            <ArrowLeft size={17} /> Volver a asignaturas
          </Link>
          <h2 id="subject-detail-title">{subject.name}</h2>
        </header>

        <nav className="subject-destination-grid" aria-label={`Material de estudio de ${subject.name}`}>
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                aria-label={`${section.label}: ${section.count === 1 ? "1 recurso" : `${section.count} recursos`} en ${subject.name}`}
                className={`subject-destination subject-destination-${section.kind}${section.count === 0 ? " is-empty" : ""}`}
                href={`/biblioteca?tipo=${section.kind}&asignatura=${subject.slug}`}
                key={section.kind}
              >
                <span className="subject-destination-icon" aria-hidden="true">
                  <Icon size={24} weight={section.kind === "video" ? "fill" : "regular"} />
                </span>
                <span className="subject-destination-copy">
                  <strong>{section.label}</strong>
                  <span>{section.description}</span>
                </span>
                <span className="subject-destination-meta">
                  <small>{section.count === 1 ? "1 recurso" : `${section.count} recursos`}</small>
                  <ArrowRight aria-hidden="true" size={18} />
                </span>
              </Link>
            );
          })}
        </nav>
      </section>
    </AppShell>
  );
}
