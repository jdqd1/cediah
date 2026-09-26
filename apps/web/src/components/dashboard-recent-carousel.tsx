"use client";

import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { type ReactNode, useRef } from "react";

export function DashboardRecentCarousel({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);

  function scroll(direction: -1 | 1) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const firstCard = viewport.querySelector<HTMLElement>(".dashboard-guide-grid > li");
    const step = firstCard ? firstCard.offsetWidth + 12 : viewport.clientWidth * 0.75;
    viewport.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  return (
    <div className="dashboard-recent-carousel">
      <div className="dashboard-recent-viewport" ref={viewportRef}>{children}</div>
      <div className="dashboard-recent-controls" role="group" aria-label="Desplazar guías recientes">
        <button aria-label="Ver guías anteriores" onClick={() => scroll(-1)} type="button"><ArrowLeft size={18} /></button>
        <button aria-label="Ver más guías" onClick={() => scroll(1)} type="button"><ArrowRight size={18} /></button>
      </div>
    </div>
  );
}
