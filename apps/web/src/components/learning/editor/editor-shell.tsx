"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertDialog, Tabs } from "radix-ui";
import type { LearningEditorResource } from "@cediah/contracts";
import { activityLabelByProjection, createActivityFromMaterial, createUnit, makeSlug, type EditorDraft, type EditorSection, type RouteEditorState } from "./editor-model";
import { routeEditorReducer, type RouteEditorAction } from "./editor-reducer";
import { RouteBasics } from "./route-basics";
import { UnitCards } from "./unit-card";
import type { FieldHelpFamily } from "./field-help";
import { MaterialPicker, type MaterialPickerMode, type MaterialPickerSelection } from "./material-picker";
import { editorQueryKeys } from "./editor-query-keys";
import { ReviewPanel } from "./review-panel";
import type { PresentedIssue } from "./editor-issues";
import { issueFocusKeys } from "./editor-issues";
import { useEditorFocusRegistry } from "./editor-focus";
import type { RouteEditorController } from "./use-route-editor";
import type { EditorSerializationError } from "./editor-serialization";
import { RoutePreview } from "./route-preview";
import { editorStatusLabels, type EditorWorkflowAction } from "./editor-workflow";
import styles from "./route-editor.module.css";

const sectionLabels: Array<{ label: string; value: EditorSection }> = [
  { label: "Datos", value: "basics" },
  { label: "Actividades", value: "activities" },
  { label: "Revisión", value: "review" },
];

function updateDraftState(state: RouteEditorState, draft: EditorDraft): RouteEditorState {
  if (draft === state.draft || state.operation !== "idle") return state;
  return {
    ...state,
    dirty: true,
    draft,
    localRevision: state.localRevision + 1,
    validation: null,
  };
}

