"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, CardsThree, PlayCircle } from "@phosphor-icons/react";
import { isPlatformPath } from "@/lib/platform-routes";
import { AppShell } from "./app-shell";

function LoadingContent() {
  return (
    <section className="route-loading route-loading-screen" aria-busy="true" aria-live="polite" role="status">
      <div className="route-loading-lockup">
        <div className="route-loading-symbols" aria-hidden="true">
          <PlayCircle size={22} /><BookOpen size={25} /><CardsThree size={22} />
        </div>
        <div><strong>Un momento, seguimos contigo</strong><p>Preparando tu espacio de estudio</p></div>
        <span className="route-loading-progress" aria-hidden="true"><span /></span>
      </div>
    </section>
  );
}

export function RouteLoadingScreen() {
  const pathname = usePathname();
  const inPlatform = isPlatformPath(pathname);
  if (!inPlatform) return <LoadingContent />;
  return (
    <Suspense fallback={<LoadingContent />}>
      <AppShell activeKey="" headerTitle="Koraz" mainClassName="route-loading-main"><LoadingContent /></AppShell>
    </Suspense>
  );
}
