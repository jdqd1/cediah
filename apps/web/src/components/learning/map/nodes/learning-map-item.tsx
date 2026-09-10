"use client";
import { memo, useEffect, useRef } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { DotsThree, DotsSixVertical } from "@phosphor-icons/react";
import type { MapItem } from "@cediah/contracts";
import { MedicalMapIcon } from "../medical-map-icon";
import styles from "../learning-map.module.css";
export type MapItemAction = "info" | "rename" | "add" | "remove" | "move";
export type ItemData = {
  item: MapItem;
  selected: boolean;
  selecting: boolean;
  organizing: boolean;
  onOpen: (item: MapItem) => void;
  onAction: (item: MapItem, action: MapItemAction) => void;
  onPrefetch: (item: MapItem) => () => void;
};
export type FlowMapNode = Node<ItemData>;
export const statusLabels = {
  not_started: "No iniciado",
  in_progress: "En progreso",
  completed: "✓ Completado",
  empty: "Agrega contenido",
  unavailable: "Progreso no disponible",
};
export const LearningMapItem = memo(function LearningMapItem({
  data,
  handles = false,
}: {
  data: ItemData;
  handles?: boolean;
}) {
  const { item } = data;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    cancel = useRef<(() => void) | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    cancel.current?.();
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      cancel.current?.();
    },
    [],
  );
  const prefetch = () => {
    clear();
    timer.current = setTimeout(() => {
      cancel.current = data.onPrefetch(item);
    }, 120);
  };
  return (
    <article
      className={styles.card}
      data-kind={item.kind}
      data-selected={data.selected}
      aria-label={`${item.title}, ${statusLabels[item.progress.status]}, ${item.childCountLabel}`}
    >
      {handles ? (
        <>
          <Handle
            type="target"
            position={Position.Left}
            isConnectable={false}
            style={{ opacity: 0 }}
          />
          <Handle
            type="source"
            position={Position.Right}
            isConnectable={false}
            style={{ opacity: 0 }}
          />
        </>
      ) : null}
      {data.organizing ? (
        <span className={`${styles.drag} map-drag-handle`} aria-hidden="true">
          <DotsSixVertical size={18} />
        </span>
      ) : null}
      <details
        className={`${styles.menu} nodrag nopan`}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.currentTarget.open = false;
            e.stopPropagation();
            e.currentTarget.querySelector("summary")?.focus();
          }
        }}
      >
        <summary aria-label={`Opciones de ${item.title}`}>
          <DotsThree size={22} />
        </summary>
        <div className={styles.menuItems}>
          {(
            [
              "info",
              ...(item.kind === "node" ? ["rename", "add"] : []),
              "move",
              ...(item.occurrenceId.startsWith("lesson:") ? [] : ["remove"]),
            ] as MapItemAction[]
          ).map((action) => (
            <button
              type="button"
              key={action}
              onClick={(e) => {
                e.currentTarget.closest("details")!.open = false;
                data.onAction(item, action);
              }}
            >
              {
                {
                  info: "Ver información",
                  rename: "Renombrar",
                  add: "Agregar contenido",
                  remove: "Quitar del mapa",
                  move: "Mover con teclado",
                }[action]
              }
            </button>
          ))}
        </div>
      </details>
      <button
        type="button"
        className={`${styles.openButton} nodrag nopan`}
        data-map-open={item.occurrenceId}
        onMouseEnter={prefetch}
        onFocus={prefetch}
        onMouseLeave={clear}
        onBlur={clear}
        onPointerDown={(e) => {
          if (e.pointerType === "touch") {
            clear();
            cancel.current = data.onPrefetch(item);
          }
        }}
        onClick={() => data.onOpen(item)}
        aria-pressed={data.selecting ? data.selected : undefined}
        aria-label={`${data.selecting ? "Seleccionar" : "Abrir"} ${item.title}`}
      >
        {data.selecting ? (
          <span aria-hidden="true">{data.selected ? "☑" : "☐"}</span>
        ) : null}
        <span className={styles.iconWell}>
          <MedicalMapIcon iconKey={item.iconKey} />
        </span>
        <strong title={item.title}>{item.title}</strong>
        <span className={styles.percentage}>
          {item.progress.percentage === null
            ? "—"
            : `${item.progress.percentage} %`}
        </span>
        {item.kind !== "lesson" ? <small>{item.childCountLabel}</small> : null}
        <span className={styles.badge} data-status={item.progress.status}>
          {statusLabels[item.progress.status]}
        </span>
      </button>
    </article>
  );
});
export const LearningNode = memo(function LearningNode({
  data,
}: NodeProps<FlowMapNode>) {
  return <LearningMapItem data={data} handles />;
});
export const BlockNode = LearningNode;
export const LessonNode = LearningNode;
