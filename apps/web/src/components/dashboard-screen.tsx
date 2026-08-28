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
  return null;
}

function VideoCard({ item }: { item: ContentItem & { kind: "video" } }) {
  const duration = formatDuration(item);

  return (
    <Link className="modern-card" href={contentHref(item)}>
      <div className="modern-video-thumb">
        <Image
          src={kindImages.video}
          alt=""
          fill
          sizes="(max-width: 900px) 80vw, 28vw"
        />
        <div className="modern-play-overlay">
          <PlayCircle size={48} weight="fill" />
        </div>
        {duration && <span className="modern-duration">{duration}</span>}
      </div>
      <div className="modern-card-content">
        <h3 className="modern-card-title">{item.title}</h3>
        <p className="modern-card-desc">{item.summary}</p>
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

  const firstName = viewer?.email.split('@')[0] || 'Estudiante';
  const capitalizedName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  return (
    <AppShell
      activeKey="dashboard"
      canManageContent={canManageContent}
      canManageRoles={isAdministrator}
      isAdministrator={isAdministrator}
      viewer={viewer}
      headerTitle=""
      mainClassName="modern-main"
    >
      <div className="modern-welcome">
        <h1>¡Hola, {capitalizedName}!</h1>
        <p>¿Qué te gustaría aprender hoy?</p>
      </div>

      <div className="modern-dashboard-grid">
        <div className="modern-dashboard-primary">
          <section className="modern-section" aria-labelledby="recent-title">
            <div className="modern-section-header">
              <h2 className="modern-section-title" id="recent-title">Videos recientes</h2>
              <Link className="modern-link-all" href={subjectDirectoryHref("video")}>
                Ver todo <ArrowRight size={17} />
              </Link>
            </div>
            {videos.length > 0 ? (
              <div className="modern-video-grid">
                {videos.map((item) => <VideoCard key={item.id} item={item} />)}
              </div>
            ) : (
              <div className="modern-card" style={{ padding: '32px', textAlign: 'center', alignItems: 'center' }}>
                <PlayCircle size={48} color="var(--modern-text-secondary)" />
                <h3 style={{ marginTop: '16px', marginBottom: '8px' }}>
                  {available ? "Aún no hay videos publicados." : "No pudimos cargar el catálogo."}
                </h3>
                <p style={{ color: 'var(--modern-text-secondary)', margin: 0 }}>
                  {available
                    ? "Los videos aprobados aparecerán aquí automáticamente."
                    : "La interfaz sigue disponible; intenta actualizar en unos minutos."}
                </p>
              </div>
            )}
          </section>

          <section className="modern-section" aria-labelledby="materials-title">
            <div className="modern-section-header">
              <h2 className="modern-section-title" id="materials-title">Material de estudio</h2>
              <Link className="modern-link-all" href="/asignaturas">
                Explorar materias <ArrowRight size={17} />
              </Link>
            </div>
            <div className="modern-bento-grid">
              {materialDefinitions.map(({ title, description, icon: Icon, kind, href }) => {
                const count = items.filter((item) => item.kind === kind).length;
                return (
                  <Link className="modern-bento-card" href={href} key={kind}>
                    <div className="modern-bento-icon">
                      <Icon size={24} weight="bold" />
                    </div>
                    <div>
                      <h3>{title}</h3>
                      <p>{count > 0 ? count + " publicados" : description}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="modern-aside" aria-labelledby="featured-content-title">
          <div className="modern-section-header" style={{ marginBottom: '16px' }}>
            <h2 className="modern-section-title" id="featured-content-title" style={{ fontSize: '1.125rem' }}>Destacados</h2>
          </div>
          <div>
            {highlighted.length > 0 ? (
              <ol className="modern-list">
                {highlighted.map((item, index) => {
                  const duration = formatDuration(item);
                  return (
                    <li className="modern-list-item" key={item.id}>
                      <span className="modern-list-rank">{index + 1}</span>
                      <Link href={contentHref(item)} className="modern-list-link">
                        <span className="modern-list-img">
                          <Image src={kindImages[item.kind]} alt="" fill sizes="48px" />
                        </span>
                        <span className="modern-list-copy">
                          <strong>{item.title}</strong>
                          <small>
                            {item.topic} · {kindLabels[item.kind]}
                            {duration ? ` · ${duration}` : ""}
                          </small>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p style={{ color: 'var(--modern-text-secondary)', fontSize: '0.875rem' }}>
                La selección destacada se llenará desde el panel editorial.
              </p>
            )}
          </div>
        </aside>
      </div>

      <BrandFooter />
    </AppShell>
  );
}
