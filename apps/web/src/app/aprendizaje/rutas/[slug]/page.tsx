import Link from "next/link";
import { notFound } from "next/navigation";
import { LearningPathScreen } from "@/components/learning/learning-path-screen";
import { getLearningPath, getLearningProgress, getLearningUpgradePreview } from "@/lib/server/guided-learning-api";

export const dynamic = "force-dynamic";

export default async function LearningPathPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getLearningPath(slug);
  if (result.status === "not_found") notFound();
  if (result.status !== "ready") {
    return <main className="learning-main"><section className="learning-empty" role="alert"><div><h1>No pudimos abrir esta ruta</h1><p>Tu progreso no cambió. Intenta de nuevo cuando la conexión esté disponible.</p></div><Link className="learning-secondary-button" href={`/aprendizaje/rutas/${slug}`}>Reintentar</Link></section></main>;
  }
  const [progress, upgrade] = result.path.enrollment
    ? await Promise.all([
      getLearningProgress(result.path.enrollment.id),
      getLearningUpgradePreview(result.path.enrollment.id),
    ])
    : [null, null];
  return <LearningPathScreen path={result.path} progress={progress?.status === "ready" ? progress.progress : null} upgrade={upgrade?.status === "ready" ? upgrade : null} />;
}
