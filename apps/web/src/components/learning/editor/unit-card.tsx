"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { CaretDown, DotsThreeVertical, Plus, Trash } from "@phosphor-icons/react";
import { Accordion, DropdownMenu } from "radix-ui";
import type { LearningObjective } from "@cediah/contracts";
import { createObjective, type EditorUnit } from "./editor-model";
import type { RouteEditorAction } from "./editor-reducer";
import { EditorAlertDialog } from "./editor-dialog";
import { FieldHelp, type FieldHelpFamily } from "./field-help";
import styles from "./route-editor.module.css";
import { ActivityCard } from "./activity-card";
import type { MaterialPickerMode } from "./material-picker";
import type { EditorQueryScope } from "./editor-query-keys";
import { issueFocusKeys } from "./editor-issues";
import { useEditorFocusRegistry } from "./editor-focus";

export function unitObjectiveIsReferenced(unit: EditorUnit, objectiveId: string) {
  return unit.steps.some((activity) => (
    activity.objectiveIds.includes(objectiveId)
    || activity.options.some((option) => option.config.objectiveMappings.some((mapping) => (
      mapping.objectiveIds.includes(objectiveId)
    )))
  ));
}

export function unitHasCompleteObjective(unit: EditorUnit) {
  return unit.objectives.some((objective) => objective.title.trim().length > 0);
}

export function UnitCards({
  allActivities,
  disabled,
  expandedActivityId,
  expandedUnitId,
  onAddActivity,
  onDispatch,
  onExpandedUnitChange,
  onHelpChange,
  onExpandedActivityChange,
  onOpenPicker,
  onMoreOptionsOpenChange,
  onRequestAddUnit,
  openHelp,
  openMoreActivityId,
  optionRevisionById,
  pathId,
  scope,
  units,
}: {
  allActivities: EditorUnit["steps"];
  disabled: boolean;
  expandedActivityId: string | null;
  expandedUnitId: string | null;
  onAddActivity: (unitId: string) => void;
  onDispatch: (action: RouteEditorAction) => void;
  onExpandedUnitChange: (unitId: string | null) => void;
  onHelpChange: (family: FieldHelpFamily | null) => void;
  onExpandedActivityChange: (activityId: string | null) => void;
  onOpenPicker: (mode: MaterialPickerMode) => void;
  onMoreOptionsOpenChange: (activityId: string | null) => void;
  onRequestAddUnit: () => void;
  openHelp: FieldHelpFamily | null;
  openMoreActivityId: string | null;
  optionRevisionById: ReadonlyMap<string, string>;
  pathId?: string;
  scope: EditorQueryScope;
  units: EditorUnit[];
}) {
  const focusRegistry = useEditorFocusRegistry();
  const [deleteTarget, setDeleteTarget] = useState<{ returnFocusRef: RefObject<HTMLElement | null>; unitId: string } | null>(null);
  const deletedUnitIdRef = useRef<string | null>(null);
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const addUnitRef = useRef<HTMLButtonElement>(null);
  const targetUnit = units.find((unit) => unit.id === deleteTarget?.unitId);

  useEffect(() => {
    const deletedUnitId = deletedUnitIdRef.current;
    if (!deletedUnitId || units.some((unit) => unit.id === deletedUnitId)) return;
    const next = units.find((unit) => triggerRefs.current.has(unit.id));
    (next ? triggerRefs.current.get(next.id) : addUnitRef.current)?.focus();
    deletedUnitIdRef.current = null;
  }, [units]);

  return (
    <>
      <Accordion.Root
        className={styles.unitList}
        collapsible
        onValueChange={(value) => onExpandedUnitChange(value || null)}
        type="single"
        value={expandedUnitId ?? ""}
      >
        {units.map((unit, index) => (
          <UnitCard
            allActivities={allActivities}
            disabled={disabled}
            expandedActivityId={expandedActivityId}
            index={index}
            key={unit.id}
            menuButtonRef={(node) => {
              if (node) triggerRefs.current.set(unit.id, node);
              else triggerRefs.current.delete(unit.id);
              focusRegistry.register(`unit:${unit.id}`, node);
            }}
            onAddActivity={() => onAddActivity(unit.id)}
            onDispatch={onDispatch}
            onHelpChange={onHelpChange}
            onExpandedActivityChange={onExpandedActivityChange}
            onOpenPicker={onOpenPicker}
            onMoreOptionsOpenChange={onMoreOptionsOpenChange}
            onRequestDelete={(returnFocusRef) => setDeleteTarget({ returnFocusRef, unitId: unit.id })}
            openHelp={openHelp}
            openMoreActivityId={openMoreActivityId}
            optionRevisionById={optionRevisionById}
            pathId={pathId}
            scope={scope}
            total={units.length}
            unit={unit}
          />
        ))}
      </Accordion.Root>
      <button className={styles.secondaryButton} disabled={disabled || units.length >= 30} onClick={onRequestAddUnit} ref={(node) => { addUnitRef.current = node; focusRegistry.register("activities:add-unit", node); }} type="button">
        <Plus aria-hidden size={18} /> Añadir unidad
      </button>
      <EditorAlertDialog
        confirmLabel="Eliminar unidad"
        description={targetUnit
          ? `Se quitará «${targetUnit.title || "Unidad sin título"}» y sus ${targetUnit.steps.length} actividades del borrador. Los materiales publicados no se eliminarán.`
          : "La unidad se quitará solamente de este borrador."}
        onConfirm={() => {
          if (!deleteTarget) return;
          deletedUnitIdRef.current = deleteTarget.unitId;
          onDispatch({ type: "remove-unit", unitId: deleteTarget.unitId });
          setDeleteTarget(null);
        }}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        open={Boolean(deleteTarget)}
        returnFocusRef={deleteTarget?.returnFocusRef}
        title="¿Eliminar esta unidad?"
      />
    </>
  );
}

