"use client";

import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

export function DashboardRecentCarousel({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [canScroll, setCanScroll] = useState(false);

  const updateScrollState = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    setCanScroll(maxScroll > 2);
    if (viewport.scrollLeft >= maxScroll - 2) setDirection("left");
    else if (viewport.scrollLeft <= 2) setDirection("right");
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(viewport);
    const list = viewport.firstElementChild;
    if (list) observer.observe(list);
    updateScrollState();
    return () => observer.disconnect();
  }, [updateScrollState]);

  function scroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const firstCard = viewport.querySelector<HTMLElement>(".dashboard-guide-grid > li");
    const step = firstCard ? firstCard.offsetWidth + 12 : viewport.clientWidth * 0.75;
    viewport.scrollBy({ left: (direction === "right" ? 1 : -1) * step, behavior: "smooth" });
  }

  return (
    <div className="dashboard-recent-carousel">
      <div className="dashboard-recent-viewport" onScroll={updateScrollState} ref={viewportRef}>{children}</div>
      {canScroll && (
        <button
          aria-label={direction === "right" ? "Ver más guías" : "Volver a guías anteriores"}
          className="dashboard-recent-control"
          onClick={scroll}
          type="button"
        >
          {direction === "right" ? <ArrowRight aria-hidden="true" size={20} /> : <ArrowLeft aria-hidden="true" size={20} />}
        </button>
      )}
    </div>
  );
}
