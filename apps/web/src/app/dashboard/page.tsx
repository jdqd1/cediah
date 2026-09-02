import { DashboardScreen } from "@/components/dashboard-screen";
import { getPublishedContent } from "@/lib/server/content-api";
import { getCurrentUser } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [result, current, recent, highlighted] = await Promise.all([
    getPublishedContent({ limit: 100 }),
    getCurrentUser(),
    getPublishedContent({ kind: "video", limit: 4 }),
    getPublishedContent({ sort: "views", limit: 8 }),
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
      isAdministrator={isAdministrator}
      viewer={current.status === "authenticated" ? { email: current.user.email } : undefined}
    />
  );
}
