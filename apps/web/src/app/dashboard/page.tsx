import { DashboardScreen } from "@/components/dashboard-screen";
import { getPublishedContent } from "@/lib/server/content-api";
import { getCurrentUser } from "@/lib/server/current-user";
import { getLearningHome } from "@/lib/server/guided-learning-api";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const resultPromise = getPublishedContent({ limit: 100 });
  const recentPromise = getPublishedContent({ kind: "video", limit: 4 });
  const highlightedPromise = getPublishedContent({ kind: "video", sort: "views", limit: 8 });
  const current = await getCurrentUser();
  const learningPromise = current.status === "authenticated" && current.features.guidedLearning
    ? getLearningHome()
    : Promise.resolve(null);
  const [result, recent, highlighted, learning] = await Promise.all([
    resultPromise,
    recentPromise,
    highlightedPromise,
    learningPromise,
  ]);
  let isAdministrator = false;
  if (current.status === "authenticated") {
    isAdministrator = current.roles.includes("administrator");
  }

  return (
    <DashboardScreen
      available={result.status === "ready"}
      items={result.status === "ready" ? result.catalog.items : []}
      recentItems={recent.status === "ready" ? recent.catalog.items : []}
      highlightedItems={highlighted.status === "ready" ? highlighted.catalog.items : []}
      guidedLearningEnabled={current.status === "authenticated" && current.features.guidedLearning}
      isAdministrator={isAdministrator}
      learningHome={learning?.status === "ready" ? learning.home : null}
      learningHomeAvailable={learning?.status === "ready"}
      viewer={current.status === "authenticated" ? { email: current.user.email } : undefined}
    />
  );
}