function UnitCard({
  allActivities,
  disabled,
  expandedActivityId,
  index,
  menuButtonRef,
  onAddActivity,
  onDispatch,
  onHelpChange,
  onExpandedActivityChange,
  onOpenPicker,
  onMoreOptionsOpenChange,
  onRequestDelete,
  openHelp,
  openMoreActivityId,
  optionRevisionById,
  pathId,
  scope,
  total,
  unit,
}: {
  allActivities: EditorUnit["steps"];
  disabled: boolean;
  expandedActivityId: string | null;
  index: number;
  menuButtonRef: (node: HTMLButtonElement | null) => void;
  onAddActivity: () => void;
  onDispatch: (action: RouteEditorAction) => void;
  onHelpChange: (family: FieldHelpFamily | null) => void;
  onExpandedActivityChange: (activityId: string | null) => void;
  onOpenPicker: (mode: MaterialPickerMode) => void;
  onMoreOptionsOpenChange: (activityId: string | null) => void;
  onRequestDelete: (returnFocusRef: RefObject<HTMLElement | null>) => void;
  openHelp: FieldHelpFamily | null;
  openMoreActivityId: string | null;
  optionRevisionById: ReadonlyMap<string, string>;
  pathId?: string;
  scope: EditorQueryScope;
  total: number;
  unit: EditorUnit;
}) {
  const focusRegistry = useEditorFocusRegistry();
  const menuRef = useRef<HTMLButtonElement | null>(null);
  const objectiveRefs = useRef(new Map<string, HTMLInputElement>());
  const [menuOpen, setMenuOpen] = useState(false);
  const queuedDeleteRef = useRef(false);
  const [objectiveMessage, setObjectiveMessage] = useState("");
  const [objectiveDelete, setObjectiveDelete] = useState<{ objective: LearningObjective; replacementObjectiveId?: string } | null>(null);

  useEffect(() => {
    if (!queuedDeleteRef.current || menuOpen) return;
    queuedDeleteRef.current = false;
    onRequestDelete(menuRef);
  }, [menuOpen, onRequestDelete]);

  const deleteReferenced = objectiveDelete
    ? unitObjectiveIsReferenced(unit, objectiveDelete.objective.id)
    : false;
  const replacementCandidates = objectiveDelete
    ? unit.objectives.filter((objective) => objective.id !== objectiveDelete.objective.id)
    : [];

  function requestAddActivity() {
    const firstIncomplete = unit.objectives.find((objective) => !objective.title.trim());
    if (!unitHasCompleteObjective(unit)) {
      setObjectiveMessage("Escribe al menos un objetivo antes de añadir una actividad.");
      if (firstIncomplete) objectiveRefs.current.get(firstIncomplete.id)?.focus();
      return;
    }
    setObjectiveMessage("");
    onAddActivity();
  }

  return (
    <Accordion.Item className={styles.unitCard} value={unit.id}>
      <div className={styles.unitHeader}>
        <Accordion.Header className={styles.unitHeading}>
          <Accordion.Trigger className={styles.unitTrigger} ref={menuButtonRef}>
            <span><small>Unidad {index + 1}</small><strong>{unit.title || "Unidad sin título"}</strong><em>{unit.steps.length} actividades</em></span>
            <CaretDown aria-hidden className={styles.chevron} size={20} />
          </Accordion.Trigger>
        </Accordion.Header>
        <DropdownMenu.Root onOpenChange={setMenuOpen} open={menuOpen}>
          <DropdownMenu.Trigger asChild>
            <button aria-label={`Acciones de la unidad ${unit.title || index + 1}`} className={styles.iconButton} disabled={disabled} ref={menuRef} type="button"><DotsThreeVertical aria-hidden size={22} /></button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={styles.menuContent} data-editor-surface sideOffset={6}>
              <DropdownMenu.Item className={styles.menuItem} disabled={index === 0} onSelect={() => onDispatch({ direction: -1, type: "move-unit", unitId: unit.id })}>Subir unidad</DropdownMenu.Item>
              <DropdownMenu.Item className={styles.menuItem} disabled={index === total - 1} onSelect={() => onDispatch({ direction: 1, type: "move-unit", unitId: unit.id })}>Bajar unidad</DropdownMenu.Item>
              <DropdownMenu.Separator className={styles.menuSeparator} />
              <DropdownMenu.Item className={`${styles.menuItem} ${styles.dangerItem}`} onSelect={() => { queuedDeleteRef.current = true; setMenuOpen(false); }}><Trash aria-hidden size={18} /> Eliminar unidad</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <Accordion.Content className={styles.unitContent}>
        <label className={styles.field}>
          <span>Nombre de la unidad</span>
          <input disabled={disabled} maxLength={200} onChange={(event) => onDispatch({ title: event.target.value, type: "update-unit", unitId: unit.id })} placeholder="Ej. Pared torácica" ref={(node) => focusRegistry.register(issueFocusKeys.unitTitle(unit.id), node)} value={unit.title} />
        </label>
        <div className={styles.objectiveHeader}>
          <div><strong>¿Qué aprenderá el estudiante?</strong><p>Escribe resultados concretos y observables.</p></div>
          <FieldHelp family="objectives" label="Cómo redactar objetivos" onOpenFamilyChange={onHelpChange} openFamily={openHelp}>Describe una acción que el estudiante podrá realizar, como identificar, comparar o explicar.</FieldHelp>
        </div>
        <div className={styles.objectiveList}>
          {unit.objectives.map((objective, objectiveIndex) => (
            <div className={styles.objectiveRow} key={objective.id}>
              <label className={styles.field}>
                <span>Objetivo {objectiveIndex + 1}</span>
                <input
                  disabled={disabled}
                  maxLength={240}
                  onChange={(event) => onDispatch({ objectiveId: objective.id, title: event.target.value, type: "update-objective", unitId: unit.id })}
                  placeholder="Ej. Identificar las estructuras principales de la pared torácica"
                  ref={(node) => {
                    if (node) objectiveRefs.current.set(objective.id, node);
                    else objectiveRefs.current.delete(objective.id);
                    focusRegistry.register(issueFocusKeys.objective(unit.id, objective.id), node);
                    if (objectiveIndex === 0) focusRegistry.register(issueFocusKeys.objective(unit.id), node);
                  }}
                  value={objective.title}
                />
              </label>
              <button aria-label={`Eliminar objetivo ${objectiveIndex + 1} de ${unit.title || `Unidad ${index + 1}`}`} className={styles.iconButton} disabled={disabled} onClick={() => {
                const candidates = unit.objectives.filter((entry) => entry.id !== objective.id);
                if (unitObjectiveIsReferenced(unit, objective.id) && candidates.length === 0) {
                  setObjectiveMessage("Añade otro objetivo antes de eliminar este, porque ya está asociado a una actividad.");
                  return;
                }
                setObjectiveDelete({ objective, replacementObjectiveId: candidates[0]?.id });
              }} type="button"><Trash aria-hidden size={18} /></button>
            </div>
          ))}
        </div>
        <button className={styles.textButton} disabled={disabled || unit.objectives.length >= 30} onClick={() => onDispatch({ objective: createObjective(), type: "add-objective", unitId: unit.id })} type="button"><Plus aria-hidden size={18} /> Añadir otro objetivo</button>
        {objectiveMessage ? <p aria-live="polite" className={styles.inlineMessage}>{objectiveMessage}</p> : null}

        <div className={styles.activityPlaceholder}><div><strong>Actividades</strong><p>Los materiales aparecen en el orden de estudio.</p></div><button className={styles.secondaryButton} disabled={disabled || unit.steps.length >= 60} onClick={requestAddActivity} type="button"><Plus aria-hidden size={18} /> Añadir actividad</button></div>
        <Accordion.Root className={styles.activityList} collapsible onValueChange={(value) => onExpandedActivityChange(value || null)} type="single" value={expandedActivityId ?? ""}>
          {unit.steps.map((activity, activityIndex) => (
            <ActivityCard
              activity={activity}
              allActivities={allActivities}
              disabled={disabled}
              index={activityIndex}
              key={activity.id}
              moreOptionsOpen={openMoreActivityId === activity.id}
              objectives={unit.objectives}
              onDispatch={onDispatch}
              onHelpChange={onHelpChange}
              onMoreOptionsOpenChange={(open) => onMoreOptionsOpenChange(open ? activity.id : null)}
              onOpenPicker={onOpenPicker}
              openHelp={openHelp}
              optionRevisionById={optionRevisionById}
              pathId={pathId}
              scope={scope}
              unitId={unit.id}
            />
          ))}
        </Accordion.Root>
      </Accordion.Content>

      <EditorAlertDialog
        confirmLabel="Eliminar objetivo"
        description={deleteReferenced ? "Este objetivo ya está asociado a actividades. Elige a cuál objetivo se trasladarán esas asociaciones." : "Se quitará este objetivo de la unidad."}
        onConfirm={() => {
          if (!objectiveDelete) return;
          onDispatch({ objectiveId: objectiveDelete.objective.id, replacementObjectiveId: objectiveDelete.replacementObjectiveId, type: "remove-objective", unitId: unit.id });
          setObjectiveDelete(null);
        }}
        onOpenChange={(open) => { if (!open) setObjectiveDelete(null); }}
        open={Boolean(objectiveDelete)}
        title="¿Eliminar este objetivo?"
      >
        {deleteReferenced && objectiveDelete ? (
          <label className={styles.field}>
            <span>Reasignar a</span>
            <select onChange={(event) => setObjectiveDelete({ ...objectiveDelete, replacementObjectiveId: event.target.value })} value={objectiveDelete.replacementObjectiveId}>
              {replacementCandidates.map((objective) => <option key={objective.id} value={objective.id}>{objective.title || "Objetivo sin título"}</option>)}
            </select>
          </label>
        ) : null}
      </EditorAlertDialog>
    </Accordion.Item>
  );
}
