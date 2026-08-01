"use client";

import { useEffect, useState } from "react";

type SystemState = "checking" | "ready" | "offline";

const labels: Record<SystemState, string> = {
  checking: "Verificando servicios",
  ready: "Base tecnica operativa",
  offline: "API local no disponible",
};

export function SystemStatus() {
  const [state, setState] = useState<SystemState>("checking");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/system-health", {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => {
        setState(response.ok ? "ready" : "offline");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("offline");
      });

    return () => controller.abort();
  }, []);

  return (
    <span className="system-status" data-state={state} role="status" aria-live="polite">
      <span className="status-dot" aria-hidden="true" />
      {labels[state]}
    </span>
  );
}