export function EditorShell({
  actorUserId,
  canPublish,
  canReview,
  editor,
  initialResources,
  resourceNextCursor,
  resourceTopics,
  routeTopics,
}: {
  actorUserId: string;
  canPublish: boolean;
  canReview: boolean;
  editor: RouteEditorController;
  initialResources: LearningEditorResource[];
  resourceNextCursor: string | null;
  resourceTopics: string[];
  routeTopics: Array<{ id: string; title: string }>;
}) {
  const { setState, state } = editor;
  const [openHelp, setOpenHelp] = useState<FieldHelpFamily | null>(null);
  const [pickerMode, setPickerMode] = useState<MaterialPickerMode | null>(null);
  const pickerReturnFocusRef = useRef<HTMLElement | null>(null);
  const [openMoreActivityId, setOpenMoreActivityId] = useState<string | null>(null);
  const focusRegistry = useEditorFocusRegistry();
  const editable = !state.savedPath || (!state.savedPath.archivedAt && ["draft", "changes_requested"].includes(state.savedPath.version.status));
  const busy = state.operation !== "idle";
  const allActivities = state.draft.definition.units.flatMap((unit) => unit.steps);
  const optionRevisionById = new Map(state.savedPath?.version.units.flatMap((unit) => unit.steps)
    .flatMap((activity) => activity.options)
    .map((option) => [option.id, option.resourceRevisionId] as const) ?? []);
  const queryScope = editorQueryKeys.scope(actorUserId, state.savedPath?.id ?? `new:${state.creationId}`);

  function changeDraft(updater: (draft: EditorDraft) => EditorDraft) {
    setState((current) => updateDraftState(current, updater(current.draft)));
  }

  function changeTitle(title: string) {
    changeDraft((draft) => ({
      ...draft,
      slug: state.frozenSlug ?? makeSlug(title, state.creationId),
      title,
    }));
  }

  function dispatch(action: RouteEditorAction) {
    setState((current) => routeEditorReducer(current, action));
  }

  function openPicker(mode: MaterialPickerMode) {
    pickerReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setPickerMode(mode);
  }

  function resolveIssue(issue: PresentedIssue) {
    const target = issue.target;
    if (target.kind === "retry") {
      void editor.saveThenValidate();
      return;
    }
    if (target.kind === "external") {
      window.open(target.href, "_blank", "noopener,noreferrer");
      return;
    }
    if (target.kind === "add-unit") {
      const unit = createUnit();
      setState((current) => ({ ...routeEditorReducer(current, { type: "add-unit", unit }), expandedUnitId: unit.id, section: "activities" }));
      focusRegistry.requestFocus(issueFocusKeys.objective(unit.id));
      return;
    }
    if (target.kind === "add-activity") {
      setState((current) => ({ ...current, expandedUnitId: target.unitId, section: "activities" }));
      openPicker({ kind: "new-activity", unitId: target.unitId });
      return;
    }
    if (target.kind === "alternative") {
      setState((current) => ({ ...current, expandedActivityId: target.activityId, expandedUnitId: target.unitId, section: "activities" }));
      openPicker({ activityId: target.activityId, kind: "alternative", unitId: target.unitId });
      return;
    }
    if (target.kind === "replace") {
      setState((current) => ({ ...current, expandedActivityId: target.activityId, expandedUnitId: target.unitId, section: "activities" }));
      openPicker({ activityId: target.activityId, kind: "replace", optionId: target.optionId, unitId: target.unitId });
      return;
    }
    setState((current) => ({
      ...current,
      expandedActivityId: target.activityId ?? current.expandedActivityId,
      expandedUnitId: target.unitId ?? current.expandedUnitId,
      section: target.section,
    }));
    if (target.openMore && target.activityId) setOpenMoreActivityId(target.activityId);
    focusRegistry.requestFocus(target.focusKey);
  }

  function revealSerializationError(error: EditorSerializationError) {
    const target = error.target;
    if (target.entity === "route") {
      setState((current) => ({ ...current, section: "basics" }));
      const field = target.field === "slug" ? "title" : target.field;
      focusRegistry.requestFocus(field === "topicContentId" ? issueFocusKeys.topic : issueFocusKeys.routeField(field));
      return;
    }
    if (target.entity === "review") {
      setState((current) => ({ ...current, section: "review" }));
      focusRegistry.requestFocus(issueFocusKeys.review);
      return;
    }
    setState((current) => ({
      ...current,
      expandedActivityId: "activityId" in target ? target.activityId : current.expandedActivityId,
      expandedUnitId: target.unitId,
      section: "activities",
    }));
    if (target.entity === "unit") focusRegistry.requestFocus(issueFocusKeys.unitTitle(target.unitId));
    else if (target.entity === "objective") focusRegistry.requestFocus(issueFocusKeys.objective(target.unitId, target.objectiveId));
    else if (target.entity === "activity") focusRegistry.requestFocus(issueFocusKeys.activityTitle(target.activityId));
    else focusRegistry.requestFocus(issueFocusKeys.option(target.optionId));
  }

  async function saveDraft() {
    const result = await editor.saveDraft();
    if (!result.ok && result.errors?.[0]) revealSerializationError(result.errors[0]);
    return result;
  }

  async function saveThenValidate() {
    const result = await editor.saveThenValidate();
    if (!result.ok && result.errors?.[0]) revealSerializationError(result.errors[0]);
    return result;
  }

  async function runWorkflowAction(action: EditorWorkflowAction) {
    if (action === "send-review") return editor.transition("in_review");
    if (action === "changes-requested") return editor.transition("changes_requested");
    if (action === "approve") return editor.transition("approved");
    return editor.transition("published");
  }

  function confirmMaterial(selection: MaterialPickerSelection) {
    const mode = selection.mode;
    const unit = state.draft.definition.units.find((entry) => entry.id === mode.unitId);
    if (!unit || selection.objectiveIds.length === 0) return false;
    if (selection.objectiveIds.some((id) => !unit.objectives.some((objective) => objective.id === id))) return false;
    if (mode.kind === "new-activity") {
      const activity = createActivityFromMaterial({ detail: selection.detail, objectiveIds: selection.objectiveIds });
      setState((current) => ({
        ...routeEditorReducer(current, { activity, type: "add-activity", unitId: unit.id }),
        expandedActivityId: activity.id,
        expandedUnitId: unit.id,
      }));
      return true;
    }
    const activity = unit.steps.find((entry) => entry.id === mode.activityId);
    if (!activity) return false;
    const materialActivity = createActivityFromMaterial({ detail: selection.detail, objectiveIds: activity.objectiveIds });
    const nextOption = materialActivity.options[0]!;
    if (mode.kind === "alternative") {
      dispatch({
        activityId: activity.id,
        option: {
          ...nextOption,
          isDefault: activity.options.length === 0,
          rewardIdentity: activity.options[0]?.rewardIdentity ?? nextOption.rewardIdentity,
        },
        type: "add-option",
        unitId: unit.id,
      });
      return true;
    }
    dispatch({
      activityId: activity.id,
      optionId: mode.optionId,
      replacement: {
        config: nextOption.config,
        estimatedMinutes: nextOption.estimatedMinutes,
        expectedSourceVersion: selection.detail.sourceVersion,
        label: activityLabelByProjection[selection.detail.projection],
        projection: selection.detail.projection,
        sourceContentId: selection.detail.sourceContentId,
      },
      type: "replace-option-material",
      unitId: unit.id,
    });
    if (selection.useNewTitle) {
      dispatch({ activityId: activity.id, patch: { title: selection.detail.title }, type: "update-activity", unitId: unit.id });
    }
    return true;
  }

  return (
    <main className={styles.editor} data-editor-surface>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/panel/rutas">Volver a rutas</Link>
          <h1>{state.savedPath ? state.draft.title : "Nueva ruta"}</h1>
          <p>Organiza qué aprender, elige materiales publicados y comprueba la ruta antes de enviarla.</p>
        </div>
        <div className={styles.headerActions}>
          <RoutePreview draft={state.draft} />
          <div className={styles.status}>
            <strong>{state.savedPath ? state.savedPath.archivedAt ? "Archivada" : editorStatusLabels[state.savedPath.version.status] : "Nueva ruta"}</strong>
            <span>{state.savedPath ? `Versión ${state.savedPath.version.number}` : "Sin guardar"} · {state.dirty ? "Cambios sin guardar" : "Sin cambios pendientes"}</span>
          </div>
        </div>
      </header>

      <Tabs.Root
        activationMode="manual"
        className={styles.tabs}
        onValueChange={(section) => setState((current) => ({
          ...current,
          section: section as EditorSection,
        }))}
        value={state.section}
      >
        <Tabs.List aria-label="Secciones del editor de rutas" className={styles.tabList}>
          {sectionLabels.map((section) => (
            <Tabs.Trigger className={styles.tab} key={section.value} value={section.value}>
              {section.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content className={styles.panel} value="basics">
          <RouteBasics
            disabled={!editable || busy}
            draft={state.draft}
            errors={editor.basicsErrors}
            onChange={(draft) => {
              if (draft.title !== state.draft.title) changeTitle(draft.title);
              else changeDraft(() => draft);
            }}
            topics={routeTopics}
          />
          {state.savedPath ? <p className={styles.metadataNote}>{state.savedPath.version.number > 1 && editable ? "Esta ruta tiene una versión publicada. Los cambios de título, descripción, tema y portada se aplican a la ficha compartida al guardar; las unidades y materiales de este borrador permanecen separados." : "Los cambios de título, descripción, tema y portada se aplican a la ficha de la ruta al guardar."}</p> : null}
        </Tabs.Content>

        <Tabs.Content className={styles.panel} value="activities">
          <section aria-labelledby="route-activities-title" className={styles.card}>
            <div className={styles.sectionHeading}><div><span>Paso 2 de 3</span><h2 className={styles.focusTarget} id="route-activities-title" ref={(node) => focusRegistry.register(issueFocusKeys.activities, node)} tabIndex={-1}>Unidades y actividades</h2><p>Divide la ruta en unidades y añade los materiales en el orden de estudio.</p></div></div>
            {state.draft.definition.units.length === 0 ? <div className={styles.emptyState}><strong>Empieza por una unidad</strong><p>Después podrás indicar objetivos y añadir cada material como una actividad.</p></div> : null}
            <UnitCards
              allActivities={allActivities}
              disabled={!editable || busy}
              expandedActivityId={state.expandedActivityId}
              expandedUnitId={state.expandedUnitId}
              onAddActivity={(unitId) => openPicker({ kind: "new-activity", unitId })}
              onDispatch={dispatch}
              onExpandedUnitChange={(unitId) => setState((current) => ({ ...current, expandedActivityId: unitId ? current.expandedActivityId : null, expandedUnitId: unitId }))}
              onExpandedActivityChange={(activityId) => setState((current) => ({ ...current, expandedActivityId: activityId }))}
              onHelpChange={setOpenHelp}
              onOpenPicker={openPicker}
              onMoreOptionsOpenChange={setOpenMoreActivityId}
              onRequestAddUnit={() => {
                const unit = createUnit();
                setState((current) => ({ ...routeEditorReducer(current, { type: "add-unit", unit }), expandedUnitId: unit.id }));
              }}
              openHelp={openHelp}
              openMoreActivityId={openMoreActivityId}
              optionRevisionById={optionRevisionById}
              pathId={state.savedPath?.id}
              scope={queryScope}
              units={state.draft.definition.units}
            />
          </section>
        </Tabs.Content>

        <Tabs.Content className={styles.panel} value="review">
          <ReviewPanel
            busy={busy}
            canPublish={canPublish}
            canReview={canReview}
            detail={state.savedPath}
            draft={state.draft}
            editable={editable}
            message={editor.notice}
            onCheck={() => void saveThenValidate()}
            onCreateVersion={editor.createVersion}
            onDraftChange={(draft) => changeDraft(() => draft)}
            onResolve={resolveIssue}
            onTransition={runWorkflowAction}
            validation={state.validation}
          />
        </Tabs.Content>
      </Tabs.Root>
      {pickerMode ? (() => {
        const unit = state.draft.definition.units.find((entry) => entry.id === pickerMode.unitId);
        const activity = pickerMode.kind === "new-activity"
          ? undefined
          : unit?.steps.find((entry) => entry.id === pickerMode.activityId);
        if (!unit) return null;
        return (
          <MaterialPicker
            activity={activity}
            initialCatalog={{
              items: initialResources,
              nextCursor: resourceNextCursor,
              resourceTopics,
              topics: routeTopics,
            }}
            key={`${pickerMode.kind}:${pickerMode.unitId}:${pickerMode.kind === "new-activity" ? "new" : pickerMode.activityId}`}
            mode={pickerMode}
            objectives={unit.objectives.filter((objective) => objective.title.trim())}
            onConfirm={confirmMaterial}
            onOpenChange={(open) => { if (!open) setPickerMode(null); }}
            open
            resourceTopics={resourceTopics}
            returnFocusRef={pickerReturnFocusRef}
            scope={queryScope}
            unitTitle={unit.title}
          />
        );
      })() : null}

      {editor.recoveryCandidate ? (
        <section aria-live="polite" className={styles.recoveryBanner}>
          <div>
            <strong>{editor.recoveryCandidate.conflict ? "Hay cambios locales de una versión anterior" : "Hay cambios de esta pestaña sin guardar"}</strong>
            <p>{editor.recoveryCandidate.conflict
              ? "La versión guardada cambió. Descarga este borrador para conservarlo; no se aplicará sobre la versión nueva."
              : "Puedes recuperarlos para seguir editando o descartarlos."}</p>
          </div>
          <div className={styles.inlineActions}>
            {editor.recoveryCandidate.conflict
              ? <button className={styles.secondaryButton} onClick={() => editor.downloadDraft(editor.recoveryCandidate?.recovery)} type="button">Descargar mis cambios</button>
              : <button className={styles.primaryAction} disabled={busy} onClick={editor.recover} type="button">Recuperar</button>}
            <button className={styles.textButton} onClick={editor.discardRecovery} type="button">Descartar</button>
          </div>
        </section>
      ) : null}

      {editor.conflict ? (
        <section aria-live="polite" className={styles.conflictBanner}>
          <div><strong>La ruta cambió en otra sesión</strong><p>Conserva tus cambios antes de abrir la versión guardada. No sobrescribiremos la otra edición.</p></div>
          <div className={styles.inlineActions}>
            <button className={styles.secondaryButton} onClick={() => editor.downloadDraft()} type="button">Descargar mis cambios</button>
            <button className={styles.textButton} onClick={editor.openSavedVersion} type="button">Abrir versión guardada</button>
          </div>
        </section>
      ) : null}

      {!editor.recoveryAvailable ? <p className={styles.recoveryWarning}>La recuperación local no está disponible; guarda antes de salir.</p> : null}

      <div className={styles.saveBar}>
        <div aria-live="polite">
          <strong>{busy ? operationLabel(state.operation) : state.dirty ? "Cambios sin guardar" : "Borrador al día"}</strong>
          <span>{editor.notice || (state.dirty ? "Tus cambios permanecen en este dispositivo hasta que guardes." : "La última respuesta del servidor está confirmada.")}</span>
          {editor.lastFailure?.status === 401 ? <a href="/login" rel="noreferrer" target="_blank">Iniciar sesión en otra pestaña</a> : null}
        </div>
        <button
          className={styles.primaryAction}
          disabled={!editable || busy || Boolean(state.savedPath && !state.dirty)}
          onClick={() => void saveDraft()}
          type="button"
        >{state.operation === "saving" ? "Guardando…" : "Guardar borrador"}</button>
      </div>

      <AlertDialog.Root onOpenChange={(open) => { if (!open) editor.setPendingNavigation(null); }} open={Boolean(editor.pendingNavigation)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className={styles.dialogOverlay} />
          <AlertDialog.Content className={styles.dialog} data-editor-surface>
            <AlertDialog.Title className={styles.dialogTitle}>¿Salir con cambios sin guardar?</AlertDialog.Title>
            <AlertDialog.Description className={styles.dialogDescription}>Puedes guardarlos antes de salir, conservarlos para recuperarlos después o seguir editando.</AlertDialog.Description>
            <div className={styles.dialogActions}>
              <AlertDialog.Cancel asChild><button className={styles.secondaryButton} type="button">Seguir editando</button></AlertDialog.Cancel>
              <button className={styles.textButton} disabled={busy} onClick={editor.leaveWithoutSaving} type="button">Salir sin guardar</button>
              <button className={styles.primaryAction} disabled={busy} onClick={() => void editor.saveAndLeave()} type="button">Guardar y salir</button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </main>
  );
}

function operationLabel(operation: RouteEditorState["operation"]) {
  if (operation === "saving") return "Guardando borrador…";
  if (operation === "validating") return "Comprobando ruta…";
  if (operation === "transitioning") return "Actualizando estado…";
  if (operation === "creating-version") return "Creando versión…";
  return "Procesando…";
}
