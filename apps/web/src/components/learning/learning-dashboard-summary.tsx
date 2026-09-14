import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  ClockCounterClockwise,
  Compass,
  FlagCheckered,
  Path,
  Play,
} from "@phosphor-icons/react/dist/ssr";
import type { LearningHome, LearningHomeTask } from "@cediah/contracts";

function TaskIcon({ task }: { task: LearningHomeTask }) {
  return task.kind === "review"
    ? <ClockCounterClockwise aria-hidden="true" size={21} />
    : <Play aria-hidden="true" size={20} weight="fill" />;
}

function taskMeta(task: LearningHomeTask) {
  if (task.kind === "review") {
    return `${task.itemCount} ${task.itemCount === 1 ? "ítem" : "ítems"} · ${task.estimatedMinutes ?? 5} min`;
  }
  return task.estimatedMinutes ? `${task.estimatedMinutes} min` : "A tu ritmo";
}

function taskLabel(task: LearningHomeTask) {
  if (task.kind === "review") return "Repaso recomendado";
  if (task.kind === "resume") return "Continuar actividad";
  if (task.kind === "reinforcement") return "Refuerzo sugerido";
  if (task.kind === "explore") return "Para explorar";
  return "Siguiente paso";
}

function activePathHref(continueHref: string) {
  return continueHref.match(/^\/aprendizaje\/rutas\/[^/?#]+/)?.[0] ?? "/aprendizaje";
}

export function LearningDashboardSummary({
  available,
  enabled,
  home,
}: {
  available: boolean;
  enabled: boolean;
  home: LearningHome | null;
}) {
  if (!enabled) return null;

  if (!available || !home) {
    return (
      <section aria-labelledby="dashboard-learning-title" className="dashboard-learning dashboard-learning-error">
        <span className="dashboard-learning-mark"><Path aria-hidden="true" size={24} /></span>
        <div>
          <span>Tu aprendizaje</span>
          <h2 id="dashboard-learning-title">No pudimos cargar tu progreso</h2>
          <p>Tu avance guardado no cambió. Puedes reintentar sin perder ninguna actividad.</p>
        </div>
        <Link className="learning-secondary-button" href="/dashboard">Reintentar</Link>
      </section>
    );
  }

  if (!home.activePath) {
    return (
      <section aria-labelledby="dashboard-learning-title" className="dashboard-learning dashboard-learning-empty">
        <span className="dashboard-learning-mark"><Compass aria-hidden="true" size={25} /></span>
        <div>
          <span>Tu aprendizaje</span>
          <h2 id="dashboard-learning-title">Aprende con una ruta</h2>
          <p>Elige un tema y recibe una secuencia flexible de comprensión, práctica y repaso.</p>
        </div>
        <Link className="learning-primary-button" href="/aprendizaje?tab=rutas">Elegir tema <ArrowRight aria-hidden="true" size={18} /></Link>
      </section>
    );
  }

  const activePath = home.activePath;
  const primaryTask = home.tasks.find((task) => task.kind !== "review") ?? null;
  const reviewTask = home.tasks.find((task) => task.kind === "review") ?? null;
  const dueReviews = home.counts.dueReviews;
  const reviewTone = dueReviews === 0
    ? "complete"
    : dueReviews <= 5
      ? "calm"
      : dueReviews <= 12
        ? "active"
        : dueReviews <= 20
          ? "attention"
          : "urgent";
  const reviewAngle = dueReviews === 0
    ? 360
    : Math.max(36, Math.min(dueReviews, 20) / 20 * 360);
  const stepProgress = activePath.totalSteps === 1
    ? activePath.completedSteps > 0 ? 100 : 0
    : Math.min(activePath.completedSteps, activePath.totalSteps - 1) / (activePath.totalSteps - 1) * 100;
  const stepperStyle = {
    "--dashboard-route-progress": `${stepProgress}%`,
    "--dashboard-step-count": activePath.totalSteps,
  } as CSSProperties;
  const routeProgressRingStyle = {
    "--dashboard-progress-angle": `${activePath.progressPercent * 3.6}deg`,
  } as CSSProperties;
  const reviewRingStyle = {
    "--dashboard-review-angle": `${reviewAngle}deg`,
  } as CSSProperties;

  return (
    <div aria-label="Aprendizaje y repaso" className="dashboard-learning">
      <section aria-labelledby="dashboard-learning-title" className="dashboard-learning-block dashboard-learning-path-block">
        <div className="dashboard-learning-section-heading section-heading-row">
          <h2 id="dashboard-learning-title">Rutas de aprendizaje</h2>
          <Link href="/aprendizaje?tab=rutas">Ver todas <ArrowRight aria-hidden="true" size={17} /></Link>
        </div>

        <article className="dashboard-learning-route">
          <header className="dashboard-learning-route-heading">
            <div className="dashboard-learning-route-copy">
              <span><Path aria-hidden="true" size={17} /> En curso</span>
              <h3>{activePath.title}</h3>
              <p>{activePath.completedSteps} de {activePath.totalSteps} actividades completadas</p>
            </div>
            <div className="dashboard-learning-progress-visual">
              <progress
                aria-label={`Progreso de ${activePath.title}`}
                className="sr-only"
                max={activePath.totalSteps}
                value={activePath.completedSteps}
              />
              <div aria-hidden="true" className="dashboard-learning-progress-ring" style={routeProgressRingStyle}>
                <strong>{activePath.progressPercent}%</strong>
              </div>
            </div>
          </header>

          <div className="dashboard-learning-stepper-scroll">
            <div className="dashboard-learning-stepper" style={stepperStyle}>
              <span aria-hidden="true" className="dashboard-learning-stepper-track"><span /></span>
              <ol aria-label="Progreso por actividades">
                {Array.from({ length: activePath.totalSteps }, (_, index) => {
                  const state = index < activePath.completedSteps
                    ? "completed"
                    : index === activePath.completedSteps
                      ? "current"
                      : "upcoming";
                  const stateLabel = state === "completed"
                    ? "completada"
                    : state === "current"
                      ? "actividad actual"
                      : "pendiente";
                  const isGoal = index === activePath.totalSteps - 1;

                  return (
                    <li
                      aria-current={state === "current" ? "step" : undefined}
                      data-goal={isGoal ? "true" : undefined}
                      data-state={state}
                      key={index}
                    >
                      <span aria-hidden="true" className="dashboard-learning-step-node">
                        {isGoal
                          ? <FlagCheckered size={17} weight="fill" />
                          : state === "completed"
                            ? <Check size={17} weight="bold" />
                            : null}
                      </span>
                      <small aria-hidden="true">{index + 1}</small>
                      <em aria-hidden="true">{isGoal ? "Meta" : state === "current" ? "Ahora" : `Actividad ${index + 1}`}</em>
                      <span className="sr-only">Actividad {index + 1}{isGoal ? ", meta de la ruta" : ""}: {stateLabel}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          <section aria-labelledby="dashboard-learning-today-title" className="dashboard-learning-today">
            <header className="dashboard-learning-today-heading">
              <div>
                <h4 id="dashboard-learning-today-title">Para hoy</h4>
                <p>Paso {Math.min(activePath.completedSteps + 1, activePath.totalSteps)} de {activePath.totalSteps}</p>
              </div>
            </header>

            {primaryTask ? (
              <div className="dashboard-learning-today-body">
                <article className="dashboard-learning-featured-task">
                  <span className="dashboard-learning-task-icon"><TaskIcon task={primaryTask} /></span>
                  <span className="dashboard-learning-task-copy">
                    <span className="dashboard-learning-task-label">{taskLabel(primaryTask)}</span>
                    <strong>{primaryTask.title}</strong>
                    <em>{taskMeta(primaryTask)}</em>
                  </span>
                </article>

                <Link className="dashboard-learning-activity-button" href={primaryTask.href}>
                  Ir a la actividad <ArrowRight aria-hidden="true" size={19} />
                </Link>
              </div>
            ) : (
              <div className="dashboard-learning-today-clear">
                <div>
                  <CalendarCheck aria-hidden="true" size={23} />
                  <p><strong>Ruta completada.</strong><span>Puedes volver a cualquier actividad cuando quieras.</span></p>
                </div>
                <Link className="dashboard-learning-activity-button" href={activePath.continueHref}>
                  Ver la ruta <ArrowRight aria-hidden="true" size={19} />
                </Link>
              </div>
            )}
          </section>

          <Link className="dashboard-learning-route-link" href={activePathHref(activePath.continueHref)}>
            Ver toda la ruta <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </article>
      </section>

      <section aria-labelledby="dashboard-review-title" className="dashboard-learning-block dashboard-learning-review-block">
        <div className="dashboard-learning-section-heading section-heading-row">
          <h2 id="dashboard-review-title">Repaso</h2>
        </div>

        <article className="dashboard-review-card" data-tone={reviewTone}>
          <header className="dashboard-review-heading">
            <span className="dashboard-review-icon"><ClockCounterClockwise aria-hidden="true" size={24} /></span>
            <span className="dashboard-review-copy">
              <strong>{dueReviews === 0 ? "Repaso al día" : "Repaso recomendado"}</strong>
              <span>{reviewTask?.title ?? "No tienes conceptos pendientes por ahora."}</span>
            </span>
            <div
              aria-label={dueReviews === 0 ? "No hay repasos pendientes" : `${dueReviews} repasos pendientes`}
              className="dashboard-review-ring"
              role="img"
              style={reviewRingStyle}
            >
              <span aria-hidden="true">
                {dueReviews === 0 ? <Check size={24} weight="bold" /> : <><strong>{dueReviews}</strong><small>pendientes</small></>}
              </span>
            </div>
          </header>

          {reviewTask ? (
            <>
              <p className="dashboard-review-session">
                <strong>{reviewTask.itemCount}</strong> {reviewTask.itemCount === 1 ? "ítem" : "ítems"} en esta sesión
                <span aria-hidden="true">·</span>
                <span>{reviewTask.estimatedMinutes ?? 5} min</span>
              </p>
              <Link className="dashboard-learning-activity-button dashboard-review-button" href={reviewTask.href}>
                Repasar ahora <ArrowRight aria-hidden="true" size={19} />
              </Link>
            </>
          ) : (
            <Link className="dashboard-learning-route-link dashboard-review-clear-link" href="/aprendizaje">
              Ver mi aprendizaje <ArrowRight aria-hidden="true" size={18} />
            </Link>
          )}
        </article>
      </section>
    </div>
  );
}
