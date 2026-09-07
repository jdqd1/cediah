import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  ClockCounterClockwise,
  Compass,
  Path,
  Sparkle,
  Target,
} from "@phosphor-icons/react/dist/ssr";
import type { LearningHome, LearningHomeTask } from "@cediah/contracts";

function TaskIcon({ task }: { task: LearningHomeTask }) {
  return task.kind === "review"
    ? <ClockCounterClockwise aria-hidden="true" size={21} />
    : <Target aria-hidden="true" size={21} />;
}

function taskMeta(task: LearningHomeTask) {
  if (task.kind === "review") {
    return `${task.itemCount} ${task.itemCount === 1 ? "ítem" : "ítems"} · ${task.estimatedMinutes ?? 5} min`;
  }
  return task.estimatedMinutes ? `${task.estimatedMinutes} min orientativos` : "A tu ritmo";
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

  const visibleTasks = home.tasks.slice(0, 3);
  return (
    <section aria-labelledby="dashboard-learning-title" className="dashboard-learning">
      <header className="dashboard-learning-heading">
        <div>
          <span><Path aria-hidden="true" size={16} /> Tu aprendizaje</span>
          <h2 id="dashboard-learning-title">Retoma desde donde estás</h2>
        </div>
        <Link href="/aprendizaje">Ver aprendizaje <ArrowRight aria-hidden="true" size={17} /></Link>
      </header>

      <div className="dashboard-learning-layout">
        <article className="dashboard-learning-progress">
          <div className="dashboard-learning-progress-copy">
            <span>Ruta activa</span>
            <h3>{home.activePath.title}</h3>
            <p><strong>{home.activePath.progressPercent}%</strong> · {home.activePath.completedSteps} de {home.activePath.totalSteps} actividades</p>
          </div>
          <progress aria-label={`Progreso de ${home.activePath.title}`} max={home.activePath.totalSteps} value={home.activePath.completedSteps} />
          <Link className="learning-primary-button" href={home.activePath.continueHref}>Continuar mi ruta <ArrowRight aria-hidden="true" size={18} /></Link>
        </article>

        <div className="dashboard-learning-tasks">
          <div className="dashboard-learning-tasks-heading">
            <h3>Para hoy</h3>
            {home.tasks.length > 3 ? <Link href="/aprendizaje?tab=hoy">Ver {home.tasks.length}</Link> : null}
          </div>
          {visibleTasks.length > 0 ? (
            <ol>
              {visibleTasks.map((task) => (
                <li key={task.key}>
                  <Link href={task.href}>
                    <span className="dashboard-learning-task-icon"><TaskIcon task={task} /></span>
                    <span><small>{task.reason}</small><strong>{task.title}</strong><em>{taskMeta(task)}</em></span>
                    <ArrowRight aria-hidden="true" size={18} />
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <div className="dashboard-learning-clear">
              <CalendarCheck aria-hidden="true" size={23} />
              <p><strong>Por hoy estás al día.</strong><span>Puedes elegir cualquier otra actividad de la ruta.</span></p>
            </div>
          )}
        </div>

        <aside className="dashboard-learning-signals" aria-label="Señales de aprendizaje">
          <div><Sparkle aria-hidden="true" size={20} /><span><strong>{home.points}</strong><small>Puntos de aprendizaje</small></span></div>
          <div><CalendarCheck aria-hidden="true" size={20} /><span><strong>{home.constancy.activeDaysThisWeek}{home.constancy.weeklyGoalDays ? `/${home.constancy.weeklyGoalDays}` : ""}</strong><small>{home.constancy.weeklyGoalDays ? "Días esta semana" : "Días activos esta semana"}</small></span></div>
        </aside>
      </div>
    </section>
  );
}
