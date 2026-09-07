import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityLauncher } from "@/components/learning/activity-launcher";
import {
  getLearningAttempt,
  getLearningPath,
  getLearningProgress,
} from "@/lib/server/guided-learning-api";

export const dynamic = "force-dynamic";

export default async function LearningActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; stepId: string }>;
  searchParams: Promise<{ opcion?: string }>;
}) {
  const [{ slug, stepId }, query] = await Promise.all([params, searchParams]);
  const pathResult = await getLearningPath(slug);
  if (pathResult.status !== "ready" || !pathResult.path.enrollment) notFound();
  const step = pathResult.path.version.units.flatMap((unit) => unit.steps)
    .find((entry) => entry.id === stepId);
  const option = step?.options.find((entry) => entry.id === query.opcion);
  if (!step || !option) notFound();

  const progressResult = await getLearningProgress(pathResult.path.enrollment.id);
  if (progressResult.status !== "ready") {
    return <main className="learning-main"><section className="learning-empty" role="alert"><div><h1>No pudimos confirmar tu progreso</h1><p>No abriremos un intento nuevo hasta recuperar el estado persistido del servidor.</p></div><Link className="learning-secondary-button" href={`/aprendizaje/rutas/${slug}/actividades/${stepId}?opcion=${option.id}`}>Reintentar</Link></section></main>;
  }
  const progressStep = progressResult.progress.units.flatMap((unit) => unit.steps)
    .find((entry) => entry.stepId === step.id);
  let existingAttemptId: string | null = null;
  if (progressStep?.attemptId) {
    const attemptResult = await getLearningAttempt(progressStep.attemptId);
    if (attemptResult.status === "ready" && attemptResult.attempt.stepOptionId === option.id) {
      existingAttemptId = attemptResult.attempt.id;
    }
  }
  return (
    <ActivityLauncher
      existingAttemptId={existingAttemptId}
      optionId={option.id}
      pathSlug={pathResult.path.slug}
      stepTitle={step.title}
    />
  );
}
