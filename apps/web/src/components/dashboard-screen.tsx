import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CardsThree,
  CheckSquareOffset,
  PlayCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { ContentItem, ContentKind } from "@cediah/contracts";
import { publishedContentHref, subjectDirectoryHref } from "@/lib/content-navigation";
import { getGuideCatalog } from "@/lib/content-guide-links";
import { mostViewedFirst, newestContentFirst } from "@/lib/content-order";
import { formatVideoViews } from "@/lib/video-views";
import { AppShell } from "./app-shell";
import { BrandFooter } from "./brand-footer";

const kindImages: Record<ContentKind, string> = {
  flashcards: "/anatomy/thigh.png",
  guide: "/anatomy/guide-cover-default.png",
  quiz: "/anatomy/heart.png",
  topic: "/anatomy/skull.png",
  video: "/anatomy/video-cover-default.png",
};

function contentCover(item: ContentItem) {
  return item.kind === "video" && item.content.coverImageUrl
    ? item.content.coverImageUrl
    : kindImages[item.kind];
}

const materialDefinitions = [
  {
    description: "Clases y explicaciones",
    href: "/asignaturas?tipo=video",
    icon: PlayCircle,
    kind: "video" as const,
    title: "Videos",
  },
  {
    description: "Documentos y lecturas",
    href: "/guias",
    icon: BookOpen,
    kind: "guide" as const,
    title: "Guías",
  },
  {
    description: "Repasos rápidos",
    href: "/asignaturas?tipo=flashcards",
    icon: CardsThree,
    kind: "flashcards" as const,
    title: "Flashcards",
  },
  {
    description: "Evalúa tu conocimiento",
    href: "/asignaturas?tipo=quiz",
    icon: CheckSquareOffset,
    kind: "quiz" as const,
    title: "Cuestionarios",
  },
] as const;

function contentHref(item: ContentItem) {
  return publishedContentHref(item);
}

function formatDuration(item: ContentItem) {
  if (item.kind === "video" && item.content.durationSeconds) {
    const minutes = Math.max(1, Math.round(item.content.durationSeconds / 60));
    return minutes + " min";
  }
  if (item.estimatedMinutes) return item.estimatedMinutes + " min";
  return null;
}

function VideoCard({ item, eager = false }: { item: ContentItem & { kind: "video" }; eager?: boolean }) {
  const duration = formatDuration(item);

  return (
    <Link className="dashboard-video-card" href={contentHref(item)}>
      <div className="dashboard-video-media">
        <Image
          src={contentCover(item)}
          alt=""
          fill
          loading={eager ? "eager" : "lazy"}
          sizes="(max-width: 600px) 216px, (max-width: 1000px) 25vw, 20vw"
          unoptimized={Boolean(item.content.coverImageUrl)}
        />
        <span className="dashboard-video-shade" />
        <span className="dashboard-play-button" aria-hidden="true">
          <PlayCircle size={49} weight="thin" />
        </span>
        {duration && <span className="dashboard-video-duration">{duration}</span>}
      </div>
      <div className="dashboard-video-copy">
        <h3 title={item.title}>{item.title}</h3>
        <span className="dashboard-video-views">{formatVideoViews(item.viewCount)}</span>
      </div>
    </Link>
  );
}

export function DashboardScreen({
  available,
  items,
  highlightedItems = items,
  recentItems = items,
  isAdministrator = false,
  viewer,
}: {
  available: boolean;
  items: ContentItem[];
  highlightedItems?: ContentItem[];
  recentItems?: ContentItem[];
  isAdministrator?: boolean;
  viewer?: { email: string };
}) {
  const videos = recentItems
    .filter((item): item is ContentItem & { kind: "video" } => item.kind === "video")
    .sort(newestContentFirst)
    .slice(0, 4);
  const highlighted = highlightedItems
    .filter((item): item is ContentItem & { kind: "video" } => item.kind === "video")
    .sort(mostViewedFirst)
    .slice(0, 8);
  const guideCount = getGuideCatalog(items).length;

  return (
    <AppShell
      activeKey="dashboard"
      isAdministrator={isAdministrator}
      viewer={viewer}
      headerTitle=""
      mainClassName="dashboard-main"
    >
      <nav className="study-material-grid dashboard-shortcuts" aria-label="Accesos directos de estudio">
        {materialDefinitions.map(({ title, description, icon: Icon, kind, href }) => {
          const count = kind === "guide" ? guideCount : items.filter((item) => item.kind === kind).length;
          return (
            <Link className="study-material-card" href={href} key={kind}>
              <span className="study-material-icon" aria-hidden="true">
                <Icon size={22} weight="regular" />
              </span>
              <span className="study-material-copy">
                <strong>{title}</strong>
                <small>{count > 0 ? `${count} ${count === 1 ? "disponible" : "disponibles"}` : description}</small>
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="dashboard-layout">
        <div className="dashboard-primary">
          <section className="dashboard-section dashboard-recent" aria-labelledby="recent-title">
            <div className="section-heading-row">
              <h2 id="recent-title">Videos recientes</h2>
              <Link href={subjectDirectoryHref("video")}>
                Ver todo <ArrowRight size={17} />
              </Link>
            </div>
            {videos.length > 0 ? (
              <div className="dashboard-video-grid">
                {videos.map((item, index) => <VideoCard key={item.id} item={item} eager={index === 0} />)}
              </div>
            ) : (
              <div className="dynamic-empty-state" role="status">
                <PlayCircle size={30} />
                <div>
                  <strong>
                    {available ? "Aún no hay videos publicados." : "No pudimos cargar el catálogo."}
                  </strong>
                  <span>
                    {available
                      ? "Los videos aprobados aparecerán aquí automáticamente."
                      : "La interfaz sigue disponible; intenta actualizar en unos minutos."}
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="dashboard-most-viewed" aria-labelledby="featured-content-title">
          <div className="section-heading-row">
            <h2 id="featured-content-title">Destacados</h2>
            <Link href={subjectDirectoryHref("video")}>
              Ver todo <ArrowRight size={17} />
            </Link>
          </div>
          <div className="dashboard-featured-content">
            {highlighted.length > 0 ? (
              <ol className="most-viewed-list">
                {highlighted.map((item, index) => {
                  return (
                    <li key={item.id}>
                      <span className="most-viewed-rank">{index + 1}</span>
                      <Link href={contentHref(item)} className="most-viewed-link">
                        <span className="most-viewed-image">
                          <Image
                            src={contentCover(item)}
                            alt=""
                            fill
                            sizes="64px"
                            unoptimized={Boolean(item.kind === "video" && item.content.coverImageUrl)}
                          />
                        </span>
                        <span className="most-viewed-copy">
                          <strong title={item.title}>{item.title}</strong>
                          <small className="most-viewed-views">{formatVideoViews(item.viewCount)}</small>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="dynamic-aside-empty">
                Aquí aparecerán los videos más vistos.
              </p>
            )}
          </div>
        </aside>
      </div>

      <BrandFooter />
    </AppShell>
  );
}
