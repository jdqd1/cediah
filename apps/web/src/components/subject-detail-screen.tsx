"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CardsThree,
  ClipboardText,
  Compass,
  MagnifyingGlass,
  PlayCircle,
  X,
} from "@phosphor-icons/react";
import type { ContentItem, Subject } from "@cediah/contracts";
import { type MouseEvent, useMemo, useState } from "react";
import {
  isStudyContentKind,
  publishedContentHref,
  subjectContentHref,
  studyContentKindLabels,
  type StudyContentKind,
} from "@/lib/content-navigation";
import { uniqueRegions } from "@/lib/content-regions";
import { AppShell } from "./app-shell";

const sectionDefinitions: Array<{
  description: string;
  icon: typeof BookOpen;
  kind: StudyContentKind;
}> = [
  { icon: PlayCircle, kind: "video", description: "Clases y explicaciones audiovisuales" },
  { icon: BookOpen, kind: "guide", description: "Lecturas y herramientas de estudio" },
  { icon: CardsThree, kind: "flashcards", description: "Tarjetas para practicar recuerdo activo" },
  { icon: ClipboardText, kind: "quiz", description: "Preguntas para comprobar lo aprendido" },
];

const kindImages: Record<StudyContentKind, string> = {
  flashcards: "/anatomy/thigh-light.png",
  guide: "/anatomy/back-light.png",
  quiz: "/anatomy/heart-light.png",
  video: "/anatomy/neck-muscles.png",
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");
}

function itemTopics(item: ContentItem) {
  return uniqueRegions(item.content.regions.length > 0 ? item.content.regions : [item.topic]);
}

