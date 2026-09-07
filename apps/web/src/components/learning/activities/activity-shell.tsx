"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CloudCheck, CloudSlash } from "@phosphor-icons/react";
import {
  LearningAttemptMutationResponseSchema,
  type LearningAttempt,
  type LearningAttemptResponseRecord,
  type LearningEnrollmentProgress,
  type LearningReward,
} from "@cediah/contracts";
import { flushQueuedLearningMutations, sendQueuedLearningMutation } from "@/lib/learning-mutation-queue";
import { FlashcardActivity } from "./flashcard-activity";
import { GuideActivity } from "./guide-activity";
import { LearningCompletionPanel } from "./learning-completion-panel";
import { QuizActivity } from "./quiz-activity";
import { ReviewActivity } from "./review-activity";
import type { ActivityMutation } from "./types";
import { VideoActivity } from "./video-activity";

export function ActivityShell({
  initialAttempt,
  initialProgress,
  userId,
}: {
  initialAttempt: LearningAttempt;
  initialProgress: LearningEnrollmentProgress | null;
  userId: string;
}) {
  const [attempt, setAttempt] = useState(initialAttempt);
  const [progress, setProgress] = useState(initialProgress);
  const [feedback, setFeedback] = useState<LearningAttemptResponseRecord | null>(null);
  const [awards, setAwards] = useState<LearningReward[]>([]);
  const [saveState, setSaveState] = useState<"confirmed" | "failed" | "pending" | "saving">("confirmed");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const flush = () => {
      void flushQueuedLearningMutations(userId).then((confirmed) => {
        if (confirmed > 0) window.location.reload();
      });
    };
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [userId]);

  const mutate = useCallback<ActivityMutation>(async (path, method, body) => {
    setSaveState("saving");
    setMessage("");
    const delivered = await sendQueuedLearningMutation({ body, method, url: path, userId });
    if (delivered.state === "pending") {
      setSaveState("pending");
      setMessage("Cambio pendiente de guardar. No avanzaremos hasta recibir confirmación del servidor.");
      return null;
    }
    if (delivered.state === "failed") {
      setSaveState("failed");
      setMessage("No pudimos enviar ni guardar este cambio en el dispositivo. Mantén esta pantalla abierta y vuelve a intentarlo con conexión.");
      return null;
    }
    const parsed = LearningAttemptMutationResponseSchema.safeParse(delivered.body);
    if (!delivered.response.ok || !parsed.success) {
      setSaveState("confirmed");
      const error = delivered.body && typeof delivered.body === "object" && "error" in delivered.body
        ? String(delivered.body.error) : "learning_unavailable";
      setMessage(error === "version_conflict"
        ? "La actividad cambió en otro dispositivo. Recarga para continuar desde el estado confirmado."
        : error === "resource_changed"
          ? "Este material fue retirado o actualizado. Tu historial se conserva; vuelve a la ruta para elegir una alternativa."
          : "No pudimos guardar este cambio. El avance visible no se modificó.");
      return null;
    }
    setAttempt(parsed.data.attempt);
    if (parsed.data.progress) setProgress(parsed.data.progress);
    if (parsed.data.awards.length > 0) {
      setAwards((current) => {
        const next = new Map(current.map((award) => [award.awardKey, award]));
        for (const award of parsed.data.awards) next.set(award.awardKey, award);
        return [...next.values()];
      });
    }
    setSaveState("confirmed");
    setMessage("Progreso guardado.");
    return parsed.data;
  }, [userId]);

  return (
    <main className="learning-activity-main">
      <header className="learning-activity-header">
        <Link href={attempt.pathSlug ? `/aprendizaje/rutas/${attempt.pathSlug}` : "/aprendizaje"}><ArrowLeft size={18} />{attempt.pathSlug ? "Mi ruta" : "Inicio"}</Link>
        <div>
          <span>{attempt.manifest.projection === "quiz" ? "Cuestionario" : attempt.manifest.projection === "flashcards" ? "Flashcards" : attempt.manifest.projection === "guide" ? "Guía" : attempt.manifest.projection === "review" ? "Repaso" : "Video"}</span>
          <h1>{attempt.manifest.title}</h1>
        </div>
        <div aria-live="polite" className={`learning-save-state is-${saveState}`}>
          {saveState === "pending" || saveState === "failed" ? <CloudSlash size={18} /> : <CloudCheck size={18} />}
          {saveState === "saving" ? "Guardando…" : saveState === "pending" ? "Pendiente" : saveState === "failed" ? "Sin guardar" : "Guardado"}
        </div>
      </header>
      <p aria-live="polite" className="learning-activity-message">{message}</p>
      {attempt.status === "completed" && !feedback ? <LearningCompletionPanel attempt={attempt} awards={awards} progress={progress} /> : null}
      {attempt.status !== "completed" || feedback ? (
        attempt.manifest.projection === "quiz" ? <QuizActivity attempt={attempt as LearningAttempt & { manifest: Extract<LearningAttempt["manifest"], { projection: "quiz" }> }} feedback={feedback} mutate={mutate} onFeedback={setFeedback} />
          : attempt.manifest.projection === "flashcards" ? <FlashcardActivity attempt={attempt as LearningAttempt & { manifest: Extract<LearningAttempt["manifest"], { projection: "flashcards" }> }} mutate={mutate} />
            : attempt.manifest.projection === "guide" ? <GuideActivity attempt={attempt as LearningAttempt & { manifest: Extract<LearningAttempt["manifest"], { projection: "guide" }> }} mutate={mutate} />
              : attempt.manifest.projection === "review" ? <ReviewActivity attempt={attempt as LearningAttempt & { manifest: Extract<LearningAttempt["manifest"], { projection: "review" }> }} feedback={feedback} mutate={mutate} onFeedback={setFeedback} />
                : <VideoActivity attempt={attempt as LearningAttempt & { manifest: Extract<LearningAttempt["manifest"], { projection: "video" }> }} mutate={mutate} />
      ) : null}
    </main>
  );
}
