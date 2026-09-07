"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Play } from "@phosphor-icons/react";
import { LearningAttemptMutationResponseSchema } from "@cediah/contracts";

export function ActivityLauncher({
  existingAttemptId,
  optionId,
  pathSlug,
  stepTitle,
}: {
  existingAttemptId: string | null;
  optionId: string;
  pathSlug: string;
  stepTitle: string;
}) {
  const router = useRouter();
  const [requestIdentity] = useState(() => ({
    clientAttemptId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
  }));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function start() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/guided-learning/attempts", {
        body: JSON.stringify({ clientAttemptId: requestIdentity.clientAttemptId, stepOptionId: optionId }),
        headers: { "Content-Type": "application/json", "Idempotency-Key": requestIdentity.idempotencyKey },
        method: "POST",
      });
      const body: unknown = await response.json();
      const parsed = LearningAttemptMutationResponseSchema.safeParse(body);
      if (!response.ok || !parsed.success) {
        setMessage(response.status === 409
          ? "La actividad cambió o ya no está disponible. Vuelve a la ruta para elegir otra opción."
          : "Necesitas conexión para iniciar una actividad nueva. Tu progreso anterior no cambió.");
        return;
      }
      router.push(`/aprendizaje/sesiones/${parsed.data.attempt.id}`);
    } catch {
      setMessage("Necesitas conexión para iniciar una actividad nueva. Tu progreso anterior no cambió.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="learning-main learning-activity-launcher">
      <Link className="learning-back-link" href={`/aprendizaje/rutas/${pathSlug}`}>
        <ArrowLeft aria-hidden="true" size={18} />Volver a la ruta
      </Link>
      <section>
        <span>Actividad elegida</span>
        <h1>{stepTitle}</h1>
        <p>Tu elección es libre: esta actividad no bloqueará las demás. El avance se confirmará desde el servidor.</p>
        {existingAttemptId ? (
          <Link className="learning-primary-button" href={`/aprendizaje/sesiones/${existingAttemptId}`}>
            <Play aria-hidden="true" size={19} />Continuar donde quedaste
          </Link>
        ) : (
          <button className="learning-primary-button" disabled={busy} onClick={() => void start()} type="button">
            <Play aria-hidden="true" size={19} />{busy ? "Iniciando…" : "Comenzar actividad"}
          </button>
        )}
        <p aria-live="polite" className="learning-activity-message">{message}</p>
      </section>
    </main>
  );
}
