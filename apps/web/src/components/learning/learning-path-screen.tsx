import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CardsThree,
  CaretDown,
  CheckCircle,
  Clock,
  Exam,
  PlayCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { LearningEnrollmentProgress, LearningEnrollmentUpgradePreviewResponse, LearningPathDetail } from "@cediah/contracts";
import { LearningEnrollmentActions } from "./learning-enrollment-actions";
import { LearningPathUpgrade, type LearningPathUpgradeNotice } from "./learning-path-upgrade";
import { LearningStepPreference } from "./learning-step-preference";

const coverImages = {
  "back-muscles": "/anatomy/back-muscles.png", heart: "/anatomy/heart.png",
  intestines: "/anatomy/intestines.png", lungs: "/anatomy/lungs.png",
  "neck-muscles": "/anatomy/neck-muscles.png", pelvis: "/anatomy/pelvis.png",
  skull: "/anatomy/skull.png", thigh: "/anatomy/thigh.png",
} as const;
const projectionLabels = { flashcards: "Flashcards", guide: "Guía", quiz: "Cuestionario", video: "Video" } as const;
const projectionIcons = { flashcards: CardsThree, guide: BookOpen, quiz: Exam, video: PlayCircle } as const;
const evidenceLabels = {
  consolidated: "Consolidado",
  developing: "Bien encaminado",
  practicing: "En práctica",
  unassessed: "Por comprobar",
} as const;

