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
        <div className="route-loading-orbit" aria-hidden="true">
          <span className="route-loading-ring" />
          <span className="route-loading-glyph"><BookOpen size={32} weight="duotone" /></span>
          <span className="route-loading-glyph"><PlayCircle size={32} weight="duotone" /></span>
          <span className="route-loading-glyph"><CardsThree size={32} weight="duotone" /></span>
        </div>
        <span className="route-loading-label">Cargando<span aria-hidden="true">…</span></span>
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
