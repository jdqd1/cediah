import { GuideDashboardScreen } from "@/components/guide-dashboard-screen";
import { getPublishedContent } from "@/lib/server/content-api";
import { currentUserIsAdministrator } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";

export default async function GuidesPage() {
  const [result, isAdministrator] = await Promise.all([
    getPublishedContent({ kind: "guide", limit: 100 }),
    currentUserIsAdministrator(),
  ]);
  const guides =
    result.status === "ready"
      ? result.catalog.items.filter((item) => item.kind === "guide")
      : [];

  return (
    <GuideDashboardScreen
      available={result.status === "ready"}
      guides={guides}
      isAdministrator={isAdministrator}
    />
  );
}
