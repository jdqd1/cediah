import { DashboardScreen } from "@/components/dashboard-screen";
import { getLastReadGuide, getPublishedContent } from "@/lib/server/content-api";
import { getCurrentUser } from "@/lib/server/current-user";
import { getLearningHome } from "@/lib/server/guided-learning-api";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const recentPromise = getPublishedContent({ kind: "guide", limit: 5 });
  const current = await getCurrentUser();
  const lastReadPromise = current.status === "authenticated"
    ? getLastReadGuide()
    : Promise.resolve({ guide: null, status: "ready" } as const);
  const learningPromise = current.status === "authenticated" && current.features.guidedLearning
    ? getLearningHome()
    : Promise.resolve(null);
  const [recent, lastRead, learning] = await Promise.all([
    recentPromise,
    lastReadPromise,
    learningPromise,
  ]);
  let isAdministrator = false;
  if (current.status === "authenticated") {
    isAdministrator = current.roles.includes("administrator");
  }

  return (
    <DashboardScreen
      available={recent.status === "ready"}
      recentItems={recent.status === "ready" ? recent.catalog.items : []}
      lastReadGuide={lastRead.status === "ready" ? lastRead.guide : null}
      lastReadAvailable={lastRead.status === "ready"}
      guidedLearningEnabled={current.status === "authenticated" && current.features.guidedLearning}
      isAdministrator={isAdministrator}
      learningHome={learning?.status === "ready" ? learning.home : null}
      learningHomeAvailable={learning?.status === "ready"}
      viewer={current.status === "authenticated" ? { email: current.user.email } : undefined}
    />
  );
}
