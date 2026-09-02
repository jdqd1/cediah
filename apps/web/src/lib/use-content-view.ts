"use client";

import { useEffect } from "react";

const inFlight = new Set<string>();
const recentViews = new Map<string, number>();
const repeatWindow = 30 * 60 * 1000;

/** Mounted readers only: prefetches, server renders and editorial previews never count. */
export function useContentView(contentId: string | null) {
  useEffect(() => {
    if (!contentId) return;
    const id = contentId;
    const key = `koraz:view:${id}`;
    let timer: number | undefined;

    function wasRecentlyViewed() {
      let previous = recentViews.get(id) ?? 0;
      try { previous = Math.max(previous, Number(sessionStorage.getItem(key)) || 0); } catch { /* Storage can be blocked. */ }
      return Date.now() - previous < repeatWindow;
    }

    function schedule() {
      window.clearTimeout(timer);
      if (document.visibilityState !== "visible" || inFlight.has(id) || wasRecentlyViewed()) return;
      timer = window.setTimeout(async () => {
        if (document.visibilityState !== "visible" || inFlight.has(id) || wasRecentlyViewed()) return;
        inFlight.add(id);
        try {
          const response = await fetch(`/api/content/${encodeURIComponent(id)}/views`, {
            method: "POST", credentials: "same-origin", keepalive: true,
          });
          if (response.ok) {
            const now = Date.now();
            recentViews.set(id, now);
            try { sessionStorage.setItem(key, String(now)); } catch { /* Server also deduplicates. */ }
          }
        } catch { /* Analytics must never interrupt reading. */ }
        finally { inFlight.delete(id); }
      }, 4_000);
    }

    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [contentId]);
}
