"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
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
  return kind === "all" ? "Biblioteca" : kindLabels[kind];
}

function catalogSearchPlaceholder(kind: CatalogKind) {
  return kind === "all"
    ? "Buscar en la biblioteca"
    : `Buscar ${kindLabels[kind].toLocaleLowerCase("es")}`;
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

function topicAnchor(topic: string) {
  const slug = normalize(topic)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `tema-${slug || "otros"}`;
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

function CatalogGrid({
  id,
  items,
  labelledBy,
  video = false,
}: {
  id?: string;
  items: ContentItem[];
  labelledBy?: string;
  video?: boolean;
}) {
  return (
    <ul
      aria-labelledby={labelledBy}
      className={video ? "content-catalog-video-grid" : "content-catalog-resource-grid"}
      id={id}
    >
      {items.map((item) => (
        <li key={item.id}>
          <CatalogCard item={item} video={video} />
        </li>
      ))}
    </ul>
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
  const isContextualCatalog = kind !== "all" && Boolean(selectedSubject);
  const ContextKindIcon = kind === "all" ? Compass : kindIcons[kind];

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
  const contextualTopicGroups = useMemo(() => {
    if (!isContextualCatalog) return [];

    const selectedRegion = normalize(topic);
    const groups = new Map<string, { items: ContentItem[]; name: string }>();

    for (const item of visibleItems) {
      const regions = uniqueRegions(itemRegions(item));
      const groupRegions = regions.length > 0 ? regions : ["Otros"];

      for (const region of groupRegions) {
        if (selectedRegion && normalize(region) !== selectedRegion) continue;
        const key = normalize(region);
        const current = groups.get(key);
        if (current) current.items.push(item);
        else groups.set(key, { items: [item], name: region });
      }
    }

    return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name, "es"));
  }, [isContextualCatalog, topic, visibleItems]);

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
  const clearHref = isContextualCatalog
    ? catalogHref(kind, "", subjectSlug)
    : catalogHref("all", "", "");
  const hasFilters = kind !== "all" || Boolean(subjectSlug) || Boolean(topic) || Boolean(search);
  const shouldClearEmptyFilters = !isContextualCatalog || Boolean(search || topic);
  const emptyActionHref = shouldClearEmptyFilters
    ? clearHref
    : selectedSubject
      ? `/asignaturas/${selectedSubject.slug}`
      : clearHref;
  const contextualKindLabel = kind === "all" ? "material" : kindLabels[kind].toLocaleLowerCase("es");

  return (
    <AppShell
      activeKey={activeKey}
      isAdministrator={isAdministrator}
      headerTitle={title}
      headerSubtitle={selectedSubject?.name}
      mainClassName="content-catalog-main"
    >
      <section
        className={`content-catalog-page${isContextualCatalog ? " is-contextual" : ""}`}
        aria-label={title}
      >
        {kind === "all" && (
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
        )}

        {isContextualCatalog && selectedSubject && (
          <div className="content-catalog-context-navigation">
            <Link href={`/asignaturas/${selectedSubject.slug}`}>
              <ArrowLeft aria-hidden="true" size={16} />
              Volver a {selectedSubject.name}
            </Link>
            {topic && (
              <Link
                href={catalogHref(kind, "", subjectSlug)}
                onClick={(event) => navigateCatalog(event, catalogHref(kind, "", subjectSlug))}
                prefetch={false}
              >
                Ver todos los temas
              </Link>
            )}
          </div>
        )}

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

        {!selectedSubject && subjects.length > 0 && (
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
        {!isContextualCatalog && topics.length > 0 && (
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

        {visibleItems.length > 0 && isContextualCatalog && selectedSubject ? (
          <>
            {contextualTopicGroups.length > 1 && (
              <nav className="content-catalog-topic-browser" aria-labelledby="content-topic-browser-title">
                <div className="content-catalog-topic-browser-heading">
                  <div>
                    <span>Temas disponibles</span>
                    <h2 id="content-topic-browser-title">Explora por tema</h2>
                  </div>
                  <p>Ve directamente a la sección que quieres estudiar.</p>
                </div>
                <ul className="content-catalog-topic-directory">
                  {contextualTopicGroups.map((group) => (
                    <li key={group.name}>
                      <a className="content-catalog-topic-link" href={`#${topicAnchor(group.name)}`}>
                        <span className="content-catalog-topic-icon" aria-hidden="true">
                          <ContextKindIcon size={23} />
                        </span>
                        <span className="content-catalog-topic-copy">
                          <span className="content-catalog-topic-meta">
                            {group.items.length === 1 ? "1 recurso" : `${group.items.length} recursos`}
                          </span>
                          <strong>{group.name}</strong>
                          <p>Material de {selectedSubject.name} reunido en esta sección</p>
                        </span>
                        <span className="content-catalog-topic-action">
                          Ir a la sección <ArrowDown aria-hidden="true" size={15} />
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            <div className="content-catalog-topic-groups" id="content-catalog-results">
              {contextualTopicGroups.map((group) => {
                const headingId = `${topicAnchor(group.name)}-title`;
                return (
                  <section
                    className="content-catalog-topic-section"
                    id={topicAnchor(group.name)}
                    key={group.name}
                    aria-labelledby={headingId}
                  >
                    <header className="content-catalog-topic-section-heading">
                      <span className="content-catalog-topic-section-icon" aria-hidden="true">
                        <ContextKindIcon size={21} />
                      </span>
                      <div>
                        <span>{title} · {selectedSubject.name}</span>
                        <h2 id={headingId}>{group.name}</h2>
                      </div>
                      <small>{group.items.length === 1 ? "1 recurso" : `${group.items.length} recursos`}</small>
                    </header>
                    <CatalogGrid
                      items={group.items}
                      labelledBy={headingId}
                      video={kind === "video"}
                    />
                  </section>
                );
              })}
            </div>
          </>
        ) : visibleItems.length > 0 ? (
          <CatalogGrid id="content-catalog-results" items={visibleItems} video={kind === "video"} />
        ) : (
          <div className="content-catalog-empty" id="content-catalog-results" role="status">
            <Compass aria-hidden="true" size={38} />
            <h2>
              {available
                ? isContextualCatalog
                  ? `No encontramos ${contextualKindLabel}`
                  : "No encontramos contenido"
                : "La biblioteca no está disponible"}
            </h2>
            <p>
              {available
                ? isContextualCatalog
                  ? search || topic
                    ? "Prueba con otra búsqueda o revisa todos los temas."
                    : `Aún no hay ${contextualKindLabel} disponibles en esta asignatura.`
                  : "Prueba con otros filtros."
                : "Intenta de nuevo en unos minutos."}
            </p>
            {hasFilters && (
              <Link
                className="content-catalog-clear-filters"
                href={emptyActionHref}
                onClick={shouldClearEmptyFilters
                  ? (event) => {
                      if (navigateCatalog(event, clearHref)) setSearch("");
                    }
                  : undefined}
                prefetch={false}
              >
                {isContextualCatalog
                  ? search || topic
                    ? "Ver todos los temas"
                    : `Volver a ${selectedSubject?.name ?? "la asignatura"}`
                  : "Limpiar filtros"}
              </Link>
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}
