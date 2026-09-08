"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowSquareOut, Check, SkipForward } from "@phosphor-icons/react";
import {
  LEARNING_VIDEO_OBSERVED_XP,
  LEARNING_VIDEO_SKIPPED_XP,
  LearningAttemptMediaResponseSchema,
  type LearningAttempt,
} from "@cediah/contracts";
import type { ActivityMutation } from "./types";
import {
  compactVideoObservedRanges,
  normalizeVideoDurationSeconds,
  takeVideoObservedBatch,
  type VideoObservedRange,
} from "./video-observation";

export function VideoActivity({ attempt, mutate }: {
  attempt: LearningAttempt & { manifest: Extract<LearningAttempt["manifest"], { projection: "video" }> };
  mutate: ActivityMutation;
}) {
  const [busy, setBusy] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaError, setMediaError] = useState("");
  const attemptVersion = useRef(attempt.rowVersion);
  const lastTime = useRef<number | null>(null);
  const observed = useRef<VideoObservedRange[]>([]);
  const pendingSavePosition = useRef<number | null>(null);
  const saveBlocked = useRef(false);
  const saving = useRef(false);
  const videoDuration = useRef(attempt.resume.videoDurationSeconds ?? attempt.manifest.durationSeconds);
  const coveragePercent = attempt.manifest.completionRule.type === "video"
    ? attempt.manifest.completionRule.minimumCoveragePercent
    : 90;

  useEffect(() => {
    attemptVersion.current = attempt.rowVersion;
    saveBlocked.current = false;
    videoDuration.current = attempt.resume.videoDurationSeconds ?? attempt.manifest.durationSeconds ?? videoDuration.current;
  }, [attempt.manifest.durationSeconds, attempt.resume.videoDurationSeconds, attempt.rowVersion]);

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
    if (saveBlocked.current || videoDuration.current === null) return;
    pendingSavePosition.current = positionSeconds;
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      while (pendingSavePosition.current !== null) {
        const pendingPosition: number = pendingSavePosition.current;
        pendingSavePosition.current = null;
        const { batch, remaining } = takeVideoObservedBatch(observed.current);
        if (batch.length === 0) continue;
        const hasQueuedRemainder = remaining.length > 0;
        observed.current = remaining;
        const result = await mutate(`/api/guided-learning/attempts/${attempt.id}/resume`, "PATCH", {
          durationSeconds: videoDuration.current,
          expectedVersion: attemptVersion.current,
          kind: "video",
          observedRanges: batch,
          positionSeconds: pendingPosition,
        });
        if (!result) {
          observed.current = compactVideoObservedRanges([...batch, ...observed.current]);
          pendingSavePosition.current = null;
          saveBlocked.current = true;
          break;
        }
        attemptVersion.current = result.attempt.rowVersion;
        if (result.attempt.status === "completed") {
          observed.current = [];
          pendingSavePosition.current = null;
          break;
        }
        if (hasQueuedRemainder && pendingSavePosition.current === null) {
          pendingSavePosition.current = pendingPosition;
        }
      }
    } finally {
      setBusy(false);
      saving.current = false;
    }
  }
  async function completeWithoutWatching() {
    setBusy(true);
    try {
      await mutate(`/api/guided-learning/attempts/${attempt.id}/complete`, "POST", {
        confirmation: true,
        expectedVersion: attemptVersion.current,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="learning-video-activity">
      <div className="learning-activity-counter">Video · puedes verlo u omitirlo</div>
      {attempt.manifest.externalUrl ? (
        <div className="learning-external-video">
          <h2>Estudia el video en su fuente</h2>
          <p>Regresa después y confirma, o completa la actividad si ya conoces este contenido. Al no poder verificar la cobertura, recibirás {LEARNING_VIDEO_SKIPPED_XP} XP.</p>
          <a href={attempt.manifest.externalUrl} rel="noreferrer" target="_blank">Abrir video<ArrowSquareOut size={18} /></a>
          <button className="learning-primary-button" disabled={busy} onClick={() => void completeWithoutWatching()} type="button"><Check size={18} />{busy ? "Guardando…" : `Completar video (+${LEARNING_VIDEO_SKIPPED_XP} XP)`}</button>
        </div>
      ) : (
        <div className="learning-native-video">
          <video
            aria-label={`Reproducir ${attempt.manifest.title}`}
            controls
            onEnded={(event) => void saveVideo(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => {
              videoDuration.current = normalizeVideoDurationSeconds(event.currentTarget.duration)
                ?? attempt.resume.videoDurationSeconds
                ?? attempt.manifest.durationSeconds;
              if (attempt.resume.videoPositionSeconds !== null) {
                event.currentTarget.currentTime = Math.min(
                  attempt.resume.videoPositionSeconds,
                  event.currentTarget.duration,
                );
              }
            }}
            onPause={(event) => void saveVideo(event.currentTarget.currentTime)}
            onTimeUpdate={(event) => {
              const current = event.currentTarget.currentTime;
              if (!event.currentTarget.seeking && lastTime.current !== null && current > lastTime.current && current - lastTime.current <= 1.5) {
                observed.current.push({ startSeconds: lastTime.current, endSeconds: current });
              }
              lastTime.current = current;
              if (observed.current.length > 200) observed.current = compactVideoObservedRanges(observed.current);
              if (!saveBlocked.current && observed.current.reduce((sum, range) => sum + range.endSeconds - range.startSeconds, 0) >= 15) {
                void saveVideo(current);
              }
            }}
            playsInline
            preload="metadata"
            src={mediaUrl || undefined}
          />
          <p>{mediaError || (mediaUrl ? "La cobertura se guarda por segmentos reproducidos; saltar al final no completa la actividad." : "Solicitando reproducción segura…")}</p>
          <aside className="learning-video-skip">
            <div>
              <strong>¿Ya lo viste o no lo necesitas?</strong>
              <p>Puedes completar la lección sin reproducirlo. Recibirás {LEARNING_VIDEO_SKIPPED_XP} XP; al reproducir al menos {coveragePercent}% en este reproductor recibirás {LEARNING_VIDEO_OBSERVED_XP} XP.</p>
            </div>
            <button className="learning-secondary-button" disabled={busy} onClick={() => void completeWithoutWatching()} type="button">
              <SkipForward size={18} />{busy ? "Completando…" : "Omitir video y completar"}
            </button>
          </aside>
        </div>
      )}
    </section>
  );
}
