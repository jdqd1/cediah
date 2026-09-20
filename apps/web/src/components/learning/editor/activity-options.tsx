"use client";

import { Plus, Trash } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Collapsible } from "radix-ui";
import type { LearningEditorMaterialDetail, LearningObjective } from "@cediah/contracts";
import { unwrapEditorReadResult } from "./editor-api";
import { editorQueryKeys, type EditorQueryScope } from "./editor-query-keys";
import type { EditorActivity, EditorOption } from "./editor-model";
import type { RouteEditorAction } from "./editor-reducer";
import { FieldHelp, type FieldHelpFamily } from "./field-help";
import { formatLabels } from "./material-picker";
import { ObjectiveMappingEditor } from "./objective-mapping-editor";
import styles from "./route-editor.module.css";
import { issueFocusKeys } from "./editor-issues";
import { useEditorFocusRegistry } from "./editor-focus";
import { useEditorTransport } from "./editor-query-provider";

const purposeLabels = {
  check: "Comprobar",
  diagnostic: "Evaluación inicial",
  integrate: "Integrar conocimientos",
  recall: "Recordar",
  understand: "Comprender",
} as const;

export function useOptionMaterialDetail(input: {
  enabled: boolean;
  option: EditorOption;
  pathId?: string;
  resourceRevisionId?: string;
  scope: EditorQueryScope;
}) {
  const transport = useEditorTransport();
  const fixed = Boolean(input.pathId && input.resourceRevisionId);
  return useQuery({
    enabled: input.enabled,
    queryFn: async ({ signal }) => unwrapEditorReadResult(fixed
      ? await transport.fixedDetail(input.pathId!, input.option.id, signal)
      : await transport.currentDetail(
          input.option.sourceContentId,
          input.option.projection,
          signal,
        )),
    queryKey: fixed
      ? editorQueryKeys.fixedDetail(input.scope, input.option.id, input.resourceRevisionId!)
      : editorQueryKeys.currentDetail(
          input.scope,
          input.option.sourceContentId,
          input.option.projection,
          input.option.expectedSourceVersion,
        ),
  });
}

