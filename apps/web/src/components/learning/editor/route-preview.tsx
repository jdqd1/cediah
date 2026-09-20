"use client";

import Image from "next/image";
import { Eye, X } from "@phosphor-icons/react";
import { Dialog } from "radix-ui";
import type { EditorDraft } from "./editor-model";
import { formatLabels } from "./material-picker";
import styles from "./route-editor.module.css";

const coverImages: Record<EditorDraft["coverKey"], string> = {
  "back-muscles": "/anatomy/back-muscles.png",
  heart: "/anatomy/heart.png",
  intestines: "/anatomy/intestines.png",
  lungs: "/anatomy/lungs.png",
  "neck-muscles": "/anatomy/neck-muscles.png",
  pelvis: "/anatomy/pelvis.png",
  skull: "/anatomy/skull.png",
  thigh: "/anatomy/thigh.png",
};

export function previewDuration(draft: EditorDraft) {
  const durations = draft.definition.units.flatMap((unit) => unit.steps.map((activity) => (
    (activity.options.find((option) => option.isDefault) ?? activity.options[0])?.estimatedMinutes ?? null
  )));
  if (durations.length === 0 || durations.some((duration) => duration === null)) return null;
  return durations.reduce<number>((total, duration) => total + (duration ?? 0), 0);
}

export function RoutePreview({ draft }: { draft: EditorDraft }) {
  const duration = previewDuration(draft);
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild><button className={styles.secondaryButton} type="button"><Eye aria-hidden size={19} /> Vista previa</button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.dialogOverlay} />
        <Dialog.Content className={`${styles.dialog} ${styles.previewDialog}`} data-editor-surface>
          <header className={styles.previewHeader}>
            <div><span>Vista previa local</span><Dialog.Title className={styles.dialogTitle}>{draft.title.trim() || "Ruta sin título"}</Dialog.Title><Dialog.Description className={styles.dialogDescription}>Vista previa de la estructura; no registra actividad de estudio.</Dialog.Description></div>
            <Dialog.Close asChild><button aria-label="Cerrar vista previa" className={styles.iconButton} type="button"><X aria-hidden size={20} /></button></Dialog.Close>
          </header>
          <div className={styles.previewBody}>
            <section className={styles.previewHero}>
              <div className={styles.previewCover}><Image alt="" fill sizes="180px" src={coverImages[draft.coverKey]} /></div>
              <div><p>{draft.summary.trim() || "Añade una descripción breve para el estudiante."}</p><strong>{duration === null ? "Duración por definir" : `${duration} min estimados`}</strong></div>
            </section>
            {draft.definition.units.length === 0 ? <div className={styles.emptyState}><strong>La ruta aún no tiene unidades</strong><p>Añádelas en Actividades para ver aquí la estructura de estudio.</p></div> : (
              <ol className={styles.previewUnits}>
                {draft.definition.units.map((unit, unitIndex) => (
                  <li key={unit.id}>
                    <article>
                      <header><small>Unidad {unitIndex + 1}</small><h3>{unit.title.trim() || "Unidad sin título"}</h3></header>
                      {unit.objectives.length > 0 ? <div><strong>Objetivos</strong><ul>{unit.objectives.filter((objective) => objective.title.trim()).map((objective) => <li key={objective.id}>{objective.title}</li>)}</ul></div> : null}
                      <ol className={styles.previewActivities}>
                        {unit.steps.map((activity, activityIndex) => (
                          <li key={activity.id}>
                            <div><small>Actividad {activityIndex + 1}{activity.isEssential ? "" : " · Opcional"}</small><strong>{activity.title.trim() || "Actividad sin título"}</strong></div>
                            {activity.options.length === 0 ? <span>Sin material</span> : <ul>{activity.options.map((option) => <li key={option.id}>{formatLabels[option.projection]}{option.isDefault ? " · Recomendada" : " · Alternativa"}{option.estimatedMinutes ? ` · ${option.estimatedMinutes} min` : ""}</li>)}</ul>}
                          </li>
                        ))}
                      </ol>
                    </article>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <footer className={styles.dialogActions}><Dialog.Close asChild><button className={styles.primaryAction} type="button">Volver al editor</button></Dialog.Close></footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
