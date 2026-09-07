import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DashboardScreen } from "@/components/dashboard-screen";
import { LearningCompletionPanel } from "@/components/learning/activities/learning-completion-panel";
import { LearningHomeScreen } from "@/components/learning/learning-home-screen";
import { LearningPathScreen } from "@/components/learning/learning-path-screen";
import {
  learningVisualAttempt,
  learningVisualAwards,
  learningVisualBlockedUpgrade,
  learningVisualCompleteHome,
  learningVisualHome,
  learningVisualLongTitleHome,
  learningVisualNewHome,
  learningVisualPathDetail,
  learningVisualPaths,
  learningVisualProgress,
  learningVisualUpgrade,
} from "@/components/learning/learning-visual-fixtures";

export const dynamic = "force-dynamic";

const supportedModes = new Set([
  "complete",
  "completion",
  "dashboard",
  "dashboard-empty",
  "dashboard-error",
  "error",
  "long",
  "new",
  "path",
  "path-upgrade",
  "path-upgrade-blocked",
  "progress",
  "routes",
  "today",
]);

function LearningFixtureShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      activeKey="learning"
      guidedLearningEnabled
      headerTitle="Aprendizaje guiado"
      viewer={{ email: "estudiante.visual@example.test" }}
    >
      {children}
    </AppShell>
  );
}

export default async function LearningVisualFixturePage({ searchParams }: {
  searchParams: Promise<{ estado?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();

  const requested = (await searchParams).estado ?? "today";
  const mode = supportedModes.has(requested) ? requested : "today";
  if (mode.startsWith("dashboard")) {
    return (
      <DashboardScreen
        available
        guidedLearningEnabled
        items={[]}
        learningHome={mode === "dashboard-empty" ? learningVisualNewHome : mode === "dashboard-error" ? null : learningVisualHome}
        learningHomeAvailable={mode !== "dashboard-error"}
        viewer={{ email: "estudiante.visual@example.test" }}
      />
    );
  }

  if (mode === "path" || mode === "path-upgrade" || mode === "path-upgrade-blocked") {
    const upgrade = mode === "path-upgrade"
      ? learningVisualUpgrade
      : mode === "path-upgrade-blocked"
        ? learningVisualBlockedUpgrade
        : null;
    return <LearningFixtureShell><LearningPathScreen path={learningVisualPathDetail} progress={learningVisualProgress} upgrade={upgrade} /></LearningFixtureShell>;
  }

  if (mode === "completion") {
    const completionProgress = {
      ...learningVisualProgress,
      completedEssentialSteps: 5,
      percentage: 71,
      units: learningVisualProgress.units.map((unit, index) => index === 1
        ? { ...unit, completedEssentialSteps: unit.totalEssentialSteps }
        : unit),
    };
    return (
      <LearningFixtureShell>
        <main className="learning-activity-main">
          <LearningCompletionPanel attempt={learningVisualAttempt} awards={learningVisualAwards} progress={completionProgress} />
        </main>
      </LearningFixtureShell>
    );
  }

  const error = mode === "error";
  const home = mode === "new"
    ? learningVisualNewHome
    : mode === "complete"
      ? learningVisualCompleteHome
      : mode === "long"
        ? learningVisualLongTitleHome
        : learningVisualHome;
  const tab = mode === "routes" ? "rutas" : mode === "progress" ? "progreso" : "hoy";
  const paths = mode === "new"
    ? learningVisualPaths.map((path) => ({ ...path, enrollment: null }))
    : mode === "long"
      ? learningVisualPaths.map((path, index) => index === 0 ? { ...path, title: home.activePath?.title ?? path.title } : path)
      : learningVisualPaths;

  return (
    <LearningFixtureShell>
      <LearningHomeScreen
        available={!error}
        home={error ? null : home}
        homeAvailable={!error}
        paths={error ? [] : paths}
        progress={error ? [] : [learningVisualProgress]}
        tab={tab}
      />
    </LearningFixtureShell>
  );
}
