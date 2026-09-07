"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ClockCounterClockwise } from "@phosphor-icons/react";
import { LearningAttemptMutationResponseSchema } from "@cediah/contracts";

export function ReviewLauncher({ minutes }: { minutes: 5 | 10 | 20 }) {
  const router = useRouter();
  const [identity] = useState(() => ({
    clientAttemptId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
  }));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function start() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/guided-learning/review-sessions", {
        body: JSON.stringify({ clientAttemptId: identity.clientAttemptId, sessionMinutes: minutes }),
        headers: { "Content-Type": "application/json", "Idempotency-Key": identity.idempotencyKey },
        method: "POST",
      });
      const body: unknown = await response.json();
      const parsed = LearningAttemptMutationResponseSchema.safeParse(body);
      if (!response.ok || !parsed.success) {
        setMessage(response.status === 409
          ? "La cola cambió o ya no quedan ítems vencidos. Vuelve a Inicio para ver el estado actual."
          : "No pudimos preparar el repaso. No se modificó ninguna fecha.");
        return;
      }
      router.push(`/aprendizaje/sesiones/${parsed.data.attempt.id}`);
    } catch {
      setMessage("Necesitas conexión para congelar una sesión nueva. Ningún repaso se marcó como realizado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="learning-main learning-activity-launcher">
      <Link className="learning-back-link" href="/aprendizaje"><ArrowLeft aria-hidden="true" size={18} />Volver a Inicio</Link>
      <section>
        <span>Repaso recomendado</span>
        <ClockCounterClockwise aria-hidden="true" className="learning-launcher-icon" size={38} />
        <h1>Una sesión breve y acotada</h1>
        <p>Prepararemos hasta {minutes === 5 ? 5 : 10} ítems vencidos. La lista quedará congelada y podrás elegir otra actividad en cualquier momento.</p>
        <fieldset className="learning-session-length">
          <legend>Duración de esta sesión</legend>
          <div>
            {([5, 10, 20] as const).map((option) => (
              <Link
                aria-current={option === minutes ? "true" : undefined}
                href={`/aprendizaje/repaso?minutos=${option}`}
                key={option}
              >
                {option} min
              </Link>
            ))}
          </div>
        </fieldset>
        <button className="learning-primary-button" disabled={busy} onClick={() => void start()} type="button">
          {busy ? "Preparando…" : `Comenzar · ${minutes} min`}
        </button>
        <p aria-live="polite" className="learning-activity-message">{message}</p>
      </section>
    </main>
  );
}
