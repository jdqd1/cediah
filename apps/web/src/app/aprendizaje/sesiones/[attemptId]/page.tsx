import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityShell } from "@/components/learning/activities/activity-shell";
import { getLearningAttempt, getLearningProgress } from "@/lib/server/guided-learning-api";
import { getCurrentUser } from "@/lib/server/current-user";
import { safeMapReturnHref } from "@/components/learning/map/map-route";

export const dynamic = "force-dynamic";

export default async function LearningSessionPage({ params, searchParams }: { params: Promise<{ attemptId: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const { attemptId } = await params;
  const returnHref = safeMapReturnHref((await searchParams).returnTo) ?? undefined;
  const [attemptResult, current] = await Promise.all([getLearningAttempt(attemptId), getCurrentUser()]);
  if (attemptResult.status === "not_found") notFound();
  if (attemptResult.status !== "ready" || current.status !== "authenticated") {
    return <main className="learning-main"><section className="learning-empty" role="alert"><div><h1>No pudimos recuperar la sesión</h1><p>No se inventó ningún avance. Reintenta para cargar el último estado confirmado.</p></div><Link className="learning-secondary-button" href={`/aprendizaje/sesiones/${attemptId}${returnHref ? `?${new URLSearchParams({returnTo:returnHref})}` : ""}`}>Reintentar</Link></section></main>;
  }
  const enrollmentId = attemptResult.attempt.enrollmentId;
  const progressResult = enrollmentId ? await getLearningProgress(enrollmentId) : null;
  if (enrollmentId && progressResult?.status !== "ready") {
    return <main className="learning-main"><section className="learning-empty" role="alert"><div><h1>No pudimos cargar el progreso</h1><p>La sesión está guardada, pero necesitamos el resumen del servidor antes de continuar.</p></div><Link className="learning-secondary-button" href={`/aprendizaje/sesiones/${attemptId}${returnHref ? `?${new URLSearchParams({returnTo:returnHref})}` : ""}`}>Reintentar</Link></section></main>;
  }
  return <ActivityShell initialAttempt={attemptResult.attempt} initialProgress={progressResult?.status === "ready" ? progressResult.progress : null} userId={current.user.id} returnHref={returnHref} />;
}
