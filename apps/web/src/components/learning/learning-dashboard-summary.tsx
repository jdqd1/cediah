import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  ClockCounterClockwise,
  Compass,
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
  const primaryTask = home.tasks.find((task) => task.kind !== "review") ?? home.tasks[0] ?? null;
  const secondaryTask = home.tasks.find((task) => task.kind === "review" && task.key !== primaryTask?.key)
    ?? home.tasks.find((task) => task.key !== primaryTask?.key)
    ?? null;
  const stepProgress = activePath.totalSteps === 1
    ? activePath.completedSteps > 0 ? 100 : 0
    : Math.min(activePath.completedSteps, activePath.totalSteps - 1) / (activePath.totalSteps - 1) * 100;
  const stepperStyle = {
    "--dashboard-route-progress": `${stepProgress}%`,
    "--dashboard-step-count": activePath.totalSteps,
  } as CSSProperties;
  const progressRingStyle = {
    "--dashboard-progress-angle": `${activePath.progressPercent * 3.6}deg`,
  } as CSSProperties;

  return (
    <section aria-labelledby="dashboard-learning-title" className="dashboard-learning">
      <div className="dashboard-learning-route">
        <header className="dashboard-learning-route-heading">
          <div className="dashboard-learning-route-copy">
            <span><Path aria-hidden="true" size={18} /> Ruta activa</span>
            <h2 id="dashboard-learning-title">{activePath.title}</h2>
            <p>{activePath.completedSteps} de {activePath.totalSteps} actividades completadas</p>
          </div>
          <div className="dashboard-learning-progress-visual">
            <progress
              aria-label={`Progreso de ${activePath.title}`}
              className="sr-only"
              max={activePath.totalSteps}
              value={activePath.completedSteps}
            />
            <div aria-hidden="true" className="dashboard-learning-progress-ring" style={progressRingStyle}>
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

                return (
                  <li aria-current={state === "current" ? "step" : undefined} data-state={state} key={index}>
                    <span aria-hidden="true" className="dashboard-learning-step-node">
                      {state === "completed" ? <Check size={18} weight="bold" /> : null}
                    </span>
                    <small aria-hidden="true">{index + 1}</small>
                    <em aria-hidden="true">{state === "current" ? "Ahora" : `Actividad ${index + 1}`}</em>
                    <span className="sr-only">Actividad {index + 1}: {stateLabel}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>

      <section aria-labelledby="dashboard-learning-today-title" className="dashboard-learning-today">
        <header className="dashboard-learning-today-heading">
          <div>
            <h3 id="dashboard-learning-today-title">Para hoy</h3>
            <p>Continúa con tu plan y mantén el ritmo.</p>
          </div>
          <Link href={activePathHref(activePath.continueHref)}>Ver toda la ruta <ArrowRight aria-hidden="true" size={18} /></Link>
        </header>

        {primaryTask ? (
          <div className={`dashboard-learning-today-body${secondaryTask ? " has-secondary" : ""}`}>
            <article className="dashboard-learning-featured-task">
              <span className="dashboard-learning-task-icon"><TaskIcon task={primaryTask} /></span>
              <span className="dashboard-learning-task-copy">
                <span className="dashboard-learning-task-label">{taskLabel(primaryTask)}</span>
                <strong>{primaryTask.title}</strong>
                <em>{taskMeta(primaryTask)}</em>
              </span>
            </article>

            {secondaryTask ? (
              <Link className="dashboard-learning-secondary-task" href={secondaryTask.href}>
                <span className="dashboard-learning-task-icon"><TaskIcon task={secondaryTask} /></span>
                <span className="dashboard-learning-task-copy">
                  <small>{taskLabel(secondaryTask)}</small>
                  <strong>{secondaryTask.title}</strong>
                  <em>{taskMeta(secondaryTask)}</em>
                </span>
                <ArrowRight aria-hidden="true" size={19} />
              </Link>
            ) : null}

            <Link className="dashboard-learning-activity-button" href={primaryTask.href}>
              Ir a la actividad <ArrowRight aria-hidden="true" size={20} />
            </Link>
          </div>
        ) : (
          <div className="dashboard-learning-today-clear">
            <div>
              <CalendarCheck aria-hidden="true" size={24} />
              <p><strong>Por hoy estás al día.</strong><span>Puedes elegir cualquier otra actividad de la ruta.</span></p>
            </div>
            <Link className="dashboard-learning-activity-button" href={activePath.continueHref}>
              Ir a la actividad <ArrowRight aria-hidden="true" size={20} />
            </Link>
          </div>
        )}
      </section>
    </section>
  );
}
