"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CardsThree,
  CheckCircle,
  ClipboardText,
  Compass,
  PlayCircle,
} from "@phosphor-icons/react";
import type { ContentItem, ContentKind, Subject } from "@cediah/contracts";
import { AppShell } from "./app-shell";

const sectionDefinitions: Array<{
  icon: typeof BookOpen;
  kind: ContentKind;
  label: string;
}> = [
  { icon: PlayCircle, kind: "video", label: "Videos" },
  { icon: BookOpen, kind: "guide", label: "Guías" },
  { icon: CardsThree, kind: "flashcards", label: "Flashcards" },
  { icon: ClipboardText, kind: "quiz", label: "Cuestionarios" },
];

const kindImages: Record<ContentKind, string> = {
  flashcards: "/anatomy/thigh-light.png",
  guide: "/anatomy/back-light.png",
  quiz: "/anatomy/heart-light.png",
  topic: "/anatomy/skull-light.png",
  video: "/anatomy/neck-muscles.png",
};

function resourceHref(item: ContentItem) {
  return item.kind === "guide" ? `/guias/${item.slug}` : `/biblioteca/${item.slug}`;
}

function ResourceCard({ item, video = false }: { item: ContentItem; video?: boolean }) {
  const definition = sectionDefinitions.find((section) => section.kind === item.kind);
  const Icon = definition?.icon ?? Compass;
  return (
    <Link
      className={`subject-resource-card ${video ? "is-video" : ""}`.trim()}
      href={resourceHref(item)}
    >
      <span className="subject-resource-media">
        <Image alt="" fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw" src={kindImages[item.kind]} />
        <span className="subject-resource-icon" aria-hidden="true">
          <Icon size={video ? 29 : 23} weight={video ? "fill" : "regular"} />
        </span>
        {item.featured && <span className="content-catalog-featured">Destacado</span>}
      </span>
      <span className="subject-resource-body">
        <span className="subject-resource-meta">{definition?.label ?? "Recurso"} · {item.topic}</span>
        <strong>{item.title}</strong>
        <span>{item.summary}</span>
      </span>
    </Link>
  );
}

export function SubjectDetailScreen({
  isAdministrator = false,
  items,
  subject,
}: {
  isAdministrator?: boolean;
  items: ContentItem[];
  subject: Subject;
}) {
  const sections = sectionDefinitions
    .map((definition) => ({
      ...definition,
      items: items.filter((item) => item.kind === definition.kind),
    }))
    .filter((section) => section.items.length > 0);

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
          <span className="eyebrow dark">Asignatura</span>
          <h2 id="subject-detail-title">{subject.name}</h2>
          <p>{items.length === 1 ? "1 recurso para estudiar esta materia." : `${items.length} recursos para estudiar esta materia.`}</p>
          <div className="subject-detail-stats">
            <span><CheckCircle size={16} /> Contenido seleccionado</span>
            <span>{sections.length} {sections.length === 1 ? "sección" : "secciones"}</span>
          </div>
        </header>

        {sections.length > 0 ? (
          <div className="subject-detail-sections">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <section className="subject-content-section" id={`subject-section-${section.kind}`} key={section.kind}>
                  <header className="subject-content-section-heading">
                    <div>
                      <span className="subject-content-section-icon"><Icon size={21} /></span>
                      <div>
                        <h3>{section.label}</h3>
                        <p>{section.items.length} {section.items.length === 1 ? "recurso" : "recursos"}</p>
                      </div>
                    </div>
                    <Link href={`/biblioteca?tipo=${section.kind}&asignatura=${subject.slug}`}>
                      Ver todos <ArrowRight size={16} />
                    </Link>
                  </header>
                  <div className={`subject-content-grid ${section.kind === "video" ? "is-video" : ""}`.trim()}>
                    {section.items.map((item) => <ResourceCard item={item} key={item.id} video={section.kind === "video"} />)}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="subject-detail-empty" role="status">
            <BookOpen aria-hidden="true" size={40} />
            <h3>Aún no hay contenido en esta asignatura</h3>
            <p>Cuando se publiquen recursos, aparecerán organizados aquí por tipo.</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
