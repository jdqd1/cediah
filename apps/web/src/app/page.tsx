import { LandingScreen } from "@/components/landing-screen";

// The root page contains interactive auth controls. Keep it request-rendered so
// the nonce injected by proxy.ts is also present on the hydration scripts.
export const dynamic = "force-dynamic";

export default function Home() {
  return <LandingScreen />;
}
