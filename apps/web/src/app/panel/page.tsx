import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/current-user";

export const dynamic = "force-dynamic";

export default async function LegacyPanelPage() {
  const current = await getCurrentUser();
  if (current.status === "anonymous") redirect("/acceder?next=/dashboard");

  redirect("/dashboard");
}
