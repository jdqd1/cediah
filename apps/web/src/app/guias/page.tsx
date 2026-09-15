import { GuideDashboardScreen } from "@/components/guide-dashboard-screen";
import { getPublishedStudyCatalog, getSubjects } from "@/lib/server/content-api";
import { currentUserIsAdministrator } from "@/lib/server/current-user";
import { getStudySummaryCatalog } from "@/lib/study-catalog";

export const dynamic = "force-dynamic";

export default async function GuidesPage() {
  const [result, subjectsResult, isAdministrator] = await Promise.all([
    getPublishedStudyCatalog({ limit: 1_000 }),
    getSubjects(),
    currentUserIsAdministrator(),
  ]);
  const guides =
    result.status === "ready"
      ? getStudySummaryCatalog(result.catalog.items, "guide")
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
