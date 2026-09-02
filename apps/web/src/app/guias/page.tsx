import { GuideDashboardScreen } from "@/components/guide-dashboard-screen";
import { getPublishedContent, getSubjects } from "@/lib/server/content-api";
import { currentUserIsAdministrator } from "@/lib/server/current-user";
import { getGuideCatalog } from "@/lib/content-guide-links";

export const dynamic = "force-dynamic";

export default async function GuidesPage() {
  const [result, subjectsResult, isAdministrator] = await Promise.all([
    getPublishedContent({ limit: 100 }),
    getSubjects(),
    currentUserIsAdministrator(),
  ]);
  const guides =
    result.status === "ready"
      ? getGuideCatalog(result.catalog.items)
      : [];

  return (
    <GuideDashboardScreen
      available={result.status === "ready"}
      guides={guides}
      isAdministrator={isAdministrator}
      subjects={subjectsResult.status === "ready" ? subjectsResult.subjects : []}
    />
  );
}