export function ActivityOptions({
  activity,
  allActivities,
  disabled,
  moreOptionsOpen,
  onAddAlternative,
  onDispatch,
  onHelpChange,
  onMoreOptionsOpenChange,
  onReplace,
  openHelp,
  optionRevisionById,
  objectives,
  pathId,
  scope,
  unitId,
}: {
  activity: EditorActivity;
  allActivities: EditorActivity[];
  disabled: boolean;
  moreOptionsOpen: boolean;
  onAddAlternative: () => void;
  onDispatch: (action: RouteEditorAction) => void;
  onHelpChange: (family: FieldHelpFamily | null) => void;
  onMoreOptionsOpenChange: (open: boolean) => void;
  onReplace: (optionId: string) => void;
  openHelp: FieldHelpFamily | null;
  optionRevisionById: ReadonlyMap<string, string>;
  objectives: LearningObjective[];
  pathId?: string;
  scope: EditorQueryScope;
  unitId: string;
}) {
  const focusRegistry = useEditorFocusRegistry();
  const availableDependencies = allActivities.filter((entry) => entry.id !== activity.id);
  const brokenDependencies = activity.recommendedAfter.filter((key) => !allActivities.some((entry) => entry.stableKey === key));

  return (
    <Collapsible.Root onOpenChange={onMoreOptionsOpenChange} open={moreOptionsOpen}>
      <Collapsible.Trigger asChild>
        <button className={styles.textButton} ref={(node) => focusRegistry.register(issueFocusKeys.activityMore(activity.id), node)} type="button">{moreOptionsOpen ? "Ocultar opciones" : "Más opciones"}</button>
      </Collapsible.Trigger>
      <Collapsible.Content className={styles.moreOptions}>
        <div className={styles.optionsHeading}>
          <div><h4>Opciones de la actividad</h4><p>Estos ajustes no cambian el material fijado salvo que elijas «Cambiar material».</p></div>
          <FieldHelp family="practice-mode" label="Uso de la actividad" onOpenFamilyChange={onHelpChange} openFamily={openHelp}>El uso explica el papel pedagógico de la actividad; no cambia automáticamente su formato ni sus preguntas.</FieldHelp>
        </div>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>Uso de esta actividad</span>
            <select disabled={disabled} onChange={(event) => onDispatch({ activityId: activity.id, patch: { purpose: event.target.value as EditorActivity["purpose"] }, type: "update-activity", unitId })} value={activity.purpose}>
              {Object.entries(purposeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={styles.checkboxRow}>
            <input checked={!activity.isEssential} disabled={disabled} onChange={(event) => onDispatch({ activityId: activity.id, patch: { isEssential: !event.target.checked }, type: "update-activity", unitId })} type="checkbox" />
            <span>Actividad opcional</span>
          </label>
        </div>

        <fieldset className={styles.dependencyChoices}>
          <legend>Orden recomendado</legend>
          {availableDependencies.length === 0 && brokenDependencies.length === 0 ? <p>No hay otras actividades para recomendar antes.</p> : null}
          {availableDependencies.map((candidate) => <label key={candidate.id}><input checked={activity.recommendedAfter.includes(candidate.stableKey)} disabled={disabled} onChange={(event) => {
            const recommendedAfter = event.target.checked
              ? [...new Set([...activity.recommendedAfter, candidate.stableKey])]
              : activity.recommendedAfter.filter((key) => key !== candidate.stableKey);
            onDispatch({ activityId: activity.id, patch: { recommendedAfter }, type: "update-activity", unitId });
          }} type="checkbox" /><span>{candidate.title || "Actividad sin título"}</span></label>)}
          {brokenDependencies.map((key) => <div className={styles.brokenDependency} key={key}><span>Actividad eliminada</span><button className={styles.textButton} disabled={disabled} onClick={() => onDispatch({ activityId: activity.id, patch: { recommendedAfter: activity.recommendedAfter.filter((entry) => entry !== key) }, type: "update-activity", unitId })} type="button">Quitar</button></div>)}
        </fieldset>

        <div className={styles.optionsHeading}>
          <div><h4>Materiales y alternativas</h4><p>El estudiante elige una opción para completar esta misma actividad.</p></div>
          <FieldHelp family="alternatives" label="Alternativas equivalentes" onOpenFamilyChange={onHelpChange} openFamily={openHelp}>Combina video con guía, o cuestionario con tarjetas. Para cambiar entre explicación y práctica, crea otra actividad.</FieldHelp>
        </div>
        <div className={styles.optionCards}>
          {activity.options.map((option, optionIndex) => (
            <OptionEditor
              activity={activity}
              disabled={disabled}
              key={option.id}
              objectives={objectives}
              onDispatch={onDispatch}
              onReplace={() => onReplace(option.id)}
              option={option}
              optionIndex={optionIndex}
              pathId={pathId}
              resourceRevisionId={optionRevisionById.get(option.id)}
              scope={scope}
              unitId={unitId}
            />
          ))}
          {activity.options.length === 0 ? <p className={styles.inlineMessage}>Esta actividad no tiene material. Elige uno antes de comprobar la ruta.</p> : null}
        </div>
        <button className={styles.secondaryButton} disabled={disabled || activity.options.length >= 12} onClick={onAddAlternative} type="button"><Plus aria-hidden size={18} /> Añadir otra forma de completar esta actividad</button>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

function OptionEditor({
  activity,
  disabled,
  objectives,
  onDispatch,
  onReplace,
  option,
  optionIndex,
  pathId,
  resourceRevisionId,
  scope,
  unitId,
}: {
  activity: EditorActivity;
  disabled: boolean;
  objectives: LearningObjective[];
  onDispatch: (action: RouteEditorAction) => void;
  onReplace: () => void;
  option: EditorOption;
  optionIndex: number;
  pathId?: string;
  resourceRevisionId?: string;
  scope: EditorQueryScope;
  unitId: string;
}) {
  const focusRegistry = useEditorFocusRegistry();
  const detailQuery = useOptionMaterialDetail({ enabled: true, option, pathId, resourceRevisionId, scope });
  const detail: LearningEditorMaterialDetail | undefined = detailQuery.data;
  const hasCustomConfig = Boolean(option.completionRule || option.config.videoRange || option.config.guideSectionIndexes);
  const showMappings = detail?.status === "ready"
    && detail.items.length > 0
    && (objectives.length > 1 || option.config.selectedItemIds.length !== detail.items.length);
  return (
    <article className={`${styles.optionCard} ${styles.focusTarget}`} ref={(node) => focusRegistry.register(issueFocusKeys.option(option.id), node)} tabIndex={-1}>
      <header><div><small>Alternativa {optionIndex + 1}</small><strong>{detail?.status === "ready" ? detail.title : "Material vinculado"}</strong><span>{formatLabels[option.projection]}</span></div><button aria-label={`Quitar alternativa ${optionIndex + 1}`} className={styles.iconButton} disabled={disabled} onClick={() => onDispatch({ activityId: activity.id, optionId: option.id, type: "remove-option", unitId })} type="button"><Trash aria-hidden size={18} /></button></header>
      {detailQuery.isPending ? <p>Cargando material fijado…</p> : null}
      {detailQuery.isError || detail?.status === "unavailable" ? <p className={styles.inlineMessage}>Este material no está disponible. Puedes cambiarlo sin perder la actividad.</p> : null}
      <div className={styles.fieldGrid}>
        <label className={styles.field}><span>Texto del botón</span><input disabled={disabled} maxLength={120} onChange={(event) => onDispatch({ activityId: activity.id, optionId: option.id, patch: { label: event.target.value }, type: "update-option", unitId })} value={option.label} /></label>
        <label className={styles.field}><span>Duración aproximada (min)</span><input disabled={disabled} max={600} min={1} onChange={(event) => onDispatch({ activityId: activity.id, optionId: option.id, patch: { estimatedMinutes: event.target.value ? Number(event.target.value) : null }, type: "update-option", unitId })} type="number" value={option.estimatedMinutes ?? ""} /></label>
      </div>
      {activity.options.length > 1 ? <label className={styles.checkboxRow}><input checked={option.isDefault} disabled={disabled} name={`default-${activity.id}`} onChange={() => onDispatch({ activityId: activity.id, optionId: option.id, type: "set-default-option", unitId })} type="radio" /><span>Formato recomendado</span></label> : null}
      {hasCustomConfig ? <p className={styles.fieldHint}>Este material tiene una configuración personalizada que se conservará al editar estos campos.</p> : null}
      {showMappings ? <ObjectiveMappingEditor disabled={disabled} items={detail.items} objectives={objectives} onChange={(config) => onDispatch({ activityId: activity.id, ...config, optionId: option.id, type: "update-option-mappings", unitId })} option={option} /> : null}
      <button className={styles.textButton} disabled={disabled} onClick={onReplace} type="button">Cambiar material</button>
    </article>
  );
}
