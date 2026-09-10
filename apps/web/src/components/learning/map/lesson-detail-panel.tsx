"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { X, ArrowRight } from "@phosphor-icons/react";
import {
  LearningEnrollmentResponseSchema,
  type MapLesson,
} from "@cediah/contracts";
import { useMapWorkspace } from "./map-provider";
import { buildMapHref } from "./map-route";
import { useLearningActivityLauncher } from "../use-learning-activity-launcher";
import { MedicalMapIcon } from "./medical-map-icon";
import styles from "./learning-map.module.css";
const formats = {
  video: "Video",
  guide: "Guía",
  quiz: "Cuestionario",
  flashcards: "Flashcards",
};
export function LessonDetailPanel({
  lesson,
  onClose,
}: {
  lesson: MapLesson;
  onClose: () => void;
}) {
  const { client, level } = useMapWorkspace();
  const [tab, setTab] = useState("activities"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const lock = useRef(false),
    enrollmentKey = useRef<string | null>(null),
    launcher = useLearningActivityLauncher();
  async function start(stepId: string, optionId: string) {
    if (lock.current || launcher.busy || !level) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const oldStep = lesson.activities.find((a) => a.id === stepId),
        oldOption = oldStep?.options.find((o) => o.id === optionId);
      if (!oldStep || !oldOption)
        throw new Error("Elige una actividad disponible.");
      let current = (await client.level(level.route)).selectedLesson;
      if (!current) throw new Error("La lección cambió o no está disponible.");
      if (current.enrollmentState !== "active") {
        enrollmentKey.current ??= crypto.randomUUID();
        const response = await fetch(
          current.enrollmentId
            ? `/api/guided-learning/enrollments/${current.enrollmentId}`
            : "/api/guided-learning/enrollments",
          {
            method: current.enrollmentId ? "PATCH" : "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": enrollmentKey.current,
            },
            body: JSON.stringify(
              current.enrollmentId
                ? {
                    expectedVersion: current.enrollmentVersion,
                    status: "active",
                  }
                : { pathId: current.pathId },
            ),
          },
        );
        const parsed = LearningEnrollmentResponseSchema.safeParse(
          await response.json(),
        );
        if (!response.ok || !parsed.success)
          throw new Error("No pudimos confirmar la inscripción. Reintenta.");
        current = (await client.level(level.route)).selectedLesson;
        if (
          !current ||
          current.pathVersionId !== parsed.data.enrollment.pathVersionId
        )
          throw new Error(
            "La versión cambió. Actualiza la lección antes de comenzar.",
          );
      }
      const step = current.activities.find(
        (a) => a.stableKey === oldStep.stableKey,
      );
      const option = step?.options.find((o) => o.id === oldOption.id);
      if (!option)
        throw new Error("Esta alternativa cambió de versión. Elige de nuevo.");
      await launcher.launch(
        option.id,
        option.existingAttemptId,
        buildMapHref(level.route),
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "No pudimos comenzar. Reintenta.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const recommended = lesson.activities.find(
    (a) => a.id === level?.nextActivity?.stepId,
  );
  const recommendedOption = recommended?.options.find(
    (o) => o.id === level?.nextActivity?.optionId,
  );
  return (
    <aside className={styles.panel} aria-label={`Lección ${lesson.title}`}>
      <header className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <span className={styles.iconWell}>
            <MedicalMapIcon iconKey="folder" />
          </span>
          <h2>{lesson.title}</h2>
          <span className={styles.percentage}>
            {lesson.progress.percentage ?? "—"} % ·{" "}
            {lesson.progress.completedEssentialSteps ?? "—"}/
            {lesson.progress.totalEssentialSteps ?? "—"} esenciales
          </span>
          <p>{lesson.description}</p>
        </div>
        <button
          className={styles.iconButton}
          aria-label="Cerrar lección"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <div
        className={styles.tabs}
        role="tablist"
        aria-label="Detalle de lección"
      >
        <button
          role="tab"
          aria-selected={tab === "activities"}
          onClick={() => setTab("activities")}
        >
          Actividades
        </button>
        <button
          role="tab"
          aria-selected={tab === "resources"}
          onClick={() => setTab("resources")}
        >
          Recursos
        </button>
      </div>
      <div className={styles.panelScroll} role="tabpanel">
        {tab === "activities" ? (
          <ol className={styles.roadmap}>
            {lesson.activities.map((a, i) => (
              <li key={a.id}>
                <span className={styles.stepNumber}>
                  {a.state === "completed" ? "✓" : i + 1}
                </span>
                <div className={styles.stepBody}>
                  <strong>{a.title}</strong>
                  <small>
                    {a.state === "completed"
                      ? "Completada"
                      : a.state === "skipped"
                        ? "Omitida; pendiente de completar"
                        : a.state === "in_progress"
                          ? "En progreso"
                          : a.isEssential
                            ? "Esencial"
                            : "Opcional"}
                  </small>
                  {a.options.map((o) => (
                    <button
                      key={o.id}
                      disabled={busy || launcher.busy}
                      className={styles.button}
                      onClick={() => void start(a.id, o.id)}
                    >
                      {o.label} · {formats[o.projection]}
                      {o.estimatedMinutes !== null
                        ? ` · ${o.estimatedMinutes} min`
                        : ""}
                    </button>
                  ))}
                  {!a.options.length ? (
                    <small>
                      Material no disponible. Actualiza para comprobar sus
                      alternativas.
                    </small>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <>
            <p>
              Formatos disponibles para esta lección. Cada alternativa conserva
              el mismo paso académico.
            </p>
            {lesson.activities.flatMap((a) =>
              a.options.map((o) => (
                <div className={styles.suggestion} key={o.id}>
                  <div>
                    <strong>{o.label}</strong>
                    <small>
                      {formats[o.projection]} · {a.title}
                    </small>
                  </div>
                  <button
                    className={styles.iconButton}
                    aria-label={`Abrir ${o.label}`}
                    disabled={busy || launcher.busy}
                    onClick={() => void start(a.id, o.id)}
                  >
                    <ArrowRight size={18} />
                  </button>
                </div>
              )),
            )}
            {!lesson.activities.some((a) => a.options.length) ? (
              <p>No hay recursos disponibles.</p>
            ) : null}
          </>
        )}
      </div>
      <footer className={styles.panelFooter}>
        {recommended && recommendedOption ? (
          <>
            <p>{level?.nextActivity?.reason}</p>
            <strong>{recommended.title}</strong>
            <button
              className={styles.primary}
              disabled={busy || launcher.busy}
              onClick={() => void start(recommended.id, recommendedOption.id)}
            >
              {busy || launcher.busy
                ? "Preparando…"
                : lesson.enrollmentState === "paused" ||
                    lesson.enrollmentState === "archived"
                  ? "Reanudar ruta y comenzar"
                  : lesson.enrollmentState === "none"
                    ? "Comenzar lección"
                    : recommendedOption.existingAttemptId
                      ? "Continuar actividad"
                      : "Comenzar actividad"}
              <ArrowRight size={18} />
            </button>
          </>
        ) : (
          <p>
            {lesson.progress.status === "completed"
              ? "Lección completada. Puedes volver al mapa o elegir otra actividad."
              : "No hay una actividad disponible para recomendar."}
          </p>
        )}
        <p role="status">{message || launcher.message}</p>
        <Link
          href={`/aprendizaje/rutas/${lesson.pathSlug}?${new URLSearchParams({ leccion: lesson.unitStableKey })}`}
        >
          Ver en la ruta
        </Link>
      </footer>
    </aside>
  );
}
