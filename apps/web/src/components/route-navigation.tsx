"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

let navigationDirection: "forward" | "back" = "forward";

function internalLink(target: EventTarget | null) {
  const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin || url.hash) return null;
  return { anchor, href: url.pathname + url.search };
}

/** Intent-based prefetch avoids downloading every reader/document in a list. */
export function useNavigationIntent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = pathname + (searchParams.size ? `?${searchParams}` : "");
  const trail = useRef<string[]>([]);
  const position = useRef(-1);

  useEffect(() => {
    const known = trail.current.lastIndexOf(routeKey);
    if (known >= 0) position.current = known;
    else {
      trail.current = trail.current.slice(0, position.current + 1).concat(routeKey);
      position.current = trail.current.length - 1;
    }
  }, [routeKey]);

  useEffect(() => {
    const warmed = new Map<string, number>();
    let timer: number | undefined;
    let candidate = "";
    function prefetch(href: string) {
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      if (connection?.saveData || href.startsWith("/api/") || href.startsWith("/panel/") || href.startsWith("/acceder")) return;
      if (Date.now() - (warmed.get(href) ?? 0) < 30_000) return;
      if (warmed.size > 40) warmed.clear();
      warmed.set(href, Date.now());
      router.prefetch(href);
    }
    function onHover(event: Event) {
      const link = internalLink(event.target);
      if (!link || link.href === window.location.pathname + window.location.search) return;
      if (candidate === link.href) return;
      candidate = link.href;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => prefetch(link.href), 120);
    }
    function onFocus(event: Event) {
      const link = internalLink(event.target);
      if (link) prefetch(link.href);
    }
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = internalLink(event.target);
      if (!link) return;
      navigationDirection = link.anchor.dataset.navigationDirection === "back" ? "back" : "forward";
    }
    function onPopState() {
      const target = trail.current.lastIndexOf(window.location.pathname + window.location.search);
      navigationDirection = target < position.current ? "back" : "forward";
    }
    document.addEventListener("pointerover", onHover, { passive: true });
    document.addEventListener("focusin", onFocus);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerover", onHover);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [router]);
}

export function RouteMain({ children, className }: { children: ReactNode; className: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mainRef = useRef<HTMLElement>(null);
  const routeKey = pathname + searchParams.toString();

  useEffect(() => {
    const main = mainRef.current;
    if (!main || !main.animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Readers/editors own fixed controls: never give their ancestors a transform.
    const hasFixedControls = main.matches(".guide-editor-main, .route-loading-main") || main.querySelector(".published-rich-guide-reader");
    const offset = navigationDirection === "back" ? "-10px" : "10px";
    const frames = hasFixedControls
      ? [{ opacity: 0.75 }, { opacity: 1 }]
      : [{ opacity: 0.65, transform: `translateX(${offset})` }, { opacity: 1, transform: "translateX(0)" }];
    const animation = main.animate(frames, { duration: 180, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" });
    return () => animation.cancel();
  }, [routeKey]);

  return <main className={`app-main ${className}`.trim()} data-pathname={pathname} ref={mainRef}>{children}</main>;
}
