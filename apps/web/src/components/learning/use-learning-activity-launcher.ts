"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LearningAttemptMutationResponseSchema } from "@cediah/contracts";
import { safeMapReturnHref } from "./map/map-route";
export function useLearningActivityLauncher() {
  const router = useRouter(),
    inFlight = useRef(false);
  const identity = useRef<{
    optionId: string;
    clientAttemptId: string;
    key: string;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function launch(
    optionId: string,
    existingAttemptId: string | null,
    returnHref?: string,
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      let attemptId = existingAttemptId;
      if (!attemptId) {
        if (identity.current?.optionId !== optionId)
          identity.current = {
            optionId,
            clientAttemptId: crypto.randomUUID(),
            key: crypto.randomUUID(),
          };
        const response = await fetch("/api/guided-learning/attempts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": identity.current.key,
          },
          body: JSON.stringify({
            clientAttemptId: identity.current.clientAttemptId,
            stepOptionId: optionId,
          }),
        });
        const parsed = LearningAttemptMutationResponseSchema.safeParse(
          await response.json(),
        );
        if (!response.ok || !parsed.success)
          throw new Error(
            response.status === 409
              ? "La actividad cambió. Actualiza el contenido antes de continuar."
              : "No pudimos iniciar la actividad. Reintenta con conexión.",
          );
        attemptId = parsed.data.attempt.id;
      }
      const origin = safeMapReturnHref(returnHref);
      router.push(
        `/aprendizaje/sesiones/${attemptId}${origin ? `?${new URLSearchParams({ returnTo: origin })}` : ""}`,
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "No pudimos iniciar la actividad.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return { launch, busy, message };
}
