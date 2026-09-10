"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle, MapTrifold, Sparkle, Trophy } from "@phosphor-icons/react";
import type { LearningAttempt, LearningEnrollmentProgress, LearningReward } from "@cediah/contracts";

export function LearningCompletionPanel({ attempt, awards, progress, returnHref }: {
  attempt: LearningAttempt;
  awards: LearningReward[];
  progress: LearningEnrollmentProgress | null;
  returnHref?: string;
}) {
  const awardedXp = awards.reduce((total, award) => total + award.xp, 0);
  const milestones = awards.filter((award) => award.kind === "route_completed" || award.kind.startsWith("milestone_"));
  const needsReinforcement = attempt.score !== null && attempt.score.percent < 60;
  return (
    <section className="learning-completion-panel">
      <span className="learning-completion-check"><CheckCircle aria-hidden="true" size={52} weight="fill" /></span>
      <span>Progreso guardado</span>
      <h2>{attempt.manifest.projection === "review" ? "Repaso completado" : "Actividad completada"}</h2>
      {attempt.score ? <p><strong>Resultado: {attempt.score.correct} de {attempt.score.total}.</strong> {needsReinforcement ? "Conviene reforzar este punto; la ruta sigue completamente accesible." : "Buen trabajo: esta comprobación ya forma parte de tu evidencia."}</p> : <p>La evidencia quedó confirmada por el servidor. Puedes detenerte aquí o elegir cómo continuar.</p>}
      {awardedXp > 0 ? <div className="learning-completion-reward"><Sparkle aria-hidden="true" size={22} weight="fill" /><span><strong>+{awardedXp} XP</strong><small>Puntos de aprendizaje nuevos</small></span></div> : null}
      {milestones.length > 0 ? <ul className="learning-completion-milestones">{milestones.map((milestone) => <li key={milestone.awardKey}><Trophy aria-hidden="true" size={18} />{milestone.title}</li>)}</ul> : null}
      {progress ? <div>
        <div className="learning-completion-progress-copy"><strong>{progress.percentage}% de la ruta</strong><span>{progress.completedEssentialSteps} de {progress.totalEssentialSteps} actividades esenciales</span></div>
        <progress aria-label="Avance actualizado de la ruta" max={progress.totalEssentialSteps} value={progress.completedEssentialSteps} />
      </div> : <p>El calendario quedó actualizado solo para las respuestas aceptadas. Puedes elegir otra actividad o volver a Inicio.</p>}
      <div className="learning-completion-actions">
        <Link className="learning-primary-button" href={returnHref ?? "/aprendizaje?tab=hoy"}>{returnHref ? "Volver a mi mapa" : "Continuar"} <ArrowRight aria-hidden="true" size={19} /></Link>
        <Link className="learning-secondary-button" href={attempt.pathSlug ? `/aprendizaje/rutas/${attempt.pathSlug}` : "/aprendizaje?tab=rutas"}><MapTrifold aria-hidden="true" size={19} />{attempt.pathSlug ? "Volver a mi ruta" : "Elegir otra actividad"}</Link>
      </div>
    </section>
  );
}
