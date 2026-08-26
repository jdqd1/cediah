import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CediahLogo } from "@/components/cediah-logo";
import { demoCourses, getDemoLesson } from "@/data/demo-courses";

type LessonPageProps = {
  params: Promise<{ lessonSlug: string; slug: string }>;
};

export function generateStaticParams() {
  return demoCourses.map((course) => ({
    lessonSlug: "introduccion",
    slug: course.slug,
  }));
}

export async function generateMetadata({ params }: LessonPageProps): Promise<Metadata> {
  const { lessonSlug, slug } = await params;
  const lesson = getDemoLesson(slug, lessonSlug);

  if (!lesson) return { title: "Lección no encontrada | Koraz" };

  return {
    title: `${lesson.title} - Demo | Koraz`,
    description: lesson.summary,
  };
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { lessonSlug, slug } = await params;
  const lesson = getDemoLesson(slug, lessonSlug);

  if (!lesson) notFound();

  return (
    <main className="lesson-page">
      <div className="lesson-top">
        <header className="site-header course-header">
          <Link className="brand" href="/#inicio" aria-label="Koraz, inicio">
            <CediahLogo variant="light" />
          </Link>
          <nav aria-label="Navegación de la lección">
            <Link href={`/cursos/${lesson.course.slug}`}>Ficha del curso</Link>
            <Link href="/#cursos">Catálogo</Link>
            <Link className="nav-cta" href="/acceder">Acceder</Link>
          </nav>
        </header>

        <section className="lesson-hero" aria-labelledby="lesson-title">
          <div className="lesson-hero-copy">
            <p className="eyebrow">Demo educativa / {lesson.course.code}</p>
            <p className="lesson-breadcrumb">
              <Link href={`/cursos/${lesson.course.slug}`}>{lesson.course.title}</Link>
              <span aria-hidden="true"> / </span>
              {lesson.module}
            </p>
            <h1 id="lesson-title">{lesson.title}</h1>
            <p className="lesson-summary">{lesson.summary}</p>
            <div className="lesson-meta" aria-label="Metadatos de la lección">
              <span><strong>Duración demo</strong><time dateTime="PT12M">{lesson.duration}</time></span>
              <span><strong>Formato</strong>Video pendiente</span>
              <span><strong>Estado</strong>Preliminar</span>
            </div>
          </div>

          <aside className="lesson-status" role="status" aria-label="Estado del reproductor">
            <span className="lesson-status-dot" aria-hidden="true" />
            <div>
              <strong>Reproductor de demostración</strong>
              <p>El video real se habilitará cuando coordinación apruebe el contenido y el proveedor privado.</p>
            </div>
          </aside>
        </section>
      </div>

      <section className="lesson-workspace" aria-labelledby="workspace-title">
        <div className="lesson-video-column">
          <div className="lesson-video-shell" role="img" aria-label="Reproductor de video pendiente de configuración">
            <span className="lesson-video-index">VIDEO / DEMO</span>
            <span className="lesson-play" aria-hidden="true">▶</span>
            <p>Vista previa no disponible</p>
          </div>
          <div className="lesson-video-caption">
            <p>Contenido provisional</p>
            <span>Sin URL pública, descarga ni sesión de reproducción activa.</span>
          </div>
        </div>

        <aside className="lesson-outline" aria-labelledby="workspace-title">
          <p className="eyebrow dark">Temario preliminar</p>
          <h2 id="workspace-title">{lesson.module}</h2>
          <ol>
            {lesson.objectives.map((objective) => <li key={objective}>{objective}</li>)}
          </ol>
          <Link className="text-link" href={`/cursos/${lesson.course.slug}`}>
            Revisar la ficha del curso <span aria-hidden="true">→</span>
          </Link>
        </aside>
      </section>

      <section className="lesson-resources" aria-labelledby="resources-title">
        <div>
          <p className="eyebrow dark">Recursos de la lección</p>
          <h2 id="resources-title">Material pendiente de autorización.</h2>
          <p>La interfaz ya reserva este espacio para guías y materiales con acceso temporal.</p>
        </div>
        <div className="lesson-resource-row" aria-disabled="true">
          <span className="lesson-resource-icon" aria-hidden="true">↗</span>
          <div>
            <strong>{lesson.resourceTitle}</strong>
            <span>Archivo privado / todavía no publicado</span>
          </div>
          <span className="lesson-resource-state">Bloqueado</span>
        </div>
      </section>

      <section className="lesson-next" aria-labelledby="next-title">
        <div>
          <p className="eyebrow dark">Siguiente paso</p>
          <h2 id="next-title">La demostración termina aquí.</h2>
        </div>
        <p>El curso real se abrirá con una cuenta autorizada cuando existan contenido, matrícula y API pública verificables.</p>
        <Link className="button button-dark" href={`/acceder?next=/cursos/${lesson.course.slug}/lecciones/${lesson.lessonSlug}`}>
          Preparar acceso
        </Link>
      </section>

      <footer>
        <span>KORAZ</span>
        <p>Lección demostrativa - Fase 1 en desarrollo</p>
        <p>Caracas, Venezuela</p>
      </footer>
    </main>
  );
}
