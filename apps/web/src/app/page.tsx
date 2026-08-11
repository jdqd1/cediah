import { redirect } from "next/navigation";
import { LandingScreen } from "@/components/landing-screen";
import { getCurrentUser } from "@/lib/server/current-user";

// The root page contains interactive auth controls. Keep it request-rendered so
// the nonce injected by proxy.ts is also present on the hydration scripts.
export const dynamic = "force-dynamic";

export default async function Home() {
  const current = await getCurrentUser();
  if (current.status === "authenticated") redirect("/dashboard");

  return <LandingScreen />;
}
