import Image from "next/image";
import Link from "next/link";
import { SystemStatus } from "@/components/system-status";
import { demoCourses } from "@/data/demo-courses";

const foundations = [
  ["01", "Teoría a tu ritmo", "Ponencias breves, ordenadas por región anatómica y disponibles desde cualquier dispositivo."],
  ["02", "Práctica con contexto", "Cada recorrido digital prepara la observación y el trabajo presencial en la Facultad de Medicina."],
  ["03", "Progreso verificable", "Evaluaciones, recursos y certificados formarán una ruta académica clara y auditable."],
] as const;

const videoFlow = [
  ["01", "Cargar", "El ponente solicitará una URL temporal sin recibir claves del proveedor."],
  ["02", "Procesar", "La plataforma mostrará el estado real: cargando, procesando, listo o error."],
  ["03", "Publicar", "Solo coordinación podrá aprobar la lección y habilitar su reproducción protegida."],
] as const;

export default function Home() {
  return (
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <header className="site-header">
          <a className="brand" href="#inicio" aria-label="CEDIAH, inicio">
            <span className="brand-mark" aria-hidden="true">C</span>
            <span>CEDIAH</span>
          </a>
          <nav aria-label="Navegación principal">
            <a href="#modelo">Modelo</a>
            <a href="#cursos">Cursos</a>
            <a href="#video">Tecnología</a>
            <a className="nav-cta" href="#cursos">Ver cursos</a>
          </nav>
        </header>

        <div className="hero-grid" id="inicio">
          <div className="hero-copy">
            <p className="eyebrow">Comunidad estudiantil de anatomía humana</p>
            <h1 id="hero-title">Comprender antes de entrar al anfiteatro.</h1>
            <p className="hero-lede">
              Una experiencia semivirtual que une estudio guiado, recursos activos y práctica anatómica presencial.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#cursos">Explorar cursos</a>
              <SystemStatus />
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <span className="plate-label">LAMINA 01 / TORSO</span>
            <Image
              src="/anatomy-torso.svg"
              alt=""
              width={760}
              height={980}
              priority
            />
            <span className="annotation annotation-a">Plano anterior</span>
            <span className="annotation annotation-b">Estudio por regiones</span>
          </div>
        </div>

        <p className="hero-footnote">Producto en construcción - identidad visual provisional</p>
      </section>

      <section className="model" id="modelo" aria-labelledby="model-title">
        <div className="section-index">01 / MODELO</div>
        <div className="model-copy">
          <p className="eyebrow dark">Aprendizaje conectado</p>
          <h2 id="model-title">La teoria prepara la mirada. La practica la convierte en criterio.</h2>
        </div>
        <div className="model-sequence" aria-label="Secuencia del modelo educativo">
          <div><span>Antes</span><strong>Videos y guías</strong></div>
          <div><span>Durante</span><strong>Práctica presencial</strong></div>
          <div><span>Después</span><strong>Repaso y evaluación</strong></div>
        </div>
      </section>

      <section className="catalog" id="cursos" aria-labelledby="catalog-title">
        <div className="catalog-intro">
          <div className="section-index">02 / CATÁLOGO DEMO</div>
          <p className="eyebrow dark">Recorridos por región</p>
          <h2 id="catalog-title">Ocho regiones. Un mismo estándar.</h2>
          <p>
            Este catálogo usa contenido de demostración para validar la navegación y la propuesta. Los programas,
            docentes, duraciones y lecciones definitivos se cargarán después de la aprobación de CEDIAH.
          </p>
        </div>

        <div className="course-list" aria-label="Cursos de demostración">
          {demoCourses.map((course, index) => (
            <article className="course-row" key={course.code}>
              <Link
                className="course-row-link"
                href={`/cursos/${course.slug}`}
                aria-label={`Ver ficha de demostración de ${course.title}`}
              >
                <span className="course-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <div className="course-title">
                  <p>{course.region}</p>
                  <h3>{course.title}</h3>
                </div>
                <div className="course-detail">
                  <p>{course.summary}</p>
                  <dl>
                    <div><dt>Módulos</dt><dd>{course.modules}</dd></div>
                    <div><dt>Lecciones</dt><dd>{course.lessons}</dd></div>
                    <div><dt>Duración demo</dt><dd>{course.duration}</dd></div>
                  </dl>
                </div>
                <span className="course-state">Ver ficha demo</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="video-readiness" id="video" aria-labelledby="video-title">
        <div className="video-intro">
          <div className="section-index light">03 / VIDEO</div>
          <p className="eyebrow">Preparado para la siguiente fase</p>
          <h2 id="video-title">La carga llegará con permisos, no con atajos.</h2>
          <p>
            La base técnica ya separa el proveedor de video del resto del producto para poder empezar con un servicio
            de pruebas y migrarlo más adelante sin rehacer los cursos.
          </p>
        </div>

        <div className="video-flow">
          {videoFlow.map(([number, title, description]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
          <p className="video-note">
            <strong>Estado actual:</strong> la carga está deshabilitada hasta implementar autenticación, permisos
            editoriales y un adaptador de video. Así evitamos publicar un formulario inseguro o engañoso.
          </p>
        </div>
      </section>

      <section className="foundations" id="fundamentos" aria-labelledby="foundation-title">
        <div className="foundations-intro">
          <div className="section-index light">04 / FUNDAMENTOS</div>
          <h2 id="foundation-title">Una base sobria para un aprendizaje exigente.</h2>
          <p>La primera fase asegura velocidad, seguridad y portabilidad antes de incorporar el contenido real.</p>
        </div>
        <div className="foundation-list">
          {foundations.map(([number, title, description]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pilot" id="piloto" aria-labelledby="pilot-title">
        <div>
          <p className="eyebrow dark">05 / SIGUIENTE HITO</p>
          <h2 id="pilot-title">Del catálogo visible a un curso completo.</h2>
        </div>
        <p>
          Con CEDIAH elegiremos una región y la convertiremos en el recorrido vertical: lecciones, video protegido,
          guía, evaluación, práctica presencial y certificado verificable.
        </p>
        <a className="button button-dark" href="#cursos">
          Revisar catálogo
        </a>
      </section>

      <footer>
        <span>CEDIAH</span>
        <p>Plataforma educativa de anatomía - Fase 1 en desarrollo</p>
        <p>Caracas, Venezuela</p>
      </footer>
    </main>
  );
}
