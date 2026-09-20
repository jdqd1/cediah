"use client";

import { useMemo, useState, type RefObject } from "react";
import Link from "next/link";
import { Check, MagnifyingGlass } from "@phosphor-icons/react";
import { Dialog } from "radix-ui";
import type {
  LearningEditorMaterialDetail,
  LearningEditorResourceCatalogResponse,
  LearningObjective,
} from "@cediah/contracts";
import type { EditorActivity } from "./editor-model";
import type { EditorQueryScope } from "./editor-query-keys";
import { useMaterialCatalog } from "./use-material-catalog";
import styles from "./route-editor.module.css";

export type MaterialPickerMode =
  | { kind: "new-activity"; unitId: string }
  | { activityId: string; kind: "replace"; optionId: string; unitId: string }
  | { activityId: string; kind: "alternative"; unitId: string };

export type MaterialPickerSelection = {
  detail: Extract<LearningEditorMaterialDetail, { status: "ready" }>;
  mode: MaterialPickerMode;
  objectiveIds: string[];
  useNewTitle: boolean;
};

export const formatLabels = {
  flashcards: "Tarjetas",
  guide: "Guía",
  quiz: "Cuestionario",
  video: "Video",
} as const;

function pickerText(mode: MaterialPickerMode, unitTitle: string, activityTitle?: string) {
  if (mode.kind === "new-activity") return {
    action: `Añadir a ${unitTitle || "esta unidad"}`,
    title: `Añadir actividad a ${unitTitle || "esta unidad"}`,
  };
  if (mode.kind === "replace") return {
    action: "Cambiar material",
    title: `Cambiar material de ${activityTitle || "esta actividad"}`,
  };
  return {
    action: "Añadir alternativa",
    title: `Añadir otra forma de completar ${activityTitle || "esta actividad"}`,
  };
}

function projectionFamily(projection: keyof typeof formatLabels) {
  return projection === "quiz" || projection === "flashcards" ? "practice" : "explanation";
}