export function LearningPathScreen({ path, progress, upgrade }: { path: LearningPathDetail; progress: LearningEnrollmentProgress | null; upgrade: LearningEnrollmentUpgradePreviewResponse | null }) {
  const progressByStep = new Map(progress?.units.flatMap((unit) => unit.steps).map((step) => [step.stepId, step]) ?? []);
  const progressByUnit = new Map(progress?.units.map((unit) => [unit.id, unit]) ?? []);
  const minutes = path.version.units.flatMap((unit) => unit.steps).reduce((sum, step) => {
    const selected = step.options.find((option) => option.isDefault) ?? step.options[0];
    return sum + (selected?.estimatedMinutes ?? 0);
  }, 0);
  const currentUnitIndex = Math.max(0, path.version.units.findIndex((unit) => {
    const state = progressByUnit.get(unit.id);
    return !state || state.completedEssentialSteps < state.totalEssentialSteps;
  }));
  let upgradeNotice: LearningPathUpgradeNotice | null = null;
  if (path.enrollment && upgrade?.upgrade) {
    const { steps, ...preview } = upgrade.upgrade;
    upgradeNotice = {
      changes: steps.filter((step) => step.kind !== "equivalent"),
      enrollmentId: path.enrollment.id,
      expectedVersion: path.enrollment.rowVersion,
      historyCount: upgrade.history.length,
      preview,
    };
  }
  return (
    <main className="learning-main learning-path-detail">
      <Link className="learning-back-link" href="/aprendizaje?tab=rutas"><ArrowLeft aria-hidden="true" size={18} />Todas las rutas</Link>
      <section className="learning-path-hero">
        <div className="learning-path-hero-copy">
          <span className="learning-topic-label">{path.topic.title}</span>
          <h1>{path.title}</h1>
          <p>{path.summary}</p>
          <div className="learning-path-facts">
            <span><CheckCircle aria-hidden="true" size={19} />{path.version.units.length} {path.version.units.length === 1 ? "unidad" : "unidades"}</span>
            {minutes > 0 ? <span><Clock aria-hidden="true" size={19} />{minutes} min orientativos</span> : null}
          </div>
          <LearningEnrollmentActions enrollment={path.enrollment} pathId={path.id} />
          {progress ? <div className="learning-path-progress"><div><strong>{progress.percentage}%</strong><span>{progress.completedEssentialSteps} de {progress.totalEssentialSteps} pasos esenciales</span></div><progress max={progress.totalEssentialSteps} value={progress.completedEssentialSteps} /></div> : null}
        </div>
        <div className="learning-path-hero-image"><Image alt="" fill priority sizes="(max-width: 767px) 100vw, 420px" src={coverImages[path.coverKey]} /></div>
      </section>

      {upgradeNotice ? <LearningPathUpgrade notice={upgradeNotice} /> : null}

      <section aria-labelledby="learning-map-title" className="learning-route-map">
        <div className="learning-section-heading"><div><span>Mapa de la ruta</span><h2 id="learning-map-title">Todas las unidades están a tu alcance</h2></div><p>El orden es una recomendación, no un bloqueo.</p></div>
        <div className="learning-unit-list">
          {path.version.units.map((unit, index) => {
            const unitProgress = progressByUnit.get(unit.id);
            const completed = Boolean(unitProgress && unitProgress.totalEssentialSteps > 0 && unitProgress.completedEssentialSteps === unitProgress.totalEssentialSteps);
            const active = !completed && index === currentUnitIndex;
            return (
            <details key={unit.id} open={active || (!progress && index === 0)} className="learning-unit" data-state={completed ? "completed" : active ? "active" : "available"}>
              <summary>
                <span className="learning-unit-number">{completed ? <CheckCircle aria-hidden="true" size={24} weight="fill" /> : index + 1}</span>
                <span><small>{completed ? "Unidad completada" : active ? "Unidad actual" : `Unidad ${index + 1} · disponible`}</small><strong>{unit.title}</strong><em>{unitProgress ? `${unitProgress.completedEssentialSteps}/${unitProgress.totalEssentialSteps} esenciales` : `${unit.steps.length} actividades`}</em></span>
                <CaretDown aria-hidden="true" className="learning-unit-caret" size={20} />
              </summary>
              <div className="learning-objectives"><strong>Al terminar podrás</strong><ul>{unit.objectives.map((objective) => {
                const evidence = progressByUnit.get(unit.id)?.objectives.find((entry) => entry.id === objective.id);
                return <li key={objective.id}><span>{objective.title}</span>{evidence ? <small>{evidenceLabels[evidence.state]}{evidence.lastCheckPercent !== null ? ` · última comprobación ${evidence.lastCheckPercent}%` : ""}{evidence.evidenceLimited ? " · evidencia limitada por el banco disponible" : ""}</small> : null}</li>;
              })}</ul></div>
              <ol className="learning-step-list">
                {unit.steps.map((step) => {
                  const stepProgress = progressByStep.get(step.id);
                  return (
                  <li data-state={stepProgress?.state ?? "not_started"} key={step.id}>
                    <div className="learning-step-heading"><span>{stepProgress?.state === "completed" ? "Completada" : stepProgress?.state === "in_progress" ? "En progreso" : stepProgress?.state === "skipped" ? "Omitida, no completada" : step.isEssential ? "Esencial" : "Opcional"}</span><h3>{step.title}</h3>{path.enrollment && stepProgress?.state !== "completed" ? <LearningStepPreference enrollmentId={path.enrollment.id} rowVersion={stepProgress?.rowVersion ?? 0} skipped={stepProgress?.state === "skipped"} stepId={step.id} /> : null}</div>
                    <div className="learning-option-list">
                      {step.options.map((option) => {
                        const Icon = projectionIcons[option.projection];
                        const href = `/aprendizaje/rutas/${path.slug}/actividades/${step.id}?opcion=${option.id}`;
                        return path.enrollment ? (
                          <Link className="learning-option" href={href} key={option.id}>
                            <span className="learning-option-icon"><Icon aria-hidden="true" size={22} /></span>
                            <span><strong>{option.label}</strong><small>{projectionLabels[option.projection]}{option.estimatedMinutes ? ` · ${option.estimatedMinutes} min` : ""}</small></span>
                            {option.isDefault ? <em>Recomendada</em> : <em>Alternativa</em>}
                          </Link>
                        ) : (
                          <div className="learning-option is-locked" key={option.id}>
                            <span className="learning-option-icon"><Icon aria-hidden="true" size={22} /></span>
                            <span><strong>{option.label}</strong><small>{projectionLabels[option.projection]}{option.estimatedMinutes ? ` · ${option.estimatedMinutes} min` : ""}</small></span>
                            <em>Comienza la ruta</em>
                          </div>
                        );
                      })}
                    </div>
                  </li>
                );})}
              </ol>
            </details>
          );})}
        </div>
      </section>
    </main>
  );
}
