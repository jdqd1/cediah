"use client";

import { useCallback, useEffect } from "react";

const inFlight = new Set<string>();
const recentViews = new Map<string, number>();
const repeatWindow = 30 * 60 * 1000;

function wasRecentlyViewed(id: string) {
  let previous = recentViews.get(id) ?? 0;
  try { previous = Math.max(previous, Number(sessionStorage.getItem(`koraz:view:${id}`)) || 0); } catch { /* Storage can be blocked. */ }
  return Date.now() - previous < repeatWindow;
}

async function recordContentView(id: string) {
  if (document.visibilityState !== "visible" || inFlight.has(id) || wasRecentlyViewed(id)) return false;
  inFlight.add(id);
  try {
    const response = await fetch(`/api/content/${encodeURIComponent(id)}/views`, {
      method: "POST", credentials: "same-origin", keepalive: true,
    });
    if (!response.ok) return false;
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("counted" in result) || typeof result.counted !== "boolean") return false;
    const now = Date.now();
    recentViews.set(id, now);
    try { sessionStorage.setItem(`koraz:view:${id}`, String(now)); } catch { /* Server also deduplicates. */ }
    return result.counted;
  } catch { return false; /* Analytics must never interrupt reading or playback. */ }
  finally { inFlight.delete(id); }
}

/** Readers count after four visible seconds; videos explicitly count on playback. */
export function useContentView(contentId: string | null, { automatic = true } = {}) {
  const recordView = useCallback(() => contentId ? recordContentView(contentId) : Promise.resolve(false), [contentId]);
  useEffect(() => {
    if (!contentId || !automatic) return;
    const id = contentId;
    let timer: number | undefined;

    function schedule() {
      window.clearTimeout(timer);
      if (document.visibilityState !== "visible" || inFlight.has(id) || wasRecentlyViewed(id)) return;
      timer = window.setTimeout(() => { void recordView(); }, 4_000);
    }

    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [contentId, automatic, recordView]);
  return recordView;
}