export function MaterialPicker({
  activity,
  initialCatalog,
  mode,
  objectives,
  onConfirm,
  onOpenChange,
  open,
  resourceTopics,
  returnFocusRef,
  scope,
  unitTitle,
}: {
  activity?: EditorActivity;
  initialCatalog: LearningEditorResourceCatalogResponse;
  mode: MaterialPickerMode;
  objectives: LearningObjective[];
  onConfirm: (selection: MaterialPickerSelection) => boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  resourceTopics: string[];
  returnFocusRef?: RefObject<HTMLElement | null>;
  scope: EditorQueryScope;
  unitTitle: string;
}) {
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [selectedProjection, setSelectedProjection] = useState<"" | keyof typeof formatLabels>("");
  const [selectedObjectiveIds, setSelectedObjectiveIds] = useState<string[]>(() => (
    objectives.length === 1 ? [objectives[0]!.id] : []
  ));
  const [useNewTitle, setUseNewTitle] = useState(false);
  const catalog = useMaterialCatalog({
    initialCatalog,
    open,
    scope,
    selectedProjection,
    selectedResourceId,
  });
  const selectedResource = catalog.selectedResource;
  const text = pickerText(mode, unitTitle, activity?.title);
  const allowedFamily = activity?.options[0]
    ? projectionFamily(activity.options[0].projection)
    : null;
  const allowedProjections = useMemo(() => selectedResource?.projections
    .map((projection) => projection.projection)
    .filter((projection) => !allowedFamily || projectionFamily(projection) === allowedFamily) ?? [], [allowedFamily, selectedResource]);
  const detail = catalog.detail.data;
  const readyDetail = detail?.status === "ready" ? detail : null;
  const canConfirm = Boolean(readyDetail && selectedObjectiveIds.length > 0);

  function close() {
    void catalog.cancel();
    onOpenChange(false);
  }

  function chooseResource(resourceId: string) {
    const resource = catalog.resources.find((entry) => entry.id === resourceId);
    const projections = resource?.projections
      .map((projection) => projection.projection)
      .filter((projection) => !allowedFamily || projectionFamily(projection) === allowedFamily) ?? [];
    setSelectedResourceId(resourceId);
    setSelectedProjection(projections.length === 1 ? projections[0]! : "");
  }

  return (
    <Dialog.Root onOpenChange={(nextOpen) => { if (!nextOpen) close(); }} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.dialogOverlay} />
        <Dialog.Content
          className={`${styles.dialog} ${styles.pickerDialog}`}
          data-editor-surface
          onCloseAutoFocus={(event) => {
            if (!returnFocusRef?.current) return;
            event.preventDefault();
            returnFocusRef.current.focus();
          }}
        >
          <header className={styles.pickerHeader}>
            <Dialog.Title className={styles.dialogTitle}>{text.title}</Dialog.Title>
            <Dialog.Description className={styles.dialogDescription}>Elige un material publicado de la biblioteca para usarlo en esta actividad.</Dialog.Description>
          </header>

          <div className={styles.pickerBody}>
            <div className={styles.pickerFilters}>
              <label className={styles.field}>
                <span>Buscar por título</span>
                <input
                  onChange={(event) => catalog.setFilterDraft((filters) => ({ ...filters, q: event.target.value }))}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    setSelectedResourceId(null);
                    setSelectedProjection("");
                    catalog.applyFilters();
                  }}
                  type="search"
                  value={catalog.filterDraft.q}
                />
              </label>
              <label className={styles.field}>
                <span>Formato</span>
                <select onChange={(event) => catalog.setFilterDraft((filters) => ({ ...filters, projection: event.target.value as typeof filters.projection }))} value={catalog.filterDraft.projection}>
                  <option value="">Todos</option>
                  {Object.entries(formatLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                <span>Tema</span>
                <select onChange={(event) => catalog.setFilterDraft((filters) => ({ ...filters, topic: event.target.value }))} value={catalog.filterDraft.topic}>
                  <option value="">Todos</option>
                  {resourceTopics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
                </select>
              </label>
              <button className={styles.secondaryButton} disabled={catalog.catalog.isFetching} onClick={() => {
                setSelectedResourceId(null);
                setSelectedProjection("");
                catalog.applyFilters();
              }} type="button"><MagnifyingGlass aria-hidden size={18} /> Buscar</button>
            </div>

            {catalog.catalog.isError ? (
              <div className={styles.pickerMessage}><strong>No pudimos consultar los materiales.</strong><button className={styles.textButton} onClick={() => void catalog.catalog.refetch()} type="button">Reintentar</button></div>
            ) : catalog.catalog.isPending ? (
              <p className={styles.pickerMessage}>Buscando materiales publicados…</p>
            ) : catalog.resources.length === 0 ? (
              <div className={styles.pickerMessage}>
                {catalog.appliedFilters.q || catalog.appliedFilters.projection || catalog.appliedFilters.topic ? (
                  <><strong>No encontramos materiales con estos filtros.</strong><p>Prueba otro título o quita los filtros.</p><button className={styles.textButton} onClick={() => { setSelectedResourceId(null); setSelectedProjection(""); catalog.clearFilters(); }} type="button">Limpiar filtros</button></>
                ) : (
                  <><strong>Todavía no hay materiales publicados.</strong><p>Crea y publica uno en Contenido para añadirlo aquí.</p><Link href="/panel/contenido" rel="noreferrer" target="_blank">Abrir Contenido</Link></>
                )}
              </div>
            ) : (
              <ul className={styles.materialList}>
                {catalog.resources.map((resource) => {
                  const projections = resource.projections.filter((projection) => !allowedFamily || projectionFamily(projection.projection) === allowedFamily);
                  if (projections.length === 0) return null;
                  const selected = resource.id === selectedResourceId;
                  return (
                    <li className={selected ? styles.selectedMaterial : undefined} key={resource.id}>
                      <div><strong>{resource.title}</strong><span>{resource.topic || "Sin tema"}</span><small>{projections.map((projection) => formatLabels[projection.projection]).join(" · ")}{resource.estimatedMinutes ? ` · ${resource.estimatedMinutes} min` : ""}</small></div>
                      <button aria-pressed={selected} className={styles.secondaryButton} onClick={() => chooseResource(resource.id)} type="button">{selected ? <><Check aria-hidden size={18} /> Elegido</> : "Elegir"}</button>
                    </li>
                  );
                })}
              </ul>
            )}
            {catalog.catalog.hasNextPage ? <button className={styles.secondaryButton} disabled={catalog.catalog.isFetchingNextPage} onClick={() => void catalog.catalog.fetchNextPage()} type="button">{catalog.catalog.isFetchingNextPage ? "Cargando…" : "Cargar más"}</button> : null}

            {selectedResource ? (
              <section className={styles.selectionPanel} aria-labelledby="selected-material-title">
                <h3 id="selected-material-title">Completa la selección</h3>
                <fieldset className={styles.formatChoices}>
                  <legend>Formato</legend>
                  {allowedProjections.map((projection) => <label key={projection}><input checked={selectedProjection === projection} name="material-projection" onChange={() => setSelectedProjection(projection)} type="radio" /><span>{formatLabels[projection]}</span></label>)}
                </fieldset>
                {objectives.length > 1 ? (
                  <fieldset className={styles.objectiveChoices}>
                    <legend>Objetivo de esta actividad</legend>
                    {objectives.filter((objective) => objective.title.trim()).map((objective) => <label key={objective.id}><input checked={selectedObjectiveIds.includes(objective.id)} name="new-activity-objective" onChange={() => setSelectedObjectiveIds([objective.id])} type="radio" /><span>{objective.title}</span></label>)}
                  </fieldset>
                ) : null}
                {selectedProjection && catalog.detail.isPending ? <p>Cargando el detalle del material…</p> : null}
                {catalog.detail.isError ? <p className={styles.inlineMessage}>No pudimos confirmar este material. Vuelve a intentarlo.</p> : null}
                {detail?.status === "unavailable" ? <p className={styles.inlineMessage}>Este material ya no está disponible. Elige otro.</p> : null}
                {readyDetail ? <p className={styles.selectionReady}>{readyDetail.title} · {formatLabels[readyDetail.projection]}{readyDetail.estimatedMinutes ? ` · ${readyDetail.estimatedMinutes} min` : ""}</p> : null}
                {mode.kind === "replace" ? <label className={styles.checkboxRow}><input checked={useNewTitle} onChange={(event) => setUseNewTitle(event.target.checked)} type="checkbox" /><span>Usar el nombre del nuevo material</span></label> : null}
              </section>
            ) : null}
          </div>

          <footer className={styles.pickerFooter}>
            <button className={styles.secondaryButton} onClick={close} type="button">Cancelar</button>
            <button className={styles.primaryAction} disabled={!canConfirm} onClick={() => {
              if (!readyDetail) return;
              if (onConfirm({ detail: readyDetail, mode, objectiveIds: selectedObjectiveIds, useNewTitle })) close();
            }} type="button">{text.action}</button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
