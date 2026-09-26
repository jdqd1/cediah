import Link from "next/link";
import { ArrowRight, BookOpen, CardsThree, ClipboardText, Notebook, Path } from "@phosphor-icons/react/dist/ssr";
import type { ContentItem, LearningHome } from "@cediah/contracts";
import { publishedContentHref } from "@/lib/content-navigation";
import { newestContentFirst } from "@/lib/content-order";
import { AppShell } from "./app-shell";
import { BrandFooter } from "./brand-footer";
import { LearningDashboardReview } from "./learning/learning-dashboard-review";
import { LearningDashboardSummary } from "./learning/learning-dashboard-summary";
import { DashboardRecentCarousel } from "./dashboard-recent-carousel";

type Guide = Extract<ContentItem, { kind: "guide" }>;

const materialDefinitions = [
  { href: "/guias", icon: Notebook, kind: "guide", title: "Guías" },
  { href: "/asignaturas?tipo=flashcards", icon: CardsThree, kind: "flashcards", title: "Flashcards" },
  { href: "/asignaturas?tipo=quiz", icon: ClipboardText, kind: "quiz", title: "Cuestionarios" },
] as const;

function GuideCard({ guide }: { guide: Guide }) {
  return (
    <li>
      <Link className="dashboard-guide-card" href={publishedContentHref(guide)}>
        <span className="dashboard-guide-card-icon" aria-hidden="true"><BookOpen size={23} /></span>
        <span className="dashboard-guide-card-copy">
          <small>{guide.topic || "Guía de estudio"}</small>
          <strong>{guide.title}</strong>
        </span>
        <span className="dashboard-guide-card-action" aria-hidden="true">Abrir <ArrowRight size={16} /></span>
      </Link>
    </li>
  );
}

export function DashboardScreen({
  available,
  recentItems = [],
  lastReadGuide = null,
  isAdministrator = false,
  guidedLearningEnabled = false,
  learningHome = null,
  learningHomeAvailable = false,
  viewer,
}: {
  available: boolean;
  recentItems?: ContentItem[];
  lastReadGuide?: ContentItem | null;
  lastReadAvailable?: boolean;
  isAdministrator?: boolean;
  guidedLearningEnabled?: boolean;
  learningHome?: LearningHome | null;
  learningHomeAvailable?: boolean;
  viewer?: { email: string };
}) {
  const recentGuides = recentItems
    .filter((item): item is Guide => item.kind === "guide")
    .sort(newestContentFirst)
    .slice(0, 5);
  const resumeGuide = lastReadGuide?.kind === "guide" ? lastReadGuide : null;

  return (
    <AppShell
      activeKey="dashboard"
      isAdministrator={isAdministrator}
      viewer={viewer}
      headerTitle=""
      guidedLearningEnabled={guidedLearningEnabled}
      mainClassName="dashboard-main dashboard-study-home"
    >
      <h1 className="sr-only">Inicio</h1>
      <div className={"dashboard-focus-grid" + (guidedLearningEnabled ? " has-routes" : "")}>
        <LearningDashboardSummary available={learningHomeAvailable} enabled={guidedLearningEnabled} home={learningHome} />
        <section className="dashboard-resume-section" aria-labelledby="dashboard-resume-title">
          <div className="section-heading-row"><h2 id="dashboard-resume-title">Seguir leyendo</h2></div>
          {resumeGuide ? (
            <Link className="dashboard-resume-card" href={publishedContentHref(resumeGuide)}>
              <span className="dashboard-resume-art" aria-hidden="true"><BookOpen size={31} /></span>
              <span className="dashboard-resume-copy">
                <span className="dashboard-resume-kicker"><BookOpen size={16} /> Tu última guía</span>
                <strong>{resumeGuide.title}</strong>
                <span className="dashboard-resume-action">Continuar lectura <ArrowRight size={18} /></span>
              </span>
            </Link>
          ) : (
            <div className="dashboard-resume-empty">
              <span className="dashboard-resume-empty-icon"><BookOpen aria-hidden="true" size={35} /></span>
              <Link href="/guias">Explorar guías <ArrowRight aria-hidden="true" size={20} /></Link>
            </div>
          )}
        </section>
      </div>

      <LearningDashboardReview available={learningHomeAvailable} enabled={guidedLearningEnabled} home={learningHome} />

      <section className="dashboard-section dashboard-recent" aria-labelledby="recent-title">
        <div className="section-heading-row">
          <h2 id="recent-title">Agregadas recientemente</h2>
          <Link href="/guias">Ver todas <ArrowRight aria-hidden="true" size={17} /></Link>
        </div>
        {recentGuides.length > 0 ? (
          <DashboardRecentCarousel><ol className="dashboard-guide-grid">
            {recentGuides.map((guide) => <GuideCard key={guide.id} guide={guide} />)}
          </ol></DashboardRecentCarousel>
        ) : (
          <div className="dynamic-empty-state" role="status">
            <BookOpen size={30} aria-hidden="true" />
            <div>
              <strong>{available ? "Aún no hay guías publicadas." : "No pudimos cargar las guías."}</strong>
              <span>{available ? "Las nuevas guías aparecerán aquí." : "Intenta actualizar en unos minutos."}</span>
            </div>
          </div>
        )}
      </section>

      <section className="dashboard-section dashboard-materials" aria-labelledby="dashboard-materials-title">
        <div className="section-heading-row"><h2 id="dashboard-materials-title">Explora tu material</h2></div>
        <nav className="study-material-grid dashboard-shortcuts" aria-label="Accesos directos de estudio">
          {guidedLearningEnabled && (
            <Link className="study-material-card" data-kind="learning" href="/aprendizaje">
              <span className="study-material-icon" aria-hidden="true"><Path size={23} weight="regular" /></span>
              <span className="study-material-copy"><strong>Rutas de aprendizaje</strong></span>
              <ArrowRight className="dashboard-shortcut-arrow" aria-hidden="true" size={18} />
            </Link>
          )}
          {materialDefinitions.map(({ title, icon: Icon, kind, href }) => (
            <Link className="study-material-card" data-kind={kind} href={href} key={kind}>
              <span className="study-material-icon" aria-hidden="true"><Icon size={23} weight="regular" /></span>
              <span className="study-material-copy"><strong>{title}</strong></span>
              <ArrowRight className="dashboard-shortcut-arrow" aria-hidden="true" size={18} />
            </Link>
          ))}
        </nav>
      </section>

      <BrandFooter />
    </AppShell>
  );
}
