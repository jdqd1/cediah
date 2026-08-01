import Image from "next/image";
import { SystemStatus } from "@/components/system-status";

const foundations = [
  ["01", "Teoria a tu ritmo", "Ponencias breves, ordenadas por region anatomica y disponibles desde cualquier dispositivo."],
  ["02", "Practica con contexto", "Cada recorrido digital prepara la observacion y el trabajo presencial en la Facultad de Medicina."],
  ["03", "Progreso verificable", "Evaluaciones, recursos y certificados formaran una ruta academica clara y auditable."],
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
          <nav aria-label="Navegacion principal">
            <a href="#modelo">Modelo</a>
            <a href="#fundamentos">Fundamentos</a>
            <a className="nav-cta" href="#piloto">Curso piloto</a>
          </nav>
        </header>

        <div className="hero-grid" id="inicio">
          <div className="hero-copy">
            <p className="eyebrow">Comunidad estudiantil de anatomia humana</p>
            <h1 id="hero-title">Comprender antes de entrar al anfiteatro.</h1>
            <p className="hero-lede">
              Una experiencia semivirtual que une estudio guiado, recursos activos y practica anatomica presencial.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#modelo">Conocer el modelo</a>
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

        <p className="hero-footnote">Producto en construccion - identidad visual provisional</p>
      </section>

      <section className="model" id="modelo" aria-labelledby="model-title">
        <div className="section-index">01 / MODELO</div>
        <div className="model-copy">
          <p className="eyebrow dark">Aprendizaje conectado</p>
          <h2 id="model-title">La teoria prepara la mirada. La practica la convierte en criterio.</h2>
        </div>
        <div className="model-sequence" aria-label="Secuencia del modelo educativo">
          <div><span>Antes</span><strong>Videos y guias</strong></div>
          <div><span>Durante</span><strong>Practica presencial</strong></div>
          <div><span>Despues</span><strong>Repaso y evaluacion</strong></div>
        </div>
      </section>

      <section className="foundations" id="fundamentos" aria-labelledby="foundation-title">
        <div className="foundations-intro">
          <div className="section-index light">02 / FUNDAMENTOS</div>
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
          <p className="eyebrow dark">Siguiente hito</p>
          <h2 id="pilot-title">Un curso. Una region. Una experiencia completa.</h2>
        </div>
        <p>
          La demostracion se construira con un solo curso representativo para validar la experiencia antes de ampliar el catalogo.
        </p>
        <a className="button button-dark" href="#fundamentos">
          Revisar fundamentos
        </a>
      </section>

      <footer>
        <span>CEDIAH</span>
        <p>Plataforma educativa de anatomia - Fase 0</p>
        <p>Caracas, Venezuela</p>
      </footer>
    </main>
  );
}
