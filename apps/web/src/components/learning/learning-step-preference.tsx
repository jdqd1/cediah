"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function LearningStepPreference({
  enrollmentId,
  rowVersion,
  skipped,
  stepId,
}: {
  enrollmentId: string;
  rowVersion: number;
  skipped: boolean;
  stepId: string;
}) {
  const router = useRouter();
  const requestKey = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function update() {
    setBusy(true);
    setMessage("");
    requestKey.current ??= crypto.randomUUID();
    try {
      const response = await fetch(`/api/guided-learning/steps/${stepId}/preference`, {
        body: JSON.stringify({
          action: skipped ? "unskip" : "skip",
          enrollmentId,
          expectedVersion: rowVersion,
        }),
        headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey.current },
        method: "PATCH",
      });
      if (!response.ok) {
        setMessage(response.status === 409
          ? "El estado cambió en otro dispositivo. Actualiza la ruta."
          : "No pudimos guardar esta preferencia; el paso conserva su estado anterior.");
        return;
      }
      requestKey.current = null;
      router.refresh();
    } catch {
      setMessage("Sin conexión: la omisión no se marcó como guardada.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="learning-step-preference">
      <button disabled={busy} onClick={() => void update()} type="button">
        {busy ? "Guardando…" : skipped ? "Restaurar en recomendaciones" : "Omitir por ahora"}
      </button>
      <small aria-live="polite">{message || (skipped ? "Omitido, no completado. Puedes abrirlo igualmente." : "No bloquea el acceso a otros pasos.")}</small>
    </div>
  );
}
