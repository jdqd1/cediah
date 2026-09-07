"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowSquareOut, Check } from "@phosphor-icons/react";
import { LearningAttemptMediaResponseSchema, type LearningAttempt } from "@cediah/contracts";
import type { ActivityMutation } from "./types";

export function VideoActivity({ attempt, mutate }: {
  attempt: LearningAttempt & { manifest: Extract<LearningAttempt["manifest"], { projection: "video" }> };
  mutate: ActivityMutation;
}) {
  const [busy, setBusy] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaError, setMediaError] = useState("");
  const lastTime = useRef<number | null>(null);
  const observed = useRef<Array<{ endSeconds: number; startSeconds: number }>>([]);
  const saving = useRef(false);

  useEffect(() => {
    if (attempt.manifest.externalUrl) return;
    const controller = new AbortController();
    void fetch(`/api/guided-learning/attempts/${attempt.id}/media`, { signal: controller.signal })
      .then(async (response) => ({ body: await response.json(), ok: response.ok }))
      .then(({ body, ok }) => {
        const parsed = LearningAttemptMediaResponseSchema.safeParse(body);
        if (ok && parsed.success) setMediaUrl(parsed.data.downloadUrl);
        else setMediaError("No pudimos abrir el archivo de video. El intento sigue guardado y no se marcó como completo.");
      }).catch(() => {
        if (!controller.signal.aborted) setMediaError("No pudimos abrir el archivo de video. El intento sigue guardado y no se marcó como completo.");
      });
    return () => controller.abort();
  }, [attempt.id, attempt.manifest.externalUrl]);

  async function saveVideo(positionSeconds: number) {
    if (saving.current) return;
    const ranges = observed.current;
    if (ranges.length === 0) return;
    saving.current = true;
    observed.current = [];
    setBusy(true);
    try {
      await mutate(`/api/guided-learning/attempts/${attempt.id}/resume`, "PATCH", {
        expectedVersion: attempt.rowVersion,
        kind: "video",
        observedRanges: ranges,
        positionSeconds,
      });
    } finally {
      setBusy(false);
      saving.current = false;
    }
  }
  async function completeExternal() {
    setBusy(true);
    await mutate(`/api/guided-learning/attempts/${attempt.id}/complete`, "POST", {
      confirmation: true,
      expectedVersion: attempt.rowVersion,
    });
    setBusy(false);
  }

  return (
    <section className="learning-video-activity">
      <div className="learning-activity-counter">Video · abrir no equivale a completar</div>
      {attempt.manifest.externalUrl ? (
        <div className="learning-external-video">
          <h2>Estudia el video en su fuente</h2>
          <p>Regresa después y confirma de forma explícita. No usamos un temporizador para fingir avance.</p>
          <a href={attempt.manifest.externalUrl} rel="noreferrer" target="_blank">Abrir video<ArrowSquareOut size={18} /></a>
          <button className="learning-primary-button" disabled={busy} onClick={() => void completeExternal()} type="button"><Check size={18} />{busy ? "Guardando…" : "Ya lo estudié"}</button>
        </div>
      ) : (
        <div className="learning-native-video">
          <video
            aria-label={`Reproducir ${attempt.manifest.title}`}
            controls
            onPause={(event) => void saveVideo(event.currentTarget.currentTime)}
            onTimeUpdate={(event) => {
              const current = event.currentTarget.currentTime;
              if (!event.currentTarget.seeking && lastTime.current !== null && current > lastTime.current && current - lastTime.current <= 1.5) {
                observed.current.push({ startSeconds: lastTime.current, endSeconds: current });
              }
              lastTime.current = current;
              if (observed.current.reduce((sum, range) => sum + range.endSeconds - range.startSeconds, 0) >= 15) void saveVideo(current);
            }}
            playsInline
            preload="metadata"
            src={mediaUrl || undefined}
          />
          <p>{mediaError || (mediaUrl ? "La cobertura se guarda por segmentos reproducidos; saltar al final no completa la actividad." : "Solicitando reproducción segura…")}</p>
        </div>
      )}
    </section>
  );
}
