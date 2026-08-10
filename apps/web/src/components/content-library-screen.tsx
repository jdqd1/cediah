"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  CardsThree,
  ClipboardText,
  Clock,
  Compass,
  MagnifyingGlass,
  PlayCircle,
} from "@phosphor-icons/react";
import type { ContentItem, ContentKind } from "@cediah/contracts";
import { useMemo, useState } from "react";
import { AppShell } from "./app-shell";

const kindLabels: Record<ContentKind, string> = {
  flashcards: "Flashcards",
  guide: "Guías",
  quiz: "Cuestionarios",
  topic: "Temas",
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

function itemHref(item: ContentItem) {
  return item.kind === "guide"
    ? "/guias/" + item.slug
    : "/biblioteca/" + item.slug;
}

export function ContentLibraryScreen({
  available,
  initialKind,
  initialTopic,
  items,
}: {
  available: boolean;
  initialKind?: ContentKind;
  initialTopic?: string;
  items: ContentItem[];
}) {
  const [kind, setKind] = useState<ContentKind | "all">(initialKind ?? "all");
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState(initialTopic ?? "");
  const topics = useMemo(
    () => Array.from(new Set(items.map((item) => item.topic))).sort(),
    [items],
  );
  const visibleItems = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("es");
    return items.filter((item) => {
      const matchesKind = kind === "all" || item.kind === kind;
      const matchesTopic = !topic || item.topic === topic;
      const matchesSearch =
        !normalized ||
        (item.title + " " + item.summary + " " + item.topic)
          .toLocaleLowerCase("es")
          .includes(normalized);
      return matchesKind && matchesTopic && matchesSearch;
    });
  }, [items, kind, search, topic]);

  return (
    <AppShell
      activeKey={kind === "all" ? "study" : kind}
      centeredSearch
      headerTitle="Biblioteca"
      searchPlaceholder="Buscar en toda la biblioteca..."
      mainClassName="library-main"
    >
      <section className="library-toolbar" aria-labelledby="library-title">
        <div>
          <p className="eyebrow dark">Contenido publicado</p>
          <h2 id="library-title">Biblioteca académica</h2>
          <p>Videos, guías y herramientas de estudio revisadas por CEDIAH.</p>
        </div>
        <label className="library-inline-search">
          <MagnifyingGlass size={20} />
          <input
            aria-label="Buscar contenido"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Título, resumen o tema"
            type="search"
            value={search}
          />
        </label>
      </section>

      <div className="library-filter-row">
        <div className="library-kind-tabs" role="tablist" aria-label="Filtrar por formato">
          <button
            className={kind === "all" ? "is-active" : ""}
            onClick={() => setKind("all")}
            role="tab"
            aria-selected={kind === "all"}
            type="button"
          >
            Todos <span>{items.length}</span>
          </button>
          {(Object.keys(kindLabels) as ContentKind[]).map((value) => {
            const Icon = kindIcons[value];
            return (
              <button
                className={kind === value ? "is-active" : ""}
                key={value}
                onClick={() => setKind(value)}
                role="tab"
                aria-selected={kind === value}
                type="button"
              >
                <Icon size={18} />
                {kindLabels[value]}
                <span>{items.filter((item) => item.kind === value).length}</span>
              </button>
            );
          })}
        </div>
        <label className="library-topic-filter">
          <span>Tema</span>
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            <option value="">Todos los temas</option>
            {topics.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>

      {visibleItems.length > 0 ? (
        <div className="library-list">
          {visibleItems.map((item) => {
            const Icon = kindIcons[item.kind];
            return (
              <Link className="library-row" href={itemHref(item)} key={item.id}>
                <span className="library-row-image">
                  <Image src={kindImages[item.kind]} alt="" fill sizes="150px" />
                  <span><Icon size={24} /></span>
                </span>
                <span className="library-row-copy">
                  <span className="library-row-meta">
                    <small>{kindLabels[item.kind]}</small>
                    <small>{item.topic}</small>
                    {item.featured && <small className="is-featured">Destacado</small>}
                  </span>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </span>
                <span className="library-row-duration">
                  <Clock size={17} />
                  {item.estimatedMinutes ? item.estimatedMinutes + " min" : "A tu ritmo"}
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="library-empty-state" role="status">
          <Compass size={42} />
          <h3>
            {available
              ? "No hay publicaciones que coincidan con estos filtros."
              : "La biblioteca no está disponible en este momento."}
          </h3>
          <p>
            {available
              ? "Prueba otro tipo, tema o palabra clave."
              : "Intenta actualizar la página dentro de unos minutos."}
          </p>
          {(search || topic || kind !== "all") && (
            <button
              type="button"
              onClick={() => {
                setKind("all");
                setSearch("");
                setTopic("");
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </AppShell>
  );
}