function ResourceList({
  items,
  kind,
  subject,
  topic,
}: {
  items: ContentItem[];
  kind: StudyContentKind;
  subject: Subject;
  topic: string;
}) {
  return (
    <ul className="subject-resource-list">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            className="subject-resource-item"
            href={publishedContentHref(item, {
              origin: "asignatura",
              subjectSlug: subject.slug,
              topic,
            })}
          >
            <span className="subject-resource-media">
              <Image alt="" fill sizes="(max-width: 620px) 64px, 76px" src={kindImages[kind]} />
            </span>
            <span className="subject-resource-copy">
              <strong>{item.title}</strong>
              <span>{item.summary}</span>
            </span>
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </li>
      ))}
    </ul>
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const requestedKind = searchParams.get("tipo");
  const kind = isStudyContentKind(requestedKind) ? requestedKind : undefined;
  const topic = searchParams.get("tema")?.trim() ?? "";
  const kindItems = useMemo(
    () => kind ? items.filter((item) => item.kind === kind) : [],
    [items, kind],
  );
  const filteredItems = useMemo(() => {
    const query = normalize(search.trim());
    return kindItems.filter((item) => {
      const matchesTopic = !topic || itemTopics(item).some((value) => normalize(value) === normalize(topic));
      const matchesSearch = !query || normalize(`${item.title} ${item.summary} ${item.topic}`).includes(query);
      return matchesTopic && matchesSearch;
    });
  }, [kindItems, search, topic]);
  const topicGroups = useMemo(() => {
    const groups = new Map<string, { name: string; items: ContentItem[] }>();
    for (const item of filteredItems) {
      for (const name of itemTopics(item)) {
        const key = normalize(name);
        const current = groups.get(key);
        if (current) current.items.push(item);
        else groups.set(key, { name, items: [item] });
      }
    }
    return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name, "es"));
  }, [filteredItems]);

  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    setSearch("");
    const currentHref = window.location.pathname + window.location.search;
    if (currentHref !== href) window.history.pushState(null, "", href);
  }

  const sections = sectionDefinitions.map((definition) => ({
    ...definition,
    count: items.filter((item) => item.kind === definition.kind).length,
  }));
  const KindIcon = kind ? sectionDefinitions.find((section) => section.kind === kind)?.icon ?? Compass : Compass;
  const label = kind ? studyContentKindLabels[kind] : "";
  const activeKey = kind === "guide" ? "guides" : kind ?? "subjects";
  const breadcrumbs = ["Asignaturas", subject.name, ...(kind ? [label] : []), ...(topic ? [topic] : [])];

  return (
    <AppShell
      activeKey={activeKey}
      breadcrumbs={breadcrumbs}
      headerTitle="Asignaturas"
      isAdministrator={isAdministrator}
      mainClassName="subject-detail-main"
    >
      <section className="subject-detail-page" aria-label={`Material de estudio de ${subject.name}`}>
        {!kind ? (
          <>
            <header className="subject-detail-heading">
              <Link className="subject-detail-back" href="/asignaturas">
                <ArrowLeft aria-hidden="true" size={16} /> Asignaturas
              </Link>
              <h2>{subject.name}</h2>
            </header>
            <nav className="subject-destination-grid" aria-label={`Material de estudio de ${subject.name}`}>
              {sections.map((section) => {
                const Icon = section.icon;
                const href = subjectContentHref(subject.slug, section.kind);
                return (
                  <Link
                    aria-label={`${studyContentKindLabels[section.kind]}: ${section.count} ${section.count === 1 ? "recurso" : "recursos"} en ${subject.name}`}
                    className={`subject-destination subject-destination-${section.kind}${section.count === 0 ? " is-empty" : ""}`}
                    href={href}
                    key={section.kind}
                    onClick={(event) => navigate(event, href)}
                  >
                    <span className="subject-destination-icon" aria-hidden="true">
                      <Icon size={22} weight={section.kind === "video" ? "fill" : "regular"} />
                    </span>
                    <span className="subject-destination-copy">
                      <strong>{studyContentKindLabels[section.kind]}</strong>
                      <span>{section.description}</span>
                    </span>
                    <span className="subject-destination-meta">
                      <small>{section.count}</small>
                      <ArrowRight aria-hidden="true" size={18} />
                    </span>
                  </Link>
                );
              })}
            </nav>
          </>
        ) : (
          <>
            <header className={`subject-flow-heading${topic ? " is-topic" : ""}`}>
              <Link
                className="subject-detail-back"
                href={topic ? subjectContentHref(subject.slug, kind) : pathname}
                onClick={(event) => navigate(event, topic ? subjectContentHref(subject.slug, kind) : pathname)}
              >
                <ArrowLeft aria-hidden="true" size={16} />
                {topic ? "Volver al temario" : `Volver a ${subject.name}`}
              </Link>
              <div>
                <span>{subject.name}</span>
                <h2>{topic || label}</h2>
              </div>
            </header>

            <label className="subject-flow-search">
              <MagnifyingGlass aria-hidden="true" size={18} />
              <input
                aria-label={`Buscar ${label.toLocaleLowerCase("es")}`}
                autoComplete="off"
                placeholder={topic ? `Buscar en ${topic}` : `Buscar en el temario de ${label.toLocaleLowerCase("es")}`}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button aria-label="Limpiar búsqueda" type="button" onClick={() => setSearch("")}>
                  <X aria-hidden="true" size={16} />
                </button>
              )}
            </label>

            {filteredItems.length > 0 ? (
              topic ? (
                <ResourceList items={filteredItems} kind={kind} subject={subject} topic={topic} />
              ) : (
                <nav className="subject-topic-browser" aria-label={`Temario de ${label} en ${subject.name}`}>
                  <ul className="subject-topic-list">
                    {topicGroups.map((group) => {
                      const href = subjectContentHref(subject.slug, kind, group.name);
                      return (
                        <li key={group.name}>
                          <Link href={href} onClick={(event) => navigate(event, href)}>
                            <span className="subject-topic-icon" aria-hidden="true"><KindIcon size={20} /></span>
                            <span>
                              <strong>{group.name}</strong>
                              <small>{group.items.length === 1 ? "1 recurso" : `${group.items.length} recursos`}</small>
                            </span>
                            <ArrowRight aria-hidden="true" size={18} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              )
            ) : (
              <div className="subject-detail-empty" role="status">
                <KindIcon aria-hidden="true" size={34} />
                <h3>{search ? "No encontramos resultados" : `Aún no hay ${label.toLocaleLowerCase("es")}`}</h3>
                <p>{search ? "Prueba con otra búsqueda." : `Vuelve a ${subject.name} para explorar otro tipo de material.`}</p>
              </div>
            )}
          </>
        )}
      </section>
    </AppShell>
  );
}
