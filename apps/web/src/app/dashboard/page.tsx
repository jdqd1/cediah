import { DashboardScreen } from "@/components/dashboard-screen";
import { getPublishedContent } from "@/lib/server/content-api";
import { getAdminRoleUser } from "@/lib/server/admin-role-api";
import { getCurrentUser } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [result, current] = await Promise.all([
    getPublishedContent({ limit: 24 }),
    getCurrentUser(),
  ]);
  let isAdministrator = false;
  if (current.status === "authenticated") {
    const admin = await getAdminRoleUser(current.accessToken, current.user.email);
    isAdministrator = admin.status === "ready" && admin.user.roles.includes("administrator");
  }

  return (
    <DashboardScreen
      available={result.status === "ready"}
      items={result.status === "ready" ? result.catalog.items : []}
      isAdministrator={isAdministrator}
      viewer={current.status === "authenticated" ? { email: current.user.email } : undefined}
    />
  );
}
