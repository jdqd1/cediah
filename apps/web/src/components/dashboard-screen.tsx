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
import { AppShell } from "./app-shell";
import { BrandFooter } from "./brand-footer";

const kindLabels: Record<ContentKind, string> = {
  flashcards: "Flashcards",
  guide: "Guía",
  quiz: "Cuestionario",
  topic: "Tema",
  video: "Video",
};

const kindImages: Record<ContentKind, string> = {
  flashcards: "/anatomy/thigh.png",
  guide: "/anatomy/back-muscles.png",
  quiz: "/anatomy/heart.png",
  topic: "/anatomy/skull.png",
  video: "/anatomy/neck-muscles.png",
};

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
  return kindLabels[item.kind];
}

function VideoCard({ item }: { item: ContentItem & { kind: "video" } }) {
  return (
    <Link className="dashboard-video-card" href={contentHref(item)}>
      <div className="dashboard-video-media">
        <Image
          src={kindImages.video}
          alt=""
          fill
          sizes="(max-width: 900px) 80vw, 28vw"
        />
        <span className="dashboard-video-shade" />
        <span className="dashboard-play-button" aria-hidden="true">
          <PlayCircle size={49} weight="thin" />
        </span>
        <span className="dashboard-video-duration">{formatDuration(item)}</span>
      </div>
      <div className="dashboard-video-copy">
        <h3>{item.title}</h3>
        <p>{item.topic}</p>
        <span className="dynamic-content-summary">{item.summary}</span>
      </div>
    </Link>
  );
}

export function DashboardScreen({
  available,
  canManageContent = false,
  items,
  isAdministrator = false,
  viewer,
}: {
  available: boolean;
  canManageContent?: boolean;
  items: ContentItem[];
  isAdministrator?: boolean;
  viewer?: { email: string };
}) {
  const videos = items
    .filter((item): item is ContentItem & { kind: "video" } => item.kind === "video")
    .slice(0, 3);
  const highlighted = [
    ...items.filter((item) => item.featured),
    ...items.filter((item) => !item.featured),
  ].slice(0, 8);

  return (
    <AppShell
      activeKey="dashboard"
      canManageContent={canManageContent}
      canManageRoles={isAdministrator}
      isAdministrator={isAdministrator}
      viewer={viewer}
      headerTitle=""
      mainClassName="dashboard-main"
    >
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
                {videos.map((item) => <VideoCard key={item.id} item={item} />)}
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

          <section className="dashboard-section dashboard-materials" aria-labelledby="materials-title">
            <div className="section-heading-row">
              <h2 id="materials-title">Material de estudio</h2>
              <Link href="/asignaturas">
                Explorar asignaturas <ArrowRight size={17} />
              </Link>
            </div>
            <div className="study-material-grid">
              {materialDefinitions.map(({ title, description, icon: Icon, kind, href }) => {
                const count = items.filter((item) => item.kind === kind).length;
                return (
                  <Link className="study-material-card" href={href} key={kind}>
                    <Image src={kindImages[kind]} alt="" fill sizes="200px" />
                    <span className="study-material-wash" />
                    <span className="study-material-icon">
                      <Icon size={31} weight="regular" />
                    </span>
                    <span className="study-material-copy">
                      <strong>{title}</strong>
                      <small>{count > 0 ? count + " publicados" : description}</small>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

        </div>

        <aside className="dashboard-most-viewed" aria-labelledby="featured-content-title">
          <div className="section-heading-row">
            <h2 id="featured-content-title">Destacados</h2>
            <Link href="/asignaturas">
              Ver todo <ArrowRight size={17} />
            </Link>
          </div>
          {highlighted.length > 0 ? (
            <ol className="most-viewed-list">
              {highlighted.map((item, index) => (
                <li key={item.id}>
                  <span className="most-viewed-rank">{index + 1}</span>
                  <Link href={contentHref(item)} className="most-viewed-link">
                    <span className="most-viewed-image">
                      <Image src={kindImages[item.kind]} alt="" fill sizes="100px" />
                    </span>
                    <span className="most-viewed-copy">
                      <strong>{item.title}</strong>
                      <small>{item.topic}</small>
                      <small>{kindLabels[item.kind]} · {formatDuration(item)}</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="dynamic-aside-empty">
              La selección destacada se llenará desde el panel editorial.
            </p>
          )}
        </aside>
      </div>

      <BrandFooter />
    </AppShell>
  );
}
