"use client";

import { useRef, useState } from "react";
import { BookOpen, Cards, CaretDown, Exam, Trash, VideoCamera } from "@phosphor-icons/react";
import { Accordion } from "radix-ui";
import type { LearningObjective } from "@cediah/contracts";
import { ActivityOptions, useOptionMaterialDetail } from "./activity-options";
import { EditorAlertDialog } from "./editor-dialog";
import type { EditorActivity } from "./editor-model";
import type { EditorQueryScope } from "./editor-query-keys";
import type { RouteEditorAction } from "./editor-reducer";
import type { FieldHelpFamily } from "./field-help";
import { formatLabels, type MaterialPickerMode } from "./material-picker";
import styles from "./route-editor.module.css";
import { issueFocusKeys } from "./editor-issues";
import { useEditorFocusRegistry } from "./editor-focus";

const formatIcons = {
  flashcards: Cards,
  guide: BookOpen,
  quiz: Exam,
  video: VideoCamera,
};

export function ActivityCard({
  activity,
  allActivities,
  disabled,
  index,
  moreOptionsOpen,
  onDispatch,
  onHelpChange,
  onMoreOptionsOpenChange,
  onOpenPicker,
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
  index: number;
  moreOptionsOpen: boolean;
  onDispatch: (action: RouteEditorAction) => void;
  onHelpChange: (family: FieldHelpFamily | null) => void;
  onMoreOptionsOpenChange: (open: boolean) => void;
  onOpenPicker: (mode: MaterialPickerMode) => void;
  openHelp: FieldHelpFamily | null;
  optionRevisionById: ReadonlyMap<string, string>;
  objectives: LearningObjective[];
  pathId?: string;
  scope: EditorQueryScope;
  unitId: string;
}) {
  const focusRegistry = useEditorFocusRegistry();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const removeButtonRef = useRef<HTMLButtonElement>(null);
  const recommended = activity.options.find((option) => option.isDefault && option.projection !== "video")
    ?? activity.options.find((option) => option.projection !== "video");
  const Icon = recommended ? formatIcons[recommended.projection] : BookOpen;

  return (
    <Accordion.Item className={styles.activityCard} value={activity.id}>
      <Accordion.Header className={styles.activityHeading}>
        <Accordion.Trigger className={`${styles.activityTrigger} ${styles.focusTarget}`} ref={(node) => focusRegistry.register(issueFocusKeys.activity(activity.id), node)}>
          <span className={styles.activityIcon}><Icon aria-hidden size={21} /></span>
          <span><small>Actividad {index + 1}</small><strong>{activity.title || "Actividad sin título"}</strong><em>{recommended ? `${formatLabels[recommended.projection]}${recommended.estimatedMinutes ? ` · ${recommended.estimatedMinutes} min` : ""}` : "Sin material"}{!activity.isEssential ? " · Opcional" : ""}</em></span>
          <CaretDown aria-hidden className={styles.chevron} size={20} />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className={styles.activityContent}>
        <label className={styles.field}><span>Nombre de la actividad</span><input disabled={disabled} maxLength={240} onChange={(event) => onDispatch({ activityId: activity.id, patch: { title: event.target.value }, type: "update-activity", unitId })} ref={(node) => focusRegistry.register(issueFocusKeys.activityTitle(activity.id), node)} value={activity.title} /></label>
        {recommended ? (
          <ActivityMaterialSummary
            disabled={disabled}
            onReplace={() => onOpenPicker({ activityId: activity.id, kind: "replace", optionId: recommended.id, unitId })}
            option={recommended}
            pathId={pathId}
            resourceRevisionId={optionRevisionById.get(recommended.id)}
            scope={scope}
          />
        ) : <div className={styles.materialSummary}><div><small>Material recomendado</small><strong>Sin material</strong><span>Elige un material para continuar</span></div></div>}
        <div className={styles.activityActions}>
          <button className={styles.textButton} disabled={disabled} onClick={() => setConfirmRemove(true)} ref={removeButtonRef} type="button"><Trash aria-hidden size={18} /> Quitar actividad</button>
        </div>
        <ActivityOptions
          activity={activity}
          allActivities={allActivities}
          disabled={disabled}
          moreOptionsOpen={moreOptionsOpen}
          objectives={objectives}
          onAddAlternative={() => onOpenPicker({ activityId: activity.id, kind: "alternative", unitId })}
          onDispatch={onDispatch}
          onHelpChange={onHelpChange}
          onMoreOptionsOpenChange={onMoreOptionsOpenChange}
          onReplace={(optionId) => onOpenPicker({ activityId: activity.id, kind: "replace", optionId, unitId })}
          openHelp={openHelp}
          optionRevisionById={optionRevisionById}
          pathId={pathId}
          scope={scope}
          unitId={unitId}
        />
      </Accordion.Content>
      <EditorAlertDialog
        confirmLabel="Quitar actividad"
        description={`Se quitará «${activity.title || "Actividad sin título"}» de este borrador y se limpiarán sus relaciones de orden. Los materiales seguirán en la biblioteca.`}
        onConfirm={() => {
          onDispatch({ activityId: activity.id, type: "remove-activity", unitId });
          setConfirmRemove(false);
        }}
        onOpenChange={setConfirmRemove}
        open={confirmRemove}
        returnFocusRef={removeButtonRef}
        title="¿Quitar esta actividad?"
      />
    </Accordion.Item>
  );
}

function ActivityMaterialSummary({
  disabled,
  onReplace,
  option,
  pathId,
  resourceRevisionId,
  scope,
}: {
  disabled: boolean;
  onReplace: () => void;
  option: EditorActivity["options"][number];
  pathId?: string;
  resourceRevisionId?: string;
  scope: EditorQueryScope;
}) {
  const detailQuery = useOptionMaterialDetail({ enabled: true, option, pathId, resourceRevisionId, scope });
  const materialTitle = detailQuery.data?.status === "ready" ? detailQuery.data.title : "Material vinculado";
  return (
    <div className={styles.materialSummary}>
      <div><small>Material recomendado</small><strong>{materialTitle}</strong><span>{formatLabels[option.projection]}</span></div>
      <button className={styles.secondaryButton} disabled={disabled} onClick={onReplace} type="button">Cambiar material</button>
    </div>
  );
}
