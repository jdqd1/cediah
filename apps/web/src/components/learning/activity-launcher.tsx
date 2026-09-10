"use client";

import Link from "next/link";
import { ArrowLeft, Play } from "@phosphor-icons/react";
import { useLearningActivityLauncher } from "./use-learning-activity-launcher";

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
  const { busy, message, launch } = useLearningActivityLauncher();

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
          <button className="learning-primary-button" disabled={busy} onClick={() => void launch(optionId, null)} type="button">
            <Play aria-hidden="true" size={19} />{busy ? "Iniciando…" : "Comenzar actividad"}
          </button>
        )}
        <p aria-live="polite" className="learning-activity-message">{message}</p>
      </section>
    </main>
  );
}
