"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  MiniMap,
  applyNodeChanges,
  useReactFlow,
  MarkerType,
  type NodeChange,
  type Viewport,
} from "@xyflow/react";
import { ArrowsOut, Minus, Plus, MapTrifold } from "@phosphor-icons/react";
import type { LearningMapLevelResponse, MapItem } from "@cediah/contracts";
import {
  LearningNode,
  BlockNode,
  LessonNode,
  type FlowMapNode,
  type MapItemAction,
} from "./nodes/learning-map-item";
import {
  initialLayout,
  reconcileLayout,
  resolveDropOverlap,
  type Positions,
} from "./map-layout";
import {
  readSpatialSnapshot,
  writeSpatialSnapshot,
  spatialKey,
} from "./map-spatial-state";
import type { MapLayoutQueue } from "./use-map-layout-save";
import styles from "./learning-map.module.css";
const nodeTypes = { node: LearningNode, block: BlockNode, lesson: LessonNode };
export default function LearningMapCanvas({
  level,
  account,
  queue,
  onOpen,
  onAction,
  onPrefetch,
  selecting,
  selected,
  organizing,
  phase,
  organizeToken,
  movingId,
  onMoveFinished,
}: {
  level: LearningMapLevelResponse;
  account: string;
  queue: MapLayoutQueue;
  onOpen: (item: MapItem) => void;
  onAction: (item: MapItem, action: MapItemAction) => void;
  onPrefetch: (item: MapItem) => () => void;
  selecting: boolean;
  selected: string[];
  organizing: boolean;
  phase: string;
  organizeToken: number;
  movingId: string | null;
  onMoveFinished: () => void;
}) {
  const flow = useReactFlow<FlowMapNode>();
  const longTitles = level.items.some((item) => item.title.length > 20);
  const cardHeight = longTitles ? 260 : level.levelKey === "root" ? 184 : 172;
  const wrapper = useRef<HTMLDivElement>(null),
    levelKey = useRef("");
  const layoutVersion = useRef(-1);
  const initialized = useRef(new Set<string>());
  const [nodes, setNodes] = useState<FlowMapNode[]>([]),
    [zoom, setZoom] = useState(1),
    [mini, setMini] = useState(false);
  const [outside, setOutside] = useState(false);
  const points = useRef<Positions>({});
  const fitLevel = useCallback(
    (maxZoom = 1) => {
      const box = wrapper.current?.querySelector(".react-flow");
      const positions = Object.values(points.current);
      if (!box || !positions.length) return;
      const width = level.levelKey === "root" ? 168 : 156;
      const height = Math.max(220, cardHeight);
      const extentX =
        Math.max(...positions.map((p) => p.x)) -
        Math.min(...positions.map((p) => p.x)) +
        width;
      const extentY =
        Math.max(...positions.map((p) => p.y)) -
        Math.min(...positions.map((p) => p.y)) +
        height;
      if (
        extentX * 0.65 > box.clientWidth ||
        extentY * 0.65 > box.clientHeight
      ) {
        const next =
          level.items.find(
            (item) =>
              item.availability === "available" &&
              item.progress.status !== "completed",
          ) ?? level.items[0];
        const point = next && points.current[next.occurrenceId];
        if (point)
          return flow.setCenter(point.x + width / 2, point.y + height / 2, {
            zoom: 0.65,
          });
      }
      return flow.fitView({ padding: 0.18, minZoom: 0.65, maxZoom });
    },
    [cardHeight, flow, level.items, level.levelKey],
  );
  const [undo, setUndo] = useState<{
    positions: Positions;
    expires: number;
  } | null>(null);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(
      () => setUndo(null),
      Math.max(0, undo.expires - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [undo]);
  const previousOrganize = useRef(organizeToken),
    movingOriginal = useRef<Positions | null>(null);
  const snapshotKey = useCallback(
    () =>
      spatialKey(
        account,
        level.mapId,
        level.levelKey,
        (wrapper.current?.clientWidth ?? 1000) < 768,
      ),
    [account, level.mapId, level.levelKey],
  );
  const saveViewport = useCallback(
    (v: Viewport) => {
      const box = wrapper.current;
      if (!box || !box.clientWidth || !box.clientHeight) return;
      writeSpatialSnapshot(snapshotKey(), {
        schemaVersion: 1,
        viewport: { ...v, zoom: Math.min(1.35, Math.max(0.65, v.zoom)) },
        selectedOccurrenceId: selected[0] ?? null,
        focusedOccurrenceId: selected[0] ?? null,
        navigationPath: level.ancestry.map((a) => a.route),
        containerWidth: box.clientWidth,
        containerHeight: box.clientHeight,
      });
      setZoom(v.zoom);
      setOutside(
        Object.values(points.current).some(
          (p) =>
            p.x * v.zoom + v.x < 0 ||
            p.y * v.zoom + v.y < 0 ||
            (p.x + 168) * v.zoom + v.x > box.clientWidth ||
            (p.y + 220) * v.zoom + v.y > box.clientHeight,
        ),
      );
    },
    [level.ancestry, selected, snapshotKey],
  );
  useEffect(() => {
    const changed = levelKey.current !== level.levelKey;
    const root = level.levelKey === "root",
      width = wrapper.current?.clientWidth ?? 900;
    const saved =
      changed || layoutVersion.current !== level.layout.rowVersion
        ? level.layout.positions
        : { ...level.layout.positions, ...points.current };
    const positions = reconcileLayout(
      level.items.map((i) => i.occurrenceId),
      { ...saved, ...queue.positions(level.levelKey) },
      width,
      root,
      cardHeight,
    );
    points.current = positions;
    levelKey.current = level.levelKey;
    layoutVersion.current = level.layout.rowVersion;
    const missing = Object.fromEntries(
      level.items
        .filter(
          (i) =>
            !initialized.current.has(`${level.levelKey}:${i.occurrenceId}`) &&
            !level.layout.positions[i.occurrenceId] &&
            !queue.positions(level.levelKey)[i.occurrenceId],
        )
        .map((i) => [i.occurrenceId, positions[i.occurrenceId]!]),
    );
    for (const item of level.items)
      initialized.current.add(`${level.levelKey}:${item.occurrenceId}`);
    if (Object.keys(missing).length) queue.enqueue(level.levelKey, missing);
    setNodes(
      level.items.map((item) => ({
        id: item.occurrenceId,
        type: item.kind,
        position: positions[item.occurrenceId]!,
        style: { pointerEvents: "all" },
        draggable: organizing,
        dragHandle: ".map-drag-handle",
        selectable: false,
        focusable: false,
        data: {
          item,
          selected: selected.includes(item.occurrenceId),
          selecting,
          organizing,
          onOpen,
          onAction,
          onPrefetch,
        },
      })),
    );
    if (changed) {
      const snapshot = readSpatialSnapshot(snapshotKey());
      requestAnimationFrame(() => {
        if (snapshot && Math.abs(width / snapshot.containerWidth - 1) <= 0.2)
          void flow.setViewport(snapshot.viewport);
        else if (snapshot) {
          const p =
            positions[snapshot.selectedOccurrenceId ?? ""] ??
            Object.values(positions)[0];
          if (p)
            void flow.setCenter(p.x + 80, p.y + 95, {
              zoom: snapshot.viewport.zoom,
            });
        } else void fitLevel();
      });
    }
  }, [
    level,
    queue,
    organizing,
    selected,
    selecting,
    onOpen,
    onAction,
    onPrefetch,
    flow,
    snapshotKey,
    cardHeight,
    fitLevel,
  ]);
  const updatePoints = useCallback((next: Positions) => {
    points.current = { ...points.current, ...next };
    setNodes((current) =>
      current.map((n) => ({
        ...n,
        position: points.current[n.id] ?? n.position,
      })),
    );
  }, []);
  useEffect(() => {
    if (previousOrganize.current === organizeToken) return;
    previousOrganize.current = organizeToken;
    const positions = initialLayout(
      level.items.map((i) => i.occurrenceId),
      wrapper.current?.clientWidth ?? 900,
      level.levelKey === "root",
      cardHeight,
    );
    setUndo({ positions: points.current, expires: Date.now() + 30_000 });
    updatePoints(positions);
    if (Object.keys(positions).length) queue.enqueue(level.levelKey, positions);
  }, [
    organizeToken,
    level.items,
    level.levelKey,
    queue,
    updatePoints,
    cardHeight,
  ]);
  useEffect(() => {
    if (!movingId) {
      movingOriginal.current = null;
      return;
    }
    movingOriginal.current = { ...points.current };
    const keydown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return;
      const p = points.current[movingId];
      if (!p) return;
      const delta = {
        ArrowLeft: [-16, 0],
        ArrowRight: [16, 0],
        ArrowUp: [0, -16],
        ArrowDown: [0, 16],
      }[event.key];
      if (delta) {
        event.preventDefault();
        updatePoints({
          [movingId]: { x: p.x + delta[0]!, y: p.y + delta[1]! },
        });
      }
      if (event.key === "Escape" || event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape") updatePoints(movingOriginal.current!);
        else {
          const point = resolveDropOverlap(
            movingId,
            p,
            points.current,
            level.levelKey === "root",
            cardHeight,
          );
          updatePoints({ [movingId]: point });
          queue.enqueue(level.levelKey, { [movingId]: point });
        }
        onMoveFinished();
      }
    };
    window.addEventListener("keydown", keydown, true);
    return () => window.removeEventListener("keydown", keydown, true);
  }, [
    movingId,
    level.levelKey,
    queue,
    updatePoints,
    onMoveFinished,
    cardHeight,
  ]);
  const changes = useCallback(
    (changes: NodeChange<FlowMapNode>[]) =>
      setNodes((current) => applyNodeChanges(changes, current)),
    [],
  );
  const edges = useMemo(
    () =>
      level.edges.map((e, index) => ({
        id: `${index}:${e.sourceOccurrenceId}:${e.targetOccurrenceId}`,
        source: e.sourceOccurrenceId,
        target: e.targetOccurrenceId,
        type: "smoothstep",
        pathOptions: { borderRadius: 20 },
        style: { stroke: "#BACBC5", strokeWidth: 1.25 },
        markerEnd:
          e.kind === "sequence"
            ? {
                type: MarkerType.ArrowClosed,
                color: "#BACBC5",
                width: 12,
                height: 12,
              }
            : undefined,
        focusable: false,
        selectable: false,
      })),
    [level.edges],
  );
  return (
    <div className={styles.canvas} ref={wrapper} data-long-titles={longTitles}>
      <div className={styles.flow} data-phase={phase}>
        <ReactFlow<FlowMapNode>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={changes}
          onNodeDragStop={(_e, n) => {
            const p = resolveDropOverlap(
              n.id,
              n.position,
              points.current,
              level.levelKey === "root",
              cardHeight,
            );
            updatePoints({ [n.id]: p });
            queue.enqueue(level.levelKey, { [n.id]: p });
          }}
          onMoveEnd={(_e, v) => saveViewport(v)}
          minZoom={0.65}
          maxZoom={1.35}
          zoomOnDoubleClick={false}
          nodeDragThreshold={6}
          nodesConnectable={false}
          edgesReconnectable={false}
          deleteKeyCode={null}
          nodesFocusable={false}
          edgesFocusable={false}
          onlyRenderVisibleElements={level.items.length >= 60}
          selectionOnDrag={false}
          ariaLabelConfig={{
            "controls.zoomIn.ariaLabel": "Acercar",
            "controls.zoomOut.ariaLabel": "Alejar",
            "controls.fitView.ariaLabel": "Ajustar vista",
          }}
        >
          {level.items.length > 24 && outside && mini ? (
            <MiniMap pannable zoomable nodeColor="#d5e3da" />
          ) : null}
        </ReactFlow>
      </div>
      <div className={styles.controls} aria-label="Controles del mapa">
        <button
          className={styles.iconButton}
          aria-label="Alejar"
          onClick={() => void flow.zoomTo(Math.max(0.65, zoom - 0.1))}
        >
          <Minus size={18} />
        </button>
        <button
          className={styles.button}
          aria-label="Restablecer zoom al 100 %"
          onClick={() => void flow.zoomTo(1)}
        >
          {Math.round(zoom * 100)} %
        </button>
        <button
          className={styles.iconButton}
          aria-label="Acercar"
          onClick={() => void flow.zoomTo(Math.min(1.35, zoom + 0.1))}
        >
          <Plus size={18} />
        </button>
        <button
          className={styles.iconButton}
          aria-label="Ajustar vista"
          onClick={() => void fitLevel(1.35)}
        >
          <ArrowsOut size={18} />
        </button>
        {level.items.length > 24 && outside ? (
          <button
            className={styles.iconButton}
            aria-label="Alternar minimapa"
            aria-pressed={mini}
            onClick={() => setMini(!mini)}
          >
            <MapTrifold size={18} />
          </button>
        ) : null}
        {undo ? (
          <button
            className={styles.button}
            onClick={() => {
              updatePoints(undo.positions);
              queue.enqueue(level.levelKey, undo.positions);
              setUndo(null);
            }}
          >
            Deshacer orden
          </button>
        ) : null}
      </div>
    </div>
  );
}
