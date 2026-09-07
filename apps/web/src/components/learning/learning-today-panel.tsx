"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  ClockCounterClockwise,
  Compass,
  Medal,
  Sparkle,
  Target,
} from "@phosphor-icons/react";
import type { LearningHome, LearningHomeTask, LearningPathCard } from "@cediah/contracts";
import { LearningPreferencesDialog } from "./learning-preferences-dialog";
import { LearningTaskActions } from "./learning-task-actions";

function taskCount(task: LearningHomeTask) {
  if (task.kind === "review") {
    return `${task.itemCount} ${task.itemCount === 1 ? "ítem pendiente" : "ítems pendientes"}`;
  }
  return task.estimatedMinutes ? `${task.estimatedMinutes} min orientativos` : "A tu ritmo";
}

function TaskIcon({ task }: { task: LearningHomeTask }) {
  return task.kind === "review"
    ? <ClockCounterClockwise aria-hidden="true" size={23} />
    : <Target aria-hidden="true" size={23} />;
}

export function LearningTodayPanel({ home, paths }: {
  home: LearningHome;
  paths: LearningPathCard[];
}) {
  const [showAllTasks, setShowAllTasks] = useState(false);
  const visibleTasks = showAllTasks ? home.tasks : home.tasks.slice(0, 3);
  const selectablePaths = paths.flatMap((path) =>
    path.enrollment?.status === "active"
      ? [{ enrollmentId: path.enrollment.id, title: path.title }]
      : [],
  );
  const activePathSlug = paths.find((path) => path.enrollment?.id === home.activePath?.enrollmentId)?.slug;

  return (
    <div className="learning-today-layout">
      <div className="learning-today-primary">
        {home.activePath ? (
          <article className="learning-continue-card learning-continue-progress">
            <span className="learning-continue-icon"><Compass aria-hidden="true" size={28} /></span>
            <div className="learning-continue-copy">
              <span>Ruta activa</span>
              <div className="learning-continue-title-row">
                <h2>{home.activePath.title}</h2>
                <strong>{home.activePath.progressPercent}%</strong>
              </div>
              <p>{home.activePath.completedSteps} de {home.activePath.totalSteps} actividades esenciales. Los repasos se muestran por separado.</p>
              <progress aria-label={`Progreso de ${home.activePath.title}`} max={home.activePath.totalSteps} value={home.activePath.completedSteps} />
            </div>
            <Link className="learning-primary-button" href={home.activePath.continueHref}>Continuar mi ruta <ArrowRight aria-hidden="true" size={18} /></Link>
          </article>
        ) : (
          <section className="learning-empty">
            <span className="learning-empty-icon"><Compass aria-hidden="true" size={30} /></span>
            <div><h2>Empieza con una ruta</h2><p>Explora los temas y elige libremente cuál comenzar.</p></div>
            <Link className="learning-primary-button" href="/aprendizaje?tab=rutas">Elegir una ruta</Link>
          </section>
        )}

        {home.tasks.length > 0 ? (
          <section aria-labelledby="learning-task-list-title" className="learning-task-list-wrap">
            <div className="learning-task-list-heading">
              <div><span>Ordenadas por utilidad</span><h2 id="learning-task-list-title">Próximas tareas</h2></div>
              <small>Siempre puedes abrir otra actividad.</small>
            </div>
            <div className="learning-task-list">
              {visibleTasks.map((task) => (
                <article className={`learning-task is-band-${task.band}`} key={task.key}>
                  <span className="learning-task-icon"><TaskIcon task={task} /></span>
                  <div>
                    <span>{task.reason}</span>
                    <h3>{task.title}</h3>
                    <p>{taskCount(task)}</p>
                  </div>
                  <LearningTaskActions task={task} />
                </article>
              ))}
              {home.tasks.length > 3 ? (
                <button className="learning-secondary-button learning-show-tasks" onClick={() => setShowAllTasks((current) => !current)} type="button">
                  {showAllTasks ? "Ver solo las prioritarias" : `Ver todas las tareas (${home.tasks.length})`}
                </button>
              ) : null}
            </div>
          </section>
        ) : home.activePath ? (
          <section className="learning-empty is-compact">
            <span className="learning-empty-icon"><CalendarCheck aria-hidden="true" size={28} /></span>
            <div><h2>Por hoy estás al día</h2><p>No hay una urgencia pendiente. Puedes abrir cualquier unidad de tu ruta.</p></div>
            <Link className="learning-secondary-button" href={activePathSlug ? `/aprendizaje/rutas/${activePathSlug}` : "/aprendizaje?tab=rutas"}>Ver mi ruta</Link>
          </section>
        ) : null}
      </div>

      <aside className="learning-today-summary" aria-label="Resumen de aprendizaje">
        <div className="learning-summary-heading"><div><span>Tu panorama</span><h2>Señales separadas</h2></div><Sparkle aria-hidden="true" size={22} /></div>
        <dl className="learning-signal-list">
          <div><dt><Target aria-hidden="true" size={18} />Pasos pendientes</dt><dd>{home.counts.pendingEssentialSteps}</dd></div>
          <div><dt><ClockCounterClockwise aria-hidden="true" size={18} />Repasos vencidos</dt><dd>{home.counts.dueReviews}</dd></div>
          <div><dt><Sparkle aria-hidden="true" size={18} />Puntos de aprendizaje</dt><dd>{home.points}</dd></div>
        </dl>
        <section className="learning-constancy-card" aria-labelledby="learning-constancy-title">
          <span className="learning-summary-icon"><CalendarCheck aria-hidden="true" size={20} /></span>
          <div><h3 id="learning-constancy-title">Constancia</h3>{home.constancy.weeklyGoalDays ? <><p><strong>{home.constancy.activeDaysThisWeek} de {home.constancy.weeklyGoalDays}</strong> días esta semana</p><progress aria-label="Meta semanal" max={home.constancy.weeklyGoalDays} value={Math.min(home.constancy.activeDaysThisWeek, home.constancy.weeklyGoalDays)} /></> : <p>La meta semanal es opcional y nunca penaliza una pausa.</p>}</div>
        </section>
        {home.milestones.length > 0 ? (
          <section className="learning-milestones" aria-labelledby="learning-milestones-title">
            <h3 id="learning-milestones-title"><Medal aria-hidden="true" size={19} /> Hitos</h3>
            <ul>{home.milestones.slice(0, 4).map((milestone) => <li key={milestone.awardKey}>{milestone.title}</li>)}</ul>
          </section>
        ) : null}
        <LearningPreferencesDialog paths={selectablePaths} preferences={home.preferences} />
        <Link className="learning-summary-link" href="/aprendizaje?tab=rutas">Elegir otra actividad <ArrowRight aria-hidden="true" size={16} /></Link>
      </aside>
    </div>
  );
}
