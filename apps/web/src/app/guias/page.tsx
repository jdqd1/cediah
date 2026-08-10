import { GuideDashboardScreen } from "@/components/guide-dashboard-screen";
import { getPublishedContent } from "@/lib/server/content-api";

export const dynamic = "force-dynamic";

export default async function GuidesPage() {
  const result = await getPublishedContent({ kind: "guide", limit: 100 });
  const guides =
    result.status === "ready"
      ? result.catalog.items.filter((item) => item.kind === "guide")
      : [];

  return (
    <GuideDashboardScreen
      available={result.status === "ready"}
      guides={guides}
    />
  );
}
