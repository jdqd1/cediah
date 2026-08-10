import Image from "next/image";
import Link from "next/link";
import {
  BookmarkSimple,
  BookOpen,
  CaretRight,
  DotsNine,
  DotsThreeVertical,
  Heartbeat,
  Waves,
  PersonSimpleRun,
  Skull,
  Star,
} from "@phosphor-icons/react/dist/ssr";
import { AppShell } from "./app-shell";

const regions = [
  { label: "Cabeza y\ncuello", icon: Skull },
  { label: "Miembro\nsuperior", icon: PersonSimpleRun },
  { label: "Tórax", icon: Waves },
  { label: "Abdomen y\npelvis", icon: Heartbeat },
  { label: "Miembro\ninferior", icon: PersonSimpleRun },
  { label: "Ver todas", icon: DotsNine },
] as const;

const continueStudying = [
  { title: "Osteología del miembro superior", lesson: "Antebrazo y muñeca", progress: 60, image: "/anatomy/skull-light.png" },
  { title: "Músculos de la región glútea", lesson: "Músculo glúteo mayor", progress: 35, image: "/anatomy/back-light.png" },
  { title: "Vascularización del encéfalo", lesson: "Arterias cerebrales", progress: 20, image: "/anatomy/heart-light.png" },
] as const;

const featured = [
  { title: "Anatomía del cráneo", type: "Extensa", pages: "42 pág.", image: "/anatomy/skull-light.png" },
  { title: "Corazón y pericardio", type: "Resumida", pages: "18 pág.", image: "/anatomy/heart-light.png" },
  { title: "Músculos de la espalda", type: "Extensa", pages: "36 pág.", image: "/anatomy/back-light.png" },
  { title: "Intestino delgado", type: "Resumida", pages: "15 pág.", image: "/anatomy/intestines.png" },
] as const;

const allGuides = [
  { title: "Músculos del muslo: compartimento anterior", region: "Miembro inferior", type: "Extensa", pages: "28", image: "/anatomy/thigh-light.png" },
  { title: "Plexo braquial", region: "Miembro superior", type: "Resumida", pages: "12", image: "/anatomy/back-light.png" },
  { title: "Nervios craneales", region: "Cabeza y cuello", type: "Extensa", pages: "31", image: "/anatomy/neck-muscles.png" },
  { title: "Anatomía de los pulmones", region: "Tórax", type: "Resumida", pages: "22", image: "/anatomy/lungs.png" },
] as const;

export function GuideDashboardScreen() {
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
          <h2 id="region-title">Explorar por región</h2>
          <div className="region-grid">
            {regions.map(({ label, icon: Icon }) => (
              <Link className="region-card" href="/guias" key={label}>
                <span className="region-icon"><Icon size={32} weight="regular" /></span>
                <strong>{label.split("\n").map((line) => <span key={line}>{line}</span>)}</strong>
              </Link>
            ))}
          </div>
        </section>

        <section className="continue-panel panel-surface" aria-labelledby="continue-title">
          <div className="section-heading-row">
            <h2 id="continue-title">Continúa estudiando</h2>
            <Link href="/guias">Ver todo</Link>
          </div>
          <div className="continue-list">
            {continueStudying.map((item) => (
              <Link className="continue-row" href="/guias/musculos-compartimento-anterior" key={item.title}>
                <span className="continue-image"><Image src={item.image} alt="" fill sizes="54px" /></span>
                <span className="continue-copy"><strong>{item.title}</strong><small>Última lectura: {item.lesson}</small></span>
                <span className="continue-progress"><small>{item.progress}%</small><span><i style={{ width: `${item.progress}%` }} /></span></span>
                <DotsThreeVertical className="continue-more" size={19} />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="guide-section" aria-labelledby="featured-title">
        <div className="section-heading-row section-heading-with-icon">
          <div><Star size={22} weight="regular" /><h2 id="featured-title">Guías destacadas</h2></div>
          <Link href="/guias">Ver todas</Link>
        </div>
        <div className="featured-guide-row">
          {featured.map((guide) => (
            <Link className="featured-guide-card" href="/guias/musculos-compartimento-anterior" key={guide.title}>
              <span className="featured-guide-image"><Image src={guide.image} alt="" fill sizes="90px" /></span>
              <span className="featured-guide-copy"><strong>{guide.title}</strong><span><small>{guide.type}</small><small>{guide.pages}</small><BookmarkSimple size={18} /></span></span>
            </Link>
          ))}
          <button className="carousel-next" type="button" aria-label="Ver más guías"><CaretRight size={23} /></button>
        </div>
      </section>

      <section className="guide-section all-guides-section" aria-labelledby="all-guides-title">
        <div className="section-heading-row section-heading-with-icon">
          <div><BookOpenIcon /><h2 id="all-guides-title">Todas las guías</h2></div>
        </div>
        <div className="guide-table panel-surface">
          <div className="guide-table-header"><span>Guía</span><span>Región</span><span>Tipo</span><span>Páginas</span><span /></div>
          {allGuides.map((guide) => (
            <Link className="guide-table-row" href="/guias/musculos-compartimento-anterior" key={guide.title}>
              <span className="guide-name-cell"><span className="guide-table-image"><Image src={guide.image} alt="" fill sizes="48px" /></span><strong>{guide.title}</strong></span>
              <span className="guide-region-cell"><PersonSimpleRun size={20} />{guide.region}</span>
              <span><small className={`guide-type-pill ${guide.type === "Extensa" ? "is-extended" : ""}`}>{guide.type}</small></span>
              <span>{guide.pages}</span>
              <BookmarkSimple size={20} />
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function BookOpenIcon() {
  return <span className="section-title-icon"><BookOpen size={22} weight="regular" /></span>;
}
