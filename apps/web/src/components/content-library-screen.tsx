"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BookOpen,
  CardsThree,
  ClipboardText,
  Compass,
  MagnifyingGlass,
  PlayCircle,
  X,
} from "@phosphor-icons/react";
import type { ContentItem, ContentKind, Subject } from "@cediah/contracts";
import { type MouseEvent, useMemo, useState } from "react";
import { uniqueRegions } from "@/lib/content-regions";
import { AppShell } from "./app-shell";

type CatalogKind = Exclude<ContentKind, "topic"> | "all";

type ContentLibraryScreenProps = {
  available: boolean;
  initialKind?: ContentKind;
  initialTopic?: string;
  isAdministrator?: boolean;
  items: ContentItem[];
  subjects?: Subject[];
};

const kindLabels: Record<ContentKind, string> = {
  flashcards: "Flashcards",
  guide: "Guías",
  quiz: "Cuestionarios",
  topic: "Tema",
  video: "Videos",
};

const kindIcons = {
  flashcards: CardsThree,
  guide: BookOpen,
  quiz: ClipboardText,
  topic: Compass,
  video: PlayCircle,
} as const;

const kindImages: Record<ContentKind, string> = {
  flashcards: "/anatomy/thigh-light.png",
  guide: "/anatomy/back-light.png",
  quiz: "/anatomy/heart-light.png",
  topic: "/anatomy/skull-light.png",
  video: "/anatomy/neck-muscles.png",
};

const contentKinds = Object.keys(kindLabels) as ContentKind[];
const filterableKinds = ["video", "guide", "quiz", "flashcards"] as Exclude<ContentKind, "topic">[];
const kindOptions: { icon: typeof BookOpen; label: string; value: CatalogKind }[] = [
  { icon: BookOpen, label: "Todo", value: "all" },
  { icon: PlayCircle, label: "Videos", value: "video" },
  { icon: BookOpen, label: "Guías", value: "guide" },
  { icon: ClipboardText, label: "Cuestionarios", value: "quiz" },
  { icon: CardsThree, label: "Flashcards", value: "flashcards" },
];

function itemHref(item: ContentItem) {
  return item.kind === "guide"
    ? "/guias/" + item.slug
    : "/biblioteca/" + item.slug;
}

function isContentKind(value: string | null): value is Exclude<ContentKind, "topic"> {
  return value !== null && filterableKinds.includes(value as Exclude<ContentKind, "topic">);
}

function catalogTitle(kind: CatalogKind) {
  if (kind === "video") return "Videos";
  return "Biblioteca";
}

function catalogSearchPlaceholder(kind: CatalogKind) {
  if (kind === "video") return "Buscar videos";
  return "Buscar en la biblioteca";
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");
}

function itemRegions(item: ContentItem) {
  return item.content.regions.length > 0 ? item.content.regions : [item.topic];
}

function CatalogCard({ item, video = false }: { item: ContentItem; video?: boolean }) {
  const Icon = kindIcons[item.kind];

  return (
    <Link
      className={`content-catalog-card ${video ? "content-catalog-video-card" : "content-catalog-resource-card"}`}
      href={itemHref(item)}
    >
      <span className="content-catalog-card-media">
        <Image
          alt=""
          fill
          sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
          src={kindImages[item.kind]}
        />
        <span className="content-catalog-card-icon" aria-hidden="true">
          <Icon size={video ? 30 : 24} weight={video ? "fill" : "regular"} />
        </span>
        {item.featured && <span className="content-catalog-featured">Destacado</span>}
      </span>
      <div className="content-catalog-card-body">
        <span className="content-catalog-card-meta">
          <span>{kindLabels[item.kind]}</span>
          <span>{item.topic}</span>
        </span>
        <strong>{item.title}</strong>
        <p>{item.summary}</p>
      </div>
    </Link>
  );
}

