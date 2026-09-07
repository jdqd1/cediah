"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, RocketLaunch } from "@phosphor-icons/react";
import type { LearningEnrollmentSummary } from "@cediah/contracts";

export function LearningEnrollmentActions({ enrollment: initialEnrollment, pathId }: {
  enrollment: LearningEnrollmentSummary | null;
  pathId: string;
}) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState(initialEnrollment);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function send(body: unknown, url: string, method: "PATCH" | "POST") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(url, {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method,
      });
      const result = await response.json() as {
        enrollment?: LearningEnrollmentSummary;
        error?: string;
      };
      if (!response.ok || !result.enrollment) {
        setMessage(result.error === "version_conflict"
          ? "La ruta cambió en otra pestaña. Actualiza para ver su estado confirmado."
          : "No pudimos guardar el cambio. Intenta de nuevo.");
        return;
      }
      setEnrollment(result.enrollment);
      setMessage(result.enrollment.status === "paused"
        ? "Ruta pausada. Tu avance se conserva."
        : "Cambio guardado.");
      router.refresh();
    } catch {
      setMessage("No hay conexión para confirmar el cambio. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="learning-enrollment-actions">
      {!enrollment ? (
        <button
          className="learning-primary-button"
          disabled={busy}
          onClick={() => send({ pathId }, "/api/guided-learning/enrollments", "POST")}
          type="button"
        >
          <RocketLaunch aria-hidden="true" size={20} />
          {busy ? "Comenzando…" : "Comenzar ruta"}
        </button>
      ) : enrollment.status === "paused" || enrollment.status === "archived" ? (
        <button
          className="learning-primary-button"
          disabled={busy}
          onClick={() => send(
            { expectedVersion: enrollment.rowVersion, status: "active" },
            `/api/guided-learning/enrollments/${enrollment.id}`,
            "PATCH",
          )}
          type="button"
        >
          <Play aria-hidden="true" size={20} />
          {busy ? "Guardando…" : "Reanudar ruta"}
        </button>
      ) : (
        <button
          className="learning-secondary-button"
          disabled={busy}
          onClick={() => send(
            { expectedVersion: enrollment.rowVersion, status: "paused" },
            `/api/guided-learning/enrollments/${enrollment.id}`,
            "PATCH",
          )}
          type="button"
        >
          <Pause aria-hidden="true" size={20} />
          {busy ? "Guardando…" : "Pausar ruta"}
        </button>
      )}
      <p aria-live="polite" className={message ? "learning-save-message is-visible" : "learning-save-message"}>{message}</p>
    </div>
  );
}
