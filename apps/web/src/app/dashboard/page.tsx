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
  let canManageContent = false;
  if (current.status === "authenticated") {
    const admin = await getAdminRoleUser(current.accessToken, current.user.email);
    if (admin.status === "ready") {
      isAdministrator = admin.user.roles.includes("administrator");
      canManageContent = admin.user.roles.some(
        (role) =>
          role === "community_contributor" ||
          role === "presenter" ||
          role === "academic_editor" ||
          role === "coordination" ||
          role === "administrator",
      );
    }
  }

  return (
    <DashboardScreen
      available={result.status === "ready"}
      items={result.status === "ready" ? result.catalog.items : []}
      canManageContent={canManageContent}
      isAdministrator={isAdministrator}
      viewer={current.status === "authenticated" ? { email: current.user.email } : undefined}
    />
  );
}
