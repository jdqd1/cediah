import Image from "next/image";
import Link from "next/link";
import {
  BookmarkSimple,
  BookOpen,
  CaretRight,
  DotsNine,
  FilePdf,
  Star,
} from "@phosphor-icons/react/dist/ssr";
import type { ContentItem } from "@cediah/contracts";
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

function guideImage(index: number) {
  return guideImages[index % guideImages.length]!;
}

function guideExtent(guide: GuideItem) {
  if (guide.content.sections.length > 0) {
    return guide.content.sections.length + (guide.content.sections.length === 1 ? " sección" : " secciones");
  }
  if (guide.asset?.mimeType === "application/pdf") return "Documento PDF";
  return guide.estimatedMinutes ? guide.estimatedMinutes + " min" : "Lectura";
}

export function GuideDashboardScreen({
  available,
  guides,
}: {
  available: boolean;
  guides: GuideItem[];
}) {
  const topics = Array.from(new Set(guides.map((guide) => guide.topic))).slice(0, 5);
  const recent = guides.slice(0, 3);
  const featured = [
    ...guides.filter((guide) => guide.featured),
    ...guides.filter((guide) => !guide.featured),
  ].slice(0, 4);

  return (
    <AppShell
      activeKey="guides"
      centeredSearch
      headerTitle="Guías de estudio"
      searchPlaceholder="Buscar guías por tema, región o palabra clave..."
      mainClassName="guides-main"
    >
      <div className="guides-top-grid">
        <section className="region-explorer panel-surface" aria-labelledby="region-title">
          <h2 id="region-title">Explorar por tema</h2>
          {topics.length > 0 ? (
            <div className="region-grid">
              {topics.map((topic) => (
                <Link
                  className="region-card"
                  href={"/biblioteca?tema=" + encodeURIComponent(topic)}
                  key={topic}
                >
                  <span className="region-icon">
                    <BookOpen size={32} weight="regular" />
                  </span>
                  <strong>{topic}</strong>
                  <small>{guides.filter((guide) => guide.topic === topic).length} guías</small>
                </Link>
              ))}
              <Link className="region-card" href="/biblioteca?tipo=guide">
                <span className="region-icon">
                  <DotsNine size={32} weight="regular" />
                </span>
                <strong>Ver todas</strong>
              </Link>
            </div>
          ) : (
            <div className="dynamic-empty-state compact" role="status">
              <BookOpen size={28} />
              <div>
                <strong>{available ? "Todavía no hay temas publicados." : "Catálogo no disponible."}</strong>
                <span>Los temas se crean automáticamente a partir de las guías aprobadas.</span>
              </div>
            </div>
          )}
        </section>

        <section className="continue-panel panel-surface" aria-labelledby="recent-guides-title">
          <div className="section-heading-row">
            <h2 id="recent-guides-title">Publicaciones recientes</h2>
            <Link href="/biblioteca?tipo=guide">Ver todo</Link>
          </div>
          <div className="continue-list">
            {recent.map((guide, index) => (
              <Link className="continue-row" href={guideHref(guide)} key={guide.id}>
                <span className="continue-image">
                  <Image src={guideImage(index)} alt="" fill sizes="54px" />
                </span>
                <span className="continue-copy">
                  <strong>{guide.title}</strong>
                  <small>{guide.topic}</small>
                </span>
                <span className="continue-progress">
                  <small>{guideExtent(guide)}</small>
                </span>
                <CaretRight className="continue-more" size={19} />
              </Link>
            ))}
            {recent.length === 0 && (
              <p className="dynamic-list-empty">Las nuevas guías publicadas aparecerán aquí.</p>
            )}
          </div>
        </section>
      </div>

      <section className="guide-section" aria-labelledby="featured-title">
        <div className="section-heading-row section-heading-with-icon">
          <div>
            <Star size={22} weight="regular" />
            <h2 id="featured-title">Guías destacadas</h2>
          </div>
          <Link href="/biblioteca?tipo=guide">Ver todas</Link>
        </div>
        {featured.length > 0 ? (
          <div className="featured-guide-row">
            {featured.map((guide, index) => (
              <Link className="featured-guide-card" href={guideHref(guide)} key={guide.id}>
                <span className="featured-guide-image">
                  <Image src={guideImage(index + 1)} alt="" fill sizes="90px" />
                </span>
                <span className="featured-guide-copy">
                  <strong>{guide.title}</strong>
                  <span>
                    <small>{guide.topic}</small>
                    <small>{guideExtent(guide)}</small>
                    <BookmarkSimple size={18} />
                  </span>
                </span>
              </Link>
            ))}
            <Link className="carousel-next" href="/biblioteca?tipo=guide" aria-label="Ver más guías">
              <CaretRight size={23} />
            </Link>
          </div>
        ) : (
          <p className="dynamic-list-empty">Coordinación puede marcar guías como destacadas al publicarlas.</p>
        )}
      </section>

      <section className="guide-section all-guides-section" aria-labelledby="all-guides-title">
        <div className="section-heading-row section-heading-with-icon">
          <div>
            <span className="section-title-icon">
              <BookOpen size={22} weight="regular" />
            </span>
            <h2 id="all-guides-title">Todas las guías</h2>
          </div>
        </div>
        <div className="guide-table panel-surface">
          <div className="guide-table-header">
            <span>Guía</span>
            <span>Tema</span>
            <span>Formato</span>
            <span>Extensión</span>
            <span />
          </div>
          {guides.map((guide, index) => (
            <Link className="guide-table-row" href={guideHref(guide)} key={guide.id}>
              <span className="guide-name-cell">
                <span className="guide-table-image">
                  <Image src={guideImage(index)} alt="" fill sizes="48px" />
                </span>
                <strong>{guide.title}</strong>
              </span>
              <span className="guide-region-cell">
                <BookOpen size={20} />
                {guide.topic}
              </span>
              <span>
                <small className="guide-type-pill">
                  {guide.asset?.mimeType === "application/pdf" ? "PDF" : "Web"}
                </small>
              </span>
              <span>{guideExtent(guide)}</span>
              {guide.asset?.mimeType === "application/pdf" ? (
                <FilePdf size={20} />
              ) : (
                <BookmarkSimple size={20} />
              )}
            </Link>
          ))}
          {guides.length === 0 && (
            <div className="dynamic-table-empty">
              {available
                ? "No hay guías publicadas todavía."
                : "No pudimos consultar las guías en este momento."}
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
