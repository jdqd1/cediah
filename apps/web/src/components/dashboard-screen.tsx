import Link from "next/link";
import { ArrowRight, BookOpen, CardsThree, ClipboardText, Notebook, Path } from "@phosphor-icons/react/dist/ssr";
import type { ContentItem, LearningHome } from "@cediah/contracts";
import { publishedContentHref } from "@/lib/content-navigation";
import { newestContentFirst } from "@/lib/content-order";
import { AppShell } from "./app-shell";
import { BrandFooter } from "./brand-footer";
import { LearningDashboardReview } from "./learning/learning-dashboard-review";
import { LearningDashboardSummary } from "./learning/learning-dashboard-summary";

type Guide = Extract<ContentItem, { kind: "guide" }>;

const materialDefinitions = [
  { href: "/guias", icon: Notebook, kind: "guide", title: "Guías", description: "Lee y profundiza" },
  { href: "/asignaturas?tipo=quiz", icon: ClipboardText, kind: "quiz", title: "Cuestionarios", description: "Pon a prueba lo aprendido" },
  { href: "/asignaturas?tipo=flashcards", icon: CardsThree, kind: "flashcards", title: "Flashcards", description: "Repasa conceptos clave" },
] as const;

function GuideCard({ guide, index }: { guide: Guide; index: number }) {
  return (
    <li>
      <Link className="dashboard-guide-card" href={publishedContentHref(guide)}>
        <span className="dashboard-guide-card-icon" aria-hidden="true"><BookOpen size={25} weight="duotone" /></span>
        <span className="dashboard-guide-card-position">{String(index + 1).padStart(2, "0")}</span>
        <span className="dashboard-guide-card-copy">
          <small>{guide.topic || "Guía de estudio"}</small>
          <strong>{guide.title}</strong>
          <span>{guide.summary || "Explora esta nueva guía de estudio."}</span>
        </span>
        <span className="dashboard-guide-card-action" aria-hidden="true"><ArrowRight size={18} /></span>
      </Link>
    </li>
  );
}

export function DashboardScreen({
  available,
  recentItems = [],
  lastReadGuide = null,
  lastReadAvailable = true,
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
      <header className="dashboard-home-intro">
        <span>Tu espacio de estudio</span>
        <h1>Continúa aprendiendo</h1>
        <p>Retoma una guía, descubre material nuevo o dedica unos minutos al repaso.</p>
      </header>

      <div className={"dashboard-focus-grid" + (guidedLearningEnabled ? " has-review" : "")}>
        <section className="dashboard-resume-section" aria-labelledby="dashboard-resume-title">
          <div className="section-heading-row"><h2 id="dashboard-resume-title">Seguir leyendo</h2></div>
          {resumeGuide ? (
            <Link className="dashboard-resume-card" href={publishedContentHref(resumeGuide)}>
              <span className="dashboard-resume-art" aria-hidden="true"><BookOpen size={66} weight="duotone" /></span>
              <span className="dashboard-resume-copy">
                <span className="dashboard-resume-kicker"><BookOpen size={16} /> Tu última guía</span>
                <strong>{resumeGuide.title}</strong>
                <span>{resumeGuide.summary || "Continúa donde dejaste la lectura."}</span>
                <span className="dashboard-resume-action">Continuar lectura <ArrowRight size={18} /></span>
              </span>
            </Link>
          ) : (
            <div className="dashboard-resume-empty">
              <span className="dashboard-resume-empty-icon"><BookOpen aria-hidden="true" size={26} /></span>
              <div>
                <strong>{lastReadAvailable ? "Tu próxima lectura empieza aquí" : "No pudimos cargar tu última guía"}</strong>
                <p>{lastReadAvailable
                  ? "Cuando leas una guía, podrás retomarla fácilmente desde este espacio."
                  : "Puedes explorar las guías mientras recuperamos tu historial."}</p>
              </div>
              <Link href="/guias">Explorar guías <ArrowRight aria-hidden="true" size={17} /></Link>
            </div>
          )}
        </section>
        <LearningDashboardReview available={learningHomeAvailable} enabled={guidedLearningEnabled} home={learningHome} />
      </div>

      <section className="dashboard-section dashboard-recent" aria-labelledby="recent-title">
        <div className="section-heading-row">
          <h2 id="recent-title">Agregadas recientemente</h2>
          <Link href="/guias">Ver todas <ArrowRight aria-hidden="true" size={17} /></Link>
        </div>
        <p className="dashboard-section-description">Las cinco guías publicadas más recientes, en orden.</p>
        {recentGuides.length > 0 ? (
          <ol className="dashboard-guide-grid">
            {recentGuides.map((guide, index) => <GuideCard key={guide.id} guide={guide} index={index} />)}
          </ol>
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
          {materialDefinitions.map(({ title, description, icon: Icon, kind, href }) => (
            <Link className="study-material-card" data-kind={kind} href={href} key={kind}>
              <span className="study-material-icon" aria-hidden="true"><Icon size={23} weight="regular" /></span>
              <span className="study-material-copy"><strong>{title}</strong><small>{description}</small></span>
              <ArrowRight className="dashboard-shortcut-arrow" aria-hidden="true" size={18} />
            </Link>
          ))}
          {guidedLearningEnabled && (
            <Link className="study-material-card" data-kind="learning" href="/aprendizaje">
              <span className="study-material-icon" aria-hidden="true"><Path size={23} weight="regular" /></span>
              <span className="study-material-copy"><strong>Rutas de aprendizaje</strong><small>Avanza a tu ritmo</small></span>
              <ArrowRight className="dashboard-shortcut-arrow" aria-hidden="true" size={18} />
            </Link>
          )}
        </nav>
      </section>

      <LearningDashboardSummary available={learningHomeAvailable} enabled={guidedLearningEnabled} home={learningHome} />

      <BrandFooter />
    </AppShell>
  );
}
