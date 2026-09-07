import { LearningHomeScreen } from "@/components/learning/learning-home-screen";
import { getLearningHome, getLearningPaths, getLearningProgress } from "@/lib/server/guided-learning-api";

export const dynamic = "force-dynamic";

export default async function LearningPage({ searchParams }: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const requested = (await searchParams).tab;
  const tab = requested === "rutas" || requested === "progreso" ? requested : "hoy";
  const [result, homeResult] = await Promise.all([getLearningPaths(), getLearningHome()]);
  const paths = result.status === "ready" ? result.items : [];
  const progress = tab === "progreso" ? (await Promise.all(paths.flatMap((path) =>
    path.enrollment && path.enrollment.status !== "archived"
      ? [getLearningProgress(path.enrollment.id)]
      : []))).flatMap((entry) => entry.status === "ready" ? [entry.progress] : []) : [];
  return <LearningHomeScreen
    available={result.status === "ready"}
    home={homeResult.status === "ready" ? homeResult.home : null}
    homeAvailable={homeResult.status === "ready"}
    paths={paths}
    progress={progress}
    tab={tab}
  />;
}
