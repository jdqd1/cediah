import { DashboardScreen } from "@/components/dashboard-screen";
import { getPublishedContent } from "@/lib/server/content-api";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const result = await getPublishedContent({ limit: 24 });

  return (
    <DashboardScreen
      available={result.status === "ready"}
      items={result.status === "ready" ? result.catalog.items : []}
    />
  );
}
