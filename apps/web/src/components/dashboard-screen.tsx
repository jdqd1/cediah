import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CardsThree,
  CheckSquareOffset,
  PlayCircle,
  Skull,
} from "@phosphor-icons/react/dist/ssr";
import { AppShell } from "./app-shell";
import { BrandFooter } from "./brand-footer";

const recentVideos = [
  { title: "Músculos del cuello", region: "Región cervical", progress: 75, time: "28:45", image: "/anatomy/neck-muscles.png" },
  { title: "Fosa craneal media", region: "Cabeza y cuello", progress: 60, time: "34:12", image: "/anatomy/skull.png" },
  { title: "Cavidad pélvica", region: "Región pélvica", progress: 90, time: "41:08", image: "/anatomy/pelvis.png" },
] as const;

const mostViewed = [
  { title: "Miembro inferior: músculos", region: "Región inferior", views: "128K visualizaciones", image: "/anatomy/thigh.png" },
  { title: "Corazón: anatomía externa", region: "Tórax", views: "97K visualizaciones", image: "/anatomy/heart.png" },
  { title: "Nervios del plexo braquial", region: "Miembro superior", views: "86K visualizaciones", image: "/anatomy/back-muscles.png" },
  { title: "Huesos del cráneo", region: "Cabeza y cuello", views: "74K visualizaciones", image: "/anatomy/skull.png" },
  { title: "Anatomía del abdomen", region: "Abdomen y pelvis", views: "62K visualizaciones", image: "/anatomy/intestines.png" },
] as const;

const studyMaterials = [
  { title: "Guías", description: "Documentos PDF", icon: BookOpen, image: "/anatomy/back-muscles.png", href: "/guias" },
  { title: "Flashcards", description: "Repasos rápidos", icon: CardsThree, image: "/anatomy/thigh.png", href: "/dashboard" },
  { title: "Cuestionarios", description: "Evalúa tu conocimiento", icon: CheckSquareOffset, image: "/anatomy/heart.png", href: "/dashboard" },
  { title: "Atlas anatómicos", description: "Imágenes y diagramas", icon: Skull, image: "/anatomy/skull.png", href: "/dashboard" },
] as const;

function VideoCard({ item }: { item: (typeof recentVideos)[number] }) {
  return (
    <Link className="dashboard-video-card" href="/clases/reproductor">
      <div className="dashboard-video-media">
        <Image src={item.image} alt="" fill sizes="(max-width: 900px) 80vw, 28vw" />
        <span className="dashboard-video-shade" />
        <span className="dashboard-play-button" aria-hidden="true"><PlayCircle size={49} weight="thin" /></span>
        <span className="dashboard-video-duration">{item.time}</span>
      </div>
      <div className="dashboard-video-copy">
        <h3>{item.title}</h3>
        <p>{item.region}</p>
        <div className="progress-line">
          <span><span style={{ width: `${item.progress}%` }} /></span>
          <strong>{item.progress}%</strong>
        </div>
      </div>
    </Link>
  );
}

export function DashboardScreen() {
  return (
    <AppShell
      activeKey="dashboard"
      headerTitle="¡Bienvenido de vuelta!"
      headerSubtitle="Sigue aprendiendo anatomía con CEDIAH."
      searchPlaceholder="Buscar contenido..."
      welcome
      mainClassName="dashboard-main"
    >
      <div className="dashboard-layout">
        <div className="dashboard-primary">
          <section className="dashboard-section dashboard-recent" aria-labelledby="recent-title">
            <div className="section-heading-row">
              <h2 id="recent-title">Últimos videos vistos</h2>
              <Link href="/clases/reproductor">Ver todo <ArrowRight size={17} /></Link>
            </div>
            <div className="dashboard-video-grid">
              {recentVideos.map((item) => <VideoCard key={item.title} item={item} />)}
            </div>
          </section>

          <section className="dashboard-section dashboard-materials" aria-labelledby="materials-title">
            <div className="section-heading-row">
              <h2 id="materials-title">Material de estudio</h2>
              <Link href="/guias">Ver todo <ArrowRight size={17} /></Link>
            </div>
            <div className="study-material-grid">
              {studyMaterials.map(({ title, description, icon: Icon, image, href }) => (
                <Link className="study-material-card" href={href} key={title}>
                  <Image src={image} alt="" fill sizes="200px" />
                  <span className="study-material-wash" />
                  <span className="study-material-icon"><Icon size={31} weight="regular" /></span>
                  <span className="study-material-copy">
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <BrandFooter />
        </div>

        <aside className="dashboard-most-viewed" aria-labelledby="most-viewed-title">
          <div className="section-heading-row">
            <h2 id="most-viewed-title">Más vistos</h2>
            <Link href="/clases/reproductor">Ver todo <ArrowRight size={17} /></Link>
          </div>
          <ol className="most-viewed-list">
            {mostViewed.map((item, index) => (
              <li key={item.title}>
                <span className="most-viewed-rank">{index + 1}</span>
                <Link href="/clases/reproductor" className="most-viewed-link">
                  <span className="most-viewed-image"><Image src={item.image} alt="" fill sizes="100px" /></span>
                  <span className="most-viewed-copy">
                    <strong>{item.title}</strong>
                    <small>{item.region}</small>
                    <small>{item.views}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </AppShell>
  );
}
