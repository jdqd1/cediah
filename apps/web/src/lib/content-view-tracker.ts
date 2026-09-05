import { ContentViewResponseSchema, type ContentViewResponse } from "@cediah/contracts";

const retryDelays = [1_000, 3_000, 10_000, 30_000, 60_000];

/** One mounted reader/player owns its pending view; only the server deduplicates users. */
export function createContentViewTracker(contentId: string, onRecorded: (result: ContentViewResponse) => void) {
  let eligible = false;
  let disposed = false;
  let terminal = false;
  let failures = 0;
  let nextAttemptAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | null = null;

  async function send() {
    if (!eligible || disposed || terminal || controller || Date.now() < nextAttemptAt ||
      document.visibilityState !== "visible" || navigator.onLine === false) return;
    clearTimeout(timer);
    controller = new AbortController();
    const requestController = controller;
    const timeout = setTimeout(() => requestController.abort(), 8_000);
    try {
      const response = await fetch(`/api/content/${encodeURIComponent(contentId)}/views`, {
        method: "POST", credentials: "same-origin", cache: "no-store", keepalive: true, signal: requestController.signal,
      });
      if ([400, 403, 404].includes(response.status)) { terminal = true; return; }
      if (!response.ok) throw new Error("views_unavailable");
      const result = ContentViewResponseSchema.parse(await response.json());
      if (disposed) return;
      eligible = false;
      failures = 0;
      nextAttemptAt = Date.now() + result.retryAfterMs;
      onRecorded(result);
    } catch {
      if (disposed) return;
      const delay = retryDelays[failures++];
      nextAttemptAt = delay === undefined ? Infinity : Date.now() + delay;
      if (delay !== undefined) timer = setTimeout(() => { void send(); }, delay);
    } finally {
      clearTimeout(timeout);
      controller = null;
    }
  }

  return {
    record() {
      if (Date.now() < nextAttemptAt) return;
      eligible = true;
      void send();
    },
    resume() {
      if (nextAttemptAt === Infinity) { failures = 0; nextAttemptAt = 0; }
      void send();
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
    },
  };
}