export function ContentLibraryScreen({
  available,
  isAdministrator = false,
  items,
  subjects = [],
}: ContentLibraryScreenProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const requestedKind = searchParams.get("tipo");
  const kind: CatalogKind = isContentKind(requestedKind) ? requestedKind : "all";
  const topic = searchParams.get("tema")?.trim() ?? "";
  const subjectSlug = searchParams.get("asignatura")?.trim() ?? "";
  const selectedSubject = subjects.find((subject) => subject.slug === subjectSlug);
  const title = catalogTitle(kind);

  const topics = useMemo(
    () => uniqueRegions(items.flatMap(itemRegions)).sort((left, right) => left.localeCompare(right, "es")),
    [items],
  );
  const kindCounts = useMemo(() => {
    const counts = Object.fromEntries(contentKinds.map((value) => [value, 0])) as Record<ContentKind, number>;
    for (const item of items) counts[item.kind] += 1;
    return counts;
  }, [items]);
  const visibleItems = useMemo(() => {
    const normalized = normalize(search.trim());
    const selectedRegion = normalize(topic);
    return items.filter((item) => {
      const regions = itemRegions(item);
      const matchesKind = kind === "all" || item.kind === kind;
      const matchesSubject =
        !subjectSlug || Boolean(selectedSubject && item.subjectIds.includes(selectedSubject.id));
      const matchesTopic =
        !selectedRegion || regions.some((region) => normalize(region) === selectedRegion);
      const matchesSearch =
        !normalized ||
        normalize(`${item.title} ${item.summary} ${item.topic} ${regions.join(" ")}`)
          .includes(normalized);
      return matchesKind && matchesSubject && matchesTopic && matchesSearch;
    });
  }, [items, kind, search, selectedSubject, subjectSlug, topic]);

  function catalogHref(nextKind: CatalogKind, nextTopic: string, nextSubject = subjectSlug) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextKind === "all") params.delete("tipo");
    else params.set("tipo", nextKind);
    if (nextTopic) params.set("tema", nextTopic);
    else params.delete("tema");
    if (nextSubject) params.set("asignatura", nextSubject);
    else params.delete("asignatura");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function navigateCatalog(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return false;
    }

    event.preventDefault();
    const currentHref = window.location.pathname + window.location.search;
    if (currentHref !== href) window.history.pushState(null, "", href);
    return true;
  }

  const activeKey = kind === "all" ? "study" : kind === "guide" ? "guides" : kind;
  const clearHref = catalogHref("all", "", "");
  const hasFilters = kind !== "all" || Boolean(subjectSlug) || Boolean(topic) || Boolean(search);

  return (
    <AppShell
      activeKey={activeKey}
      isAdministrator={isAdministrator}
      headerTitle={title}
      headerSubtitle={selectedSubject?.name}
      mainClassName="content-catalog-main"
    >
      <section className="content-catalog-page" aria-label={title}>
        <nav className="content-catalog-kind-nav" aria-label="Tipo de contenido">
          <div className="content-catalog-kind-chips">
            {kindOptions.map((option) => {
              const Icon = option.icon;
              const href = catalogHref(option.value, topic, subjectSlug);
              const count = option.value === "all" ? items.length : kindCounts[option.value];

              return (
                <Link
                  aria-current={kind === option.value ? "page" : undefined}
                  className={`content-catalog-kind-chip ${kind === option.value ? "is-active" : ""}`.trim()}
                  href={href}
                  key={option.value}
                  onClick={(event) => navigateCatalog(event, href)}
                  prefetch={false}
                >
                  <Icon aria-hidden="true" size={18} />
                  <span>{option.label}</span>
                  <small aria-label={`${count} publicaciones`}>{count}</small>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="content-catalog-toolbar">
          <label className="content-catalog-search" htmlFor="content-catalog-search-input">
            <MagnifyingGlass aria-hidden="true" size={20} />
            <input
              aria-label={catalogSearchPlaceholder(kind)}
              aria-controls="content-catalog-results"
              autoComplete="off"
              id="content-catalog-search-input"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={catalogSearchPlaceholder(kind)}
              type="search"
              value={search}
            />
            {search && (
              <button aria-label="Limpiar búsqueda" onClick={() => setSearch("")} type="button">
                <X aria-hidden="true" size={17} />
              </button>
            )}
          </label>
          <span className="content-catalog-result-count" aria-live="polite">
            {visibleItems.length === 1 ? "1 resultado" : `${visibleItems.length} resultados`}
          </span>
        </div>

        {subjects.length > 0 && (
          <nav className="content-catalog-subject-nav" aria-label="Asignatura">
            <span className="content-catalog-topic-label">Asignatura</span>
            <div className="content-catalog-topic-chips">
              {[{ slug: "", name: "Todas las asignaturas" }, ...subjects].map((subject) => {
                const href = catalogHref(kind, topic, subject.slug);
                return (
                  <Link
                    aria-current={subjectSlug === subject.slug ? "page" : undefined}
                    className={`content-catalog-topic-chip ${subjectSlug === subject.slug ? "is-active" : ""}`.trim()}
                    href={href}
                    key={subject.slug || "all-subjects"}
                    onClick={(event) => navigateCatalog(event, href)}
                    prefetch={false}
                  >
                    {subject.name}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
        {topics.length > 0 && (
          <nav className="content-catalog-topic-nav" aria-label="Etiquetas del tema">
            <span className="content-catalog-topic-label">Etiqueta</span>
            <div className="content-catalog-topic-chips">
              {["", ...topics].map((value) => {
                const href = catalogHref(kind, value, subjectSlug);
                const label = value || "Todas las etiquetas";
                return (
                  <Link
                    aria-current={topic === value ? "page" : undefined}
                    className={`content-catalog-topic-chip ${topic === value ? "is-active" : ""}`.trim()}
                    href={href}
                    key={value || "all-topics"}
                    onClick={(event) => navigateCatalog(event, href)}
                    prefetch={false}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}

        {visibleItems.length > 0 ? (
            <ul
              className={kind === "video" ? "content-catalog-video-grid" : "content-catalog-resource-grid"}
              id="content-catalog-results"
            >
              {visibleItems.map((item) => (
                <li key={item.id}>
                  <CatalogCard item={item} video={kind === "video"} />
                </li>
              ))}
            </ul>
        ) : (
          <div className="content-catalog-empty" id="content-catalog-results" role="status">
            <Compass aria-hidden="true" size={38} />
            <h2>{available ? "No encontramos contenido" : "La biblioteca no está disponible"}</h2>
            <p>{available ? "Prueba con otros filtros." : "Intenta de nuevo en unos minutos."}</p>
            {hasFilters && (
              <Link
                className="content-catalog-clear-filters"
                href={clearHref}
                onClick={(event) => {
                  if (navigateCatalog(event, clearHref)) setSearch("");
                }}
                prefetch={false}
              >
                Limpiar filtros
              </Link>
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}
