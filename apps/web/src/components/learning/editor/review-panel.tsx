"use client";

import { useState } from "react";
import { Archive, CaretDown, CheckCircle } from "@phosphor-icons/react";
import { AlertDialog, Collapsible } from "radix-ui";
import type { LearningPathDetail } from "@cediah/contracts";
import type { EditorDraft, ValidationStamp } from "./editor-model";
import { presentIssues, type PresentedIssue } from "./editor-issues";
import { IssueCard } from "./issue-card";
import styles from "./route-editor.module.css";
import { issueFocusKeys } from "./editor-issues";
import { useEditorFocusRegistry } from "./editor-focus";
import { editorStatusLabels, editorWorkflowActions, type EditorWorkflowAction } from "./editor-workflow";

export function ReviewPanel({
  busy,
  canPublish,
  canReview,
  detail,
  draft,
  editable,
  hasUnsavedChanges,
  message,
  onCheck,
  onCreateVersion,
  onDraftChange,
  onResolve,
  onTransition,
  validation,
}: {
  busy: boolean;
  canPublish: boolean;
  canReview: boolean;
  detail: LearningPathDetail | null;
  draft: EditorDraft;
  editable: boolean;
  hasUnsavedChanges: boolean;
  message: string;
  onCheck: () => void;
  onCreateVersion: (releaseNotes: string) => Promise<{ ok: boolean }>;
  onDraftChange: (draft: EditorDraft) => void;
  onResolve: (issue: PresentedIssue) => void;
  onTransition: (action: EditorWorkflowAction) => Promise<{ ok: boolean }>;
  validation: ValidationStamp | null;
}) {
  const focusRegistry = useEditorFocusRegistry();
  const [evaluationOpen, setEvaluationOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const issues = detail && validation ? presentIssues(validation.issues, detail) : [];
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const actions = editorWorkflowActions(detail, { canPublish, canReview });
  const status = detail?.archivedAt ? "Archivada" : detail ? editorStatusLabels[detail.version.status] : "Nueva ruta";
  return (
    <section aria-labelledby="route-review-title" className={styles.card}>
      <div className={styles.sectionHeading}>
        <div><span>Paso 3 de 3</span><h2 className={styles.focusTarget} id="route-review-title" ref={(node) => focusRegistry.register(issueFocusKeys.review, node)} tabIndex={-1}>Comprueba que la ruta esté lista para revisión</h2></div>
      </div>
      <button className={styles.primaryAction} disabled={busy} onClick={onCheck} type="button"><CheckCircle aria-hidden size={19} /> {busy ? "Comprobando…" : "Comprobar ruta"}</button>
      <p aria-live="polite" className={styles.reviewMessage}>{message || (!detail ? "Guarda el borrador para poder comprobarlo." : "La comprobación no cambia ni publica la ruta.")}</p>
      {validation ? (
        <div className={styles.validationBanner} data-ready={errors.length === 0}>
          <strong>{errors.length > 0 ? `Hay ${errors.length} puntos por resolver antes de enviar a revisión` : `La ruta está lista para revisión. Hay ${warnings.length} sugerencias opcionales`}</strong>
        </div>
      ) : null}
      {errors.length > 0 ? <IssueGroup disabled={busy} issues={errors} label={`Por resolver (${errors.length})`} onResolve={onResolve} /> : null}
      {warnings.length > 0 ? <IssueGroup disabled={busy} issues={warnings} label={`Sugerencias (${warnings.length})`} onResolve={onResolve} /> : null}
      {validation && issues.length === 0 ? <div className={styles.readyState}><CheckCircle aria-hidden size={22} /><p>No encontramos puntos pendientes en esta versión guardada.</p></div> : null}

      <div className={styles.workflowPanel}>
        <div><span>Estado editorial</span><strong>{status}</strong><p>{workflowExplanation(detail, actions)}</p></div>
        <div className={styles.inlineActions}>
          {actions.includes("send-review") ? <button className={styles.primaryAction} disabled={busy} onClick={() => void onTransition("send-review")} type="button">Enviar a revisión</button> : null}
          {actions.includes("changes-requested") ? <button className={styles.secondaryButton} disabled={busy} onClick={() => void onTransition("changes-requested")} type="button">Solicitar cambios</button> : null}
          {actions.includes("approve") ? <button className={styles.primaryAction} disabled={busy} onClick={() => void onTransition("approve")} type="button">Aprobar</button> : null}
          {actions.includes("publish") ? <button className={styles.primaryAction} disabled={busy} onClick={() => setPublishOpen(true)} type="button">Publicar versión</button> : null}
          {actions.includes("create-version") ? <button className={styles.primaryAction} disabled={busy} onClick={() => void onCreateVersion(draft.definition.releaseNotes)} type="button">Crear nueva versión para editar</button> : null}
          {actions.includes("archive") ? <button className={styles.dangerButton} disabled={busy} onClick={() => setArchiveOpen(true)} type="button"><Archive aria-hidden size={18} /> Archivar ruta</button> : null}
        </div>
      </div>

      <div className={styles.reviewSettings}>
        <Collapsible.Root onOpenChange={setEvaluationOpen} open={evaluationOpen}>
          <Collapsible.Trigger className={styles.settingsTrigger}><span><strong>Ajustes de evaluación</strong><small>{draft.definition.evidenceLevel === "limited" ? "Práctica introductoria" : "Práctica completa"}</small></span><CaretDown aria-hidden size={19} /></Collapsible.Trigger>
          <Collapsible.Content className={styles.settingsContent}>
            <fieldset className={styles.evidenceChoices} disabled={!editable || busy}>
              <legend>¿Qué nivel de práctica tendrá esta ruta?</legend>
              <label><input checked={draft.definition.evidenceLevel === "standard"} name="route-evidence-level" onChange={() => onDraftChange({ ...draft, definition: { ...draft.definition, evidenceLevel: "standard" } })} type="radio" /><span><strong>Práctica completa</strong><small>Requiere al menos 5 preguntas o tarjetas distintas por objetivo.</small></span></label>
              <label><input checked={draft.definition.evidenceLevel === "limited"} name="route-evidence-level" onChange={() => onDraftChange({ ...draft, definition: { ...draft.definition, evidenceLevel: "limited" } })} type="radio" /><span><strong>Práctica introductoria</strong><small>Muestra una sugerencia si hay menos de 5; se selecciona solo de forma explícita.</small></span></label>
            </fieldset>
          </Collapsible.Content>
        </Collapsible.Root>
        <Collapsible.Root onOpenChange={setNotesOpen} open={notesOpen}>
          <Collapsible.Trigger className={styles.settingsTrigger}><span><strong>Notas de versión</strong><small>{draft.definition.releaseNotes.trim() ? "Con notas" : "Sin notas"}</small></span><CaretDown aria-hidden size={19} /></Collapsible.Trigger>
          <Collapsible.Content className={styles.settingsContent}>
            <label className={styles.field}><span>Notas para el equipo editorial</span><textarea disabled={!editable || busy} maxLength={4_000} onChange={(event) => onDraftChange({ ...draft, definition: { ...draft.definition, releaseNotes: event.target.value } })} rows={4} value={draft.definition.releaseNotes} /></label>
          </Collapsible.Content>
        </Collapsible.Root>
      </div>

      <AlertDialog.Root onOpenChange={setPublishOpen} open={publishOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className={styles.dialogOverlay} />
          <AlertDialog.Content className={styles.dialog} data-editor-surface>
            <AlertDialog.Title className={styles.dialogTitle}>¿Publicar esta versión?</AlertDialog.Title>
            <AlertDialog.Description className={styles.dialogDescription}>La ruta será visible para estudiantes. Después, cualquier cambio se hará en una nueva versión; quienes ya estudian continúan en su versión actual.</AlertDialog.Description>
            <div className={styles.dialogActions}>
              <AlertDialog.Cancel asChild><button className={styles.secondaryButton} type="button">Cancelar</button></AlertDialog.Cancel>
              <AlertDialog.Action asChild><button className={styles.primaryAction} disabled={busy} onClick={async (event) => { event.preventDefault(); const result = await onTransition("publish"); if (result.ok) setPublishOpen(false); }} type="button">Publicar versión</button></AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <AlertDialog.Root onOpenChange={setArchiveOpen} open={archiveOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className={styles.dialogOverlay} />
          <AlertDialog.Content className={styles.dialog} data-editor-surface>
            <AlertDialog.Title className={styles.dialogTitle}>¿Archivar esta ruta?</AlertDialog.Title>
            <AlertDialog.Description className={styles.dialogDescription}>Dejará de estar disponible para nuevos estudiantes. La versión publicada y el progreso existente se conservarán.{hasUnsavedChanges ? " Los cambios sin guardar se descartarán." : ""}</AlertDialog.Description>
            <div className={styles.dialogActions}>
              <AlertDialog.Cancel asChild><button className={styles.secondaryButton} type="button">Cancelar</button></AlertDialog.Cancel>
              <AlertDialog.Action asChild><button className={styles.dangerButton} disabled={busy} onClick={async (event) => { event.preventDefault(); const result = await onTransition("archive"); if (result.ok) setArchiveOpen(false); }} type="button">Archivar ruta</button></AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}

function workflowExplanation(detail: LearningPathDetail | null, actions: EditorWorkflowAction[]) {
  if (detail?.archivedAt || detail?.version.status === "archived") return "Esta ruta está archivada. No admite edición ni publicación.";
  if (!detail || detail.version.status === "draft" || detail.version.status === "changes_requested") return "Enviar guarda y comprueba la versión actual; solo continúa si no hay problemas bloqueantes.";
  if (detail.version.status === "in_review") return actions.length > 0 ? "Revisa los avisos antes de aprobar o solicita cambios al autor." : "Esta ruta está en revisión.";
  if (detail.version.status === "approved") return actions.length > 0 ? "La versión aprobada puede hacerse visible para estudiantes." : "Esta versión está aprobada y espera a una persona con permiso de publicación.";
  if (detail.version.status === "published") return "La versión publicada es inmutable. Los estudiantes continúan en su versión actual al crear otra.";
  return "Esta ruta no tiene acciones editoriales disponibles.";
}

function IssueGroup({ disabled, issues, label, onResolve }: { disabled: boolean; issues: PresentedIssue[]; label: string; onResolve: (issue: PresentedIssue) => void }) {
  return <section className={styles.issueGroup}><h3>{label}</h3><ul>{issues.map((issue, index) => <IssueCard disabled={disabled} issue={issue} key={`${issue.code}:${issue.location}:${index}`} onResolve={() => onResolve(issue)} />)}</ul></section>;
}
