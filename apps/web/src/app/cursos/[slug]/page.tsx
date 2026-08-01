import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { demoCourses, getDemoCourse } from "@/data/demo-courses";

const plannedJourney = [
  {
    number: "01",
    title: "Definición académica",
    description: "Programa, objetivos, docentes y autorización de uso aportados y aprobados por CEDIAH.",
  },
  {
    number: "02",
    title: "Experiencia de estudio",
    description: "Dos lecciones iniciales, video protegido y guía descargable con contenidos reales.",
  },
  {
    number: "03",
    title: "Cierre verificable",
    description: "Preguntas, flashcards, práctica presencial y reglas de certificado definidas por coordinación.",
  },
] as const;

type CoursePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return demoCourses.map((course) => ({ slug: course.slug }));
}

export async function generateMetadata({ params }: CoursePageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = getDemoCourse(slug);

  if (!course) {
    return { title: "Curso no encontrado | CEDIAH" };
  }

  return {
    title: `${course.title} - Catálogo demo | CEDIAH`,
    description: `Ficha de demostración del recorrido de ${course.title} en CEDIAH.`,
  };
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { slug } = await params;
  const course = getDemoCourse(slug);

  if (!course) {
    notFound();
  }

  return (
    <main className="course-page">
      <div className="course-top">
        <header className="site-header course-header">
          <Link className="brand" href="/#inicio" aria-label="CEDIAH, inicio">
            <span className="brand-mark" aria-hidden="true">C</span>
            <span>CEDIAH</span>
          </Link>
          <nav aria-label="Navegación del curso">
            <Link href="/#modelo">Modelo</Link>
            <Link href="/#cursos">Catálogo</Link>
            <Link className="nav-cta" href="/#cursos">Cambiar curso</Link>
          </nav>
        </header>

        <section className="course-hero" aria-labelledby="course-title">
          <div className="course-hero-copy">
            <p className="eyebrow">Catálogo demo / {course.code}</p>
            <h1 id="course-title">{course.title}</h1>
            <p className="course-summary">{course.summary}</p>
            <div className="course-hero-actions">
              <Link className="button button-primary" href="/#cursos">Volver al catálogo</Link>
              <span className="course-pending">Contenido por aprobar</span>
            </div>
          </div>

          <div className="course-plate" aria-hidden="true">
            <span className="plate-label">FICHA PRELIMINAR / {course.code}</span>
            <Image src="/anatomy-torso.svg" alt="" width={760} height={980} priority />
            <span className="annotation annotation-a">{course.region}</span>
            <span className="annotation annotation-b">Vista de demostración</span>
          </div>
        </section>
      </div>

      <section className="course-overview" aria-labelledby="overview-title">
        <div>
          <div className="section-index">01 / ALCANCE</div>
          <p className="eyebrow dark">Estructura provisional</p>
          <h2 id="overview-title">Una ficha útil sin presentar supuestos como hechos.</h2>
        </div>
        <div className="course-overview-body">
          <p>
            Esta página valida la navegación y la jerarquía del futuro curso. Las cifras son datos de interfaz para la
            demostración; CEDIAH todavía debe confirmar el programa, docentes, duración y materiales definitivos.
          </p>
          <dl aria-label="Datos de demostración del curso">
            <div><dt>Región</dt><dd>{course.region}</dd></div>
            <div><dt>Módulos demo</dt><dd>{course.modules}</dd></div>
            <div><dt>Lecciones demo</dt><dd>{course.lessons}</dd></div>
            <div><dt>Duración demo</dt><dd>{course.duration}</dd></div>
          </dl>
        </div>
      </section>

      <section className="course-plan" aria-labelledby="plan-title">
        <div className="course-plan-intro">
          <div className="section-index light">02 / RECORRIDO PREVISTO</div>
          <p className="eyebrow">Paquete mínimo para el piloto</p>
          <h2 id="plan-title">Del esquema al curso vertical.</h2>
          <p>La producción real comenzará cuando coordinación seleccione la región y entregue estos insumos.</p>
        </div>
        <div className="course-plan-list">
          {plannedJourney.map((item) => (
            <article key={item.number}>
              <span>{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
          <p className="video-note">
            <strong>Estado actual:</strong> no hay videos, matrículas ni materiales académicos publicados. La carga
            permanecerá deshabilitada hasta contar con permisos editoriales y un proveedor de pruebas configurado.
          </p>
        </div>
      </section>

      <section className="course-decision" aria-labelledby="decision-title">
        <div>
          <p className="eyebrow dark">03 / DECISIÓN PENDIENTE</p>
          <h2 id="decision-title">¿Será {course.title} el primer recorrido completo?</h2>
        </div>
        <p>
          Seleccionarlo requiere confirmación de coordinación y permiso de uso del contenido. Mientras tanto, esta
          ficha queda lista para recibir información aprobada sin rehacer la navegación.
        </p>
        <Link className="button button-dark" href="/#cursos">Comparar regiones</Link>
      </section>

      <footer>
        <span>CEDIAH</span>
        <p>Ficha de curso demostrativa - Fase 1 en desarrollo</p>
        <p>Caracas, Venezuela</p>
      </footer>
    </main>
  );
}
