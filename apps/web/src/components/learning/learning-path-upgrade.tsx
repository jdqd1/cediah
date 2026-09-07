"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ArrowRight, ArrowsClockwise, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import type { LearningEnrollmentUpgradePreview } from "@cediah/contracts";

export type LearningPathUpgradeNotice = {
  changes: LearningEnrollmentUpgradePreview["steps"];
  enrollmentId: string;
  expectedVersion: number;
  historyCount: number;
  preview: Omit<LearningEnrollmentUpgradePreview, "steps">;
};

const changeLabels = {
  added: "Nueva",
  changed: "Actualizada",
  equivalent: "Equivalente",
  removed: "Retirada",
} as const;

export function LearningPathUpgrade({ notice }: { notice: LearningPathUpgradeNotice }) {
  const router = useRouter();
  const idempotencyKey = useRef<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const { preview } = notice;

  if (dismissed) return null;

  function upgrade() {
    idempotencyKey.current ??= crypto.randomUUID();
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch(`/api/guided-learning/enrollments/${notice.enrollmentId}/upgrade`, {
          body: JSON.stringify({
            expectedVersion: notice.expectedVersion,
            targetPathVersionId: preview.targetVersion.id,
          }),
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey.current!,
          },
          method: "POST",
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) {
          setMessage(result.error === "active_attempt"
            ? "Termina la actividad abierta antes de actualizar la ruta."
            : result.error === "version_conflict"
              ? "La matrícula cambió. Recarga para revisar la vista previa actualizada."
              : "No pudimos actualizar la ruta; tu versión y progreso siguen intactos.");
          return;
        }
        router.refresh();
      } catch {
        setMessage("No hay conexión para confirmar la actualización; tu versión no cambió.");
      }
    });
  }

  if (preview.activeAttempt) {
    return <aside className="learning-upgrade-card is-blocked" aria-labelledby="learning-upgrade-title">
      <WarningCircle aria-hidden="true" size={24} />
      <div><span>Actualización disponible</span><h2 id="learning-upgrade-title">Conserva primero tu actividad abierta</h2><p>La versión {preview.targetVersion.number} está lista, pero no cambiaremos de versión mientras esta sesión siga en curso.</p><div className="learning-upgrade-actions"><Link className="learning-primary-button" href={preview.activeAttempt.href}>Retomar «{preview.activeAttempt.title}»</Link><button className="learning-secondary-button" onClick={() => setDismissed(true)} type="button">Guardar para después</button></div></div>
    </aside>;
  }

  return <aside className="learning-upgrade-card" aria-labelledby="learning-upgrade-title">
    <ArrowsClockwise aria-hidden="true" size={24} />
    <div>
      <span>Actualización disponible</span>
      <h2 id="learning-upgrade-title">Versión {preview.targetVersion.number} de esta ruta</h2>
      <p>Puedes revisarla y decidir. Tu historial permanece y solo se trasladan equivalencias pedagógicas válidas.</p>
      <details className="learning-upgrade-preview">
        <summary>Revisar cambios y progreso</summary>
        <div className="learning-upgrade-comparison">
          <div><small>Versión actual · v{preview.currentVersion.number}</small><strong>{preview.currentProgress.percentage}%</strong><span>{preview.currentProgress.completedEssentialSteps}/{preview.currentProgress.totalEssentialSteps} esenciales</span></div>
          <ArrowRight aria-hidden="true" size={22} />
          <div><small>Después de actualizar · v{preview.targetVersion.number}</small><strong>{preview.projectedProgress.percentage}%</strong><span>{preview.projectedProgress.completedEssentialSteps}/{preview.projectedProgress.totalEssentialSteps} esenciales</span></div>
        </div>
        {preview.targetVersion.releaseNotes ? <div className="learning-upgrade-notes"><strong>Notas de la versión</strong><p>{preview.targetVersion.releaseNotes}</p></div> : null}
        <ul className="learning-upgrade-summary" aria-label="Resumen de equivalencias"><li><CheckCircle aria-hidden="true" size={18} />{preview.summary.transferableCompleted} actividades completadas se conservan</li><li>{preview.summary.added} nuevas</li><li>{preview.summary.changed} actualizadas</li><li>{preview.summary.removed} retiradas</li></ul>
        {notice.changes.length > 0 ? <ul className="learning-upgrade-changes">{notice.changes.map((step) => <li data-kind={step.kind} key={`${step.kind}-${step.stableKey}`}><span>{changeLabels[step.kind]}</span><strong>{step.title}</strong>{step.completed && !step.transferable ? <small>Su evidencia anterior queda en el historial, pero no se transfiere.</small> : null}</li>)}</ul> : <p className="learning-upgrade-equivalent">Solo cambió la organización; todas las actividades conservan su equivalencia.</p>}
        <p className="learning-upgrade-history">Tu matrícula conserva {notice.historyCount} {notice.historyCount === 1 ? "versión registrada" : "versiones registradas"} en el historial.</p>
        <div className="learning-upgrade-actions"><button className="learning-primary-button" disabled={isPending} onClick={upgrade} type="button">{isPending ? "Actualizando…" : `Actualizar a la versión ${preview.targetVersion.number}`}</button><button className="learning-secondary-button" disabled={isPending} onClick={() => setDismissed(true)} type="button">Guardar para después</button></div>
        <p aria-live="polite" className="learning-upgrade-message">{message}</p>
      </details>
    </div>
  </aside>;
}
