"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "@phosphor-icons/react";
import { RichTextDocumentSchema, type LearningAttempt } from "@cediah/contracts";
import { RichTextRenderer } from "@/components/rich-text-renderer";
import type { ActivityMutation } from "./types";

export function GuideActivity({ attempt, mutate }: {
  attempt: LearningAttempt & { manifest: Extract<LearningAttempt["manifest"], { projection: "guide" }> };
  mutate: ActivityMutation;
}) {
  const initial = Math.min(attempt.resume.guidePosition?.sectionIndex ?? 0, Math.max(0, attempt.manifest.sections.length - 1));
  const [sectionIndex, setSectionIndex] = useState(initial);
  const [busy, setBusy] = useState(false);
  const section = attempt.manifest.sections[sectionIndex];
  const document = RichTextDocumentSchema.safeParse(attempt.manifest.document);
  const hasMaterial = Boolean(section) || document.success;

  async function savePosition(next: number) {
    setSectionIndex(next);
    setBusy(true);
    await mutate(`/api/guided-learning/attempts/${attempt.id}/resume`, "PATCH", {
      expectedVersion: attempt.rowVersion,
      kind: "guide",
      offsetPercent: 0,
      sectionIndex: next,
    });
    setBusy(false);
  }
  async function complete() {
    setBusy(true);
    await mutate(`/api/guided-learning/attempts/${attempt.id}/complete`, "POST", {
      confirmation: true,
      expectedVersion: attempt.rowVersion,
    });
    setBusy(false);
  }

  return (
    <section className="learning-guide-activity">
      <div className="learning-activity-counter">Lectura · posición guardada por sección</div>
      {section ? <article><span>Sección {sectionIndex + 1} de {attempt.manifest.sections.length}</span><h2>{section.heading}</h2><p>{section.body}</p></article>
        : document.success ? <article><RichTextRenderer document={document.data} /></article>
          : <article role="alert"><h2>Material no disponible</h2><p>Esta revisión no contiene una guía legible. No se registrará como completada; vuelve a la ruta y elige otra actividad.</p></article>}
      {attempt.manifest.sections.length > 1 ? <nav aria-label="Navegar secciones de la guía">
        <button disabled={busy || sectionIndex === 0} onClick={() => void savePosition(sectionIndex - 1)} type="button"><ArrowLeft size={18} />Anterior</button>
        <button disabled={busy || sectionIndex === attempt.manifest.sections.length - 1} onClick={() => void savePosition(sectionIndex + 1)} type="button">Siguiente<ArrowRight size={18} /></button>
      </nav> : null}
      <button className="learning-primary-button" disabled={busy || !hasMaterial} onClick={() => void complete()} type="button"><Check size={18} />{busy ? "Guardando…" : "Terminé esta lectura"}</button>
    </section>
  );
}
