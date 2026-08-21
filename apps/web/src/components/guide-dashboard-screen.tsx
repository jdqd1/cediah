"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  FilePdf,
  MagnifyingGlass,
  Star,
  X,
} from "@phosphor-icons/react";
import type { ContentItem } from "@cediah/contracts";
import { useMemo, useState } from "react";
import { uniqueRegions } from "@/lib/content-regions";
import { AppShell } from "./app-shell";

type GuideItem = ContentItem & { kind: "guide" };

const guideImages = [
  "/anatomy/skull-light.png",
  "/anatomy/heart-light.png",
  "/anatomy/back-light.png",
  "/anatomy/intestines.png",
  "/anatomy/thigh-light.png",
] as const;

function guideHref(guide: GuideItem) {
  return "/guias/" + guide.slug;
}

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

function guideRegions(guide: GuideItem) {
  return guide.content.regions.length > 0 ? guide.content.regions : [guide.topic];
}

function sectionCount(guide: GuideItem) {
  const count = guide.content.sections.length;
  if (count === 0) return null;
  return `${count} ${count === 1 ? "sección" : "secciones"}`;
}

export function GuideDashboardScreen({
  available,
  guides,
  isAdministrator = false,
}: {
  available: boolean;
  guides: GuideItem[];
  isAdministrator?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("");
  const topics = useMemo(
    () =>
      uniqueRegions(guides.flatMap(guideRegions)).sort((left, right) =>
        left.localeCompare(right, "es"),
      ),
    [guides],
  );
  const visibleGuides = useMemo(() => {
    const search = normalize(query.trim());
    const selectedRegion = normalize(topic);

    return guides.filter((guide) => {
      const regions = guideRegions(guide);
      const matchesTopic =
        !selectedRegion || regions.some((region) => normalize(region) === selectedRegion);
      const matchesSearch =
        !search ||
        normalize(`${guide.title} ${guide.summary} ${guide.topic} ${regions.join(" ")}`).includes(search);
      return matchesTopic && matchesSearch;
    });
  }, [guides, query, topic]);
  const hasFilters = Boolean(query.trim() || topic);

  function clearFilters() {
    setQuery("");
    setTopic("");
  }

  return (
    <AppShell
      activeKey="guides"
      isAdministrator={isAdministrator}
      headerTitle="Guías de estudio"
      mainClassName="guide-catalog-main"
    >
      <section className="guide-catalog" aria-labelledby="guide-catalog-title">
        <header className="guide-catalog-header">
          <div className="guide-catalog-heading">
            <span className="guide-catalog-heading-icon" aria-hidden="true">
              <BookOpen size={24} weight="duotone" />
            </span>
            <div>
              <h2 id="guide-catalog-title">Guías de estudio</h2>
              <span className="guide-catalog-total">
                {guides.length} {guides.length === 1 ? "guía publicada" : "guías publicadas"}
              </span>
            </div>
          </div>
        </header>

        <div className="guide-catalog-filters" role="search" aria-label="Buscar y filtrar guías">
          <label className="guide-catalog-search" htmlFor="guide-catalog-search">
            <span>Buscar</span>
            <span className="guide-catalog-search-control">
              <MagnifyingGlass size={19} aria-hidden="true" />
              <input
                id="guide-catalog-search"
                type="search"
                placeholder="Título, región o palabra clave"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </span>
          </label>

          <label className="guide-catalog-topic" htmlFor="guide-catalog-topic">
            <span>Región o tema</span>
            <select
              id="guide-catalog-topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            >
              <option value="">Todos</option>
              {topics.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          {hasFilters && (
            <button className="guide-catalog-clear" type="button" onClick={clearFilters}>
              <X size={17} aria-hidden="true" />
              Limpiar
            </button>
          )}
        </div>

        <div className="guide-catalog-results-heading">
          <h3>{topic || "Todas las guías"}</h3>
          <span aria-live="polite">
            {visibleGuides.length} {visibleGuides.length === 1 ? "resultado" : "resultados"}
          </span>
        </div>

        {visibleGuides.length > 0 ? (
          <ul className="guide-catalog-grid">
            {visibleGuides.map((guide) => {
              const sections = sectionCount(guide);
              const isPdf = guide.asset?.mimeType === "application/pdf";

              return (
                <li className="guide-catalog-item" key={guide.id}>
                  <Link className="guide-catalog-card" href={guideHref(guide)}>
                    <span className="guide-catalog-card-media">
                      <Image
                        src={guideImage(guide)}
                        alt=""
                        fill
                        sizes="(max-width: 720px) 100vw, (max-width: 1180px) 50vw, 33vw"
                      />
                      {guide.featured && (
                        <span className="guide-catalog-featured">
                          <Star size={14} weight="fill" aria-hidden="true" />
                          Destacada
                        </span>
                      )}
                    </span>

                    <span className="guide-catalog-card-body">
                      <span className="guide-catalog-card-meta">
                        <span>{guide.topic}</span>
                        <span>
                          {isPdf ? (
                            <FilePdf size={16} aria-hidden="true" />
                          ) : (
                            <BookOpen size={16} aria-hidden="true" />
                          )}
                          {isPdf ? "PDF" : "Lectura web"}
                        </span>
                      </span>
                      <strong>{guide.title}</strong>
                      <span className="guide-catalog-card-summary">{guide.summary}</span>
                      <span className="guide-catalog-card-footer">
                        <span>{sections ?? (isPdf ? "Documento" : "Guía")}</span>
                        <span className="guide-catalog-card-action">
                          Abrir guía
                          <ArrowRight size={17} aria-hidden="true" />
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="guide-catalog-empty" role="status">
            <BookOpen size={36} aria-hidden="true" />
            <h3>
              {hasFilters
                ? "No encontramos guías con esos filtros."
                : available
                  ? "Aún no hay guías publicadas."
                  : "No pudimos cargar las guías."}
            </h3>
            {hasFilters && (
              <button type="button" onClick={clearFilters}>
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}
