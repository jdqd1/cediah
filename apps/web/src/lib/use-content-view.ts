"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ContentViewResponse } from "@cediah/contracts";
import { createContentViewTracker } from "./content-view-tracker";

/** Readers count after four visible seconds; videos activate only on playback. */
export function useContentView(contentId: string | null, {
  automatic = true,
  onRecorded,
}: { automatic?: boolean; onRecorded?: (result: ContentViewResponse) => void } = {}) {
  const trackerRef = useRef<ReturnType<typeof createContentViewTracker> | null>(null);
  const trackerContentIdRef = useRef<string | null>(null);
  const pendingContentIdRef = useRef<string | null>(null);
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => { onRecordedRef.current = onRecorded; }, [onRecorded]);

  useEffect(() => {
    if (!contentId) {
      pendingContentIdRef.current = null;
      return;
    }
    const tracker = createContentViewTracker(contentId, (result) => onRecordedRef.current?.(result));
    trackerRef.current = tracker;
    trackerContentIdRef.current = contentId;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function schedule() {
      clearTimeout(timer);
      tracker.resume();
      if (automatic && document.visibilityState === "visible") timer = setTimeout(tracker.record, 4_000);
    }
    schedule();
    if (pendingContentIdRef.current === contentId) {
      pendingContentIdRef.current = null;
      tracker.record();
    }
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener("online", schedule);
    return () => {
      clearTimeout(timer);
      tracker.dispose();
      if (trackerRef.current === tracker) {
        trackerRef.current = null;
        trackerContentIdRef.current = null;
      }
      document.removeEventListener("visibilitychange", schedule);
      window.removeEventListener("online", schedule);
    };
  }, [contentId, automatic]);
  return useCallback(() => {
    if (!contentId) return;
    if (trackerContentIdRef.current === contentId) trackerRef.current?.record();
    else pendingContentIdRef.current = contentId;
  }, [contentId]);
}
