"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  CaretRight,
  Plus,
  ListBullets,
  MapTrifold,
  X,
} from "@phosphor-icons/react";
import type {
  MapItem,
  MapRoute,
  MapCatalogItem,
  MapIconKey,
  LearningMapSuggestionsResponse,
  LearningMapMutationResponse,
  LearningMapSummaryResponse,
} from "@cediah/contracts";
import { MapWorkspaceProvider, useMapWorkspace } from "./map-provider";
import type { MapClient } from "./map-client";
import { buildMapHref, ROOT_MAP_ROUTE } from "./map-route";
import { LearningMapItem, type MapItemAction } from "./nodes/learning-map-item";
import { MedicalMapIcon } from "./medical-map-icon";
import { LessonDetailPanel } from "./lesson-detail-panel";
import { MapMobileSheet } from "./map-mobile-sheet";
import { MapEditDialog } from "./add-content-dialog";
import { MapIconColorDialog } from "./map-icon-color-dialog";
import { MapQuickPanel } from "./map-quick-panel";
import styles from "./learning-map.module.css";
const Canvas = dynamic(() => import("./learning-map-canvas"), {
  ssr: false,
  loading: () => <p className={styles.empty}>Preparando mapa…</p>,
});
type Dialog = {
  mode: "add" | "create" | "rename" | "group" | "remove";
  item?: MapItem;
  initialTab?: "existing" | "node";
};
type QuickTab = "hoy" | "rutas" | "progreso";

function Workspace() {
  const {
    account,
    client,
    level,
    loading,
    error,
    phase,
    direction,
    queue,
    navigate,
    back,
    refresh,
    prefetch,
    detail,
  } = useMapWorkspace();
  const root = useRef<HTMLDivElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const [wide, setWide] = useState(false),
    [list, setList] = useState(false),
    [organizing, setOrganizing] = useState(false),
    [movingId, setMovingId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false),
    [selection, setSelection] = useState<string[]>([]),
    [dialog, setDialog] = useState<Dialog | null>(null),
    [info, setInfo] = useState<MapItem | "container" | null>(null),
    [quickTab, setQuickTab] = useState<QuickTab | null>(null),
    [quickSummary, setQuickSummary] = useState<LearningMapSummaryResponse | null>(null),
    [quickError, setQuickError] = useState(false),
    [colorItem, setColorItem] = useState<MapItem | null>(null),
    [iconColors, setIconColors] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] =
      useState<LearningMapSuggestionsResponse | null>(null),
    [suggestionError, setSuggestionError] = useState(false),
    [message, setMessage] = useState("");
  const [undo, setUndo] = useState<LearningMapMutationResponse["undo"]>(null),
    [busy, setBusy] = useState(false);
  const mutation = useRef<{
      operation: string;
      payload: string;
      key: string;
    } | null>(null),
    mutateLock = useRef(false);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const size = () => {
      const parent = el.parentElement;
      const padding = parent
        ? parseFloat(getComputedStyle(parent).paddingBottom)
        : 0;
      el.style.setProperty(
        "--map-height",
        `${Math.max(400, window.innerHeight - el.getBoundingClientRect().top - padding)}px`,
      );
    };
    const observer = new ResizeObserver((entries) => {
      setWide(entries[0]!.contentRect.width >= 768);
      size();
    });
    observer.observe(el);
    window.addEventListener("resize", size);
    size();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", size);
    };
  }, []);
  const currentLevelKey = level?.levelKey;
  const mapId = level?.mapId;
  useEffect(() => {
    if (!mapId) return;
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(`map-icon-colors:${account}:${mapId}`);
        setIconColors(saved ? JSON.parse(saved) as Record<string, string> : {});
      } catch { setIconColors({}); }
    }, 0);
    return () => clearTimeout(timer);
  }, [account, mapId]);
  const rootSummary: LearningMapSummaryResponse | null = level?.levelKey === "root"
    ? {
      map: { id: level.mapId },
      nodes: level.items,
      progress: level.containerSummary.progress,
      structuralVersion: level.structuralVersion,
    } : null;
  const displayedSummary = rootSummary ?? quickSummary;
  const quickLoading = Boolean(quickTab && !displayedSummary && !quickError);
  useEffect(() => {
    if (!quickTab || displayedSummary || quickError || !level) return;
    const controller = new AbortController();
    void client.summary().then((summary) => {
      if (!controller.signal.aborted) setQuickSummary(summary);
    }).catch(() => {
      if (!controller.signal.aborted) setQuickError(true);
    });
    return () => controller.abort();
  }, [client, displayedSummary, level, quickError, quickTab]);
  useEffect(() => {
    if (currentLevelKey) heading.current?.focus({ preventScroll: true });
  }, [currentLevelKey]);
  useEffect(() => {
    if (!level) return;
    const c = new AbortController();
    void client
      .suggestions(level.route, c.signal)
      .then((result) => {
        setSuggestions(result);
        setSuggestionError(false);
      })
      .catch(() => {
        if (!c.signal.aborted) setSuggestionError(true);
      });
    return () => c.abort();
  }, [client, level]);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(
      () => setUndo(null),
      Math.max(0, Date.parse(undo.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [undo]);
  const routeFor = useCallback(
    (item: MapItem): MapRoute => {
      if (!level) return ROOT_MAP_ROUTE;
      return item.kind === "node"
        ? { nodeId: item.occurrenceId, entryId: null, unitStableKey: null }
        : level.levelKey.startsWith("block:")
          ? { ...level.route, unitStableKey: item.unitStableKey }
          : {
              nodeId: level.route.nodeId,
              entryId: item.occurrenceId,
              unitStableKey: null,
            };
    },
    [level],
  );
  const open = useCallback(
    (item: MapItem) => {
      if (selecting) {
        setSelection((current) =>
          current.includes(item.occurrenceId)
            ? current.filter((id) => id !== item.occurrenceId)
            : [...current, item.occurrenceId],
        );
        return;
      }
      setInfo(null);
      setQuickTab(null);
      navigate(routeFor(item));
    },
    [navigate, routeFor, selecting],
  );
  const action = useCallback((item: MapItem, action: MapItemAction) => {
    if (action === "select") {
      setSelecting(true);
      setSelection((current) => current.includes(item.occurrenceId)
        ? current.filter((id) => id !== item.occurrenceId)
        : [...current, item.occurrenceId]);
      return;
    }
    if (action === "move") {
      setList(false);
      setOrganizing(true);
      setMovingId(item.occurrenceId);
      return;
    }
    if (action === "info") {
      setQuickTab(null);
      setInfo(item);
      return;
    }
    if (action === "color") {
      setColorItem(item);
      return;
    }
    setDialog({
      mode:
        action === "add" ? "add" : action === "remove" ? "remove" : "rename",
      item,
    });
  }, []);
  const intention = useCallback(
    (item: MapItem) => prefetch(routeFor(item)),
    [prefetch, routeFor],
  );
  const moveFinished = useCallback(() => {
    setMovingId(null);
    setOrganizing(false);
  }, []);
  const closePanel = useCallback(() => {
    if (quickTab) {
      setQuickTab(null);
      return;
    }
    setInfo(null);
    if (level?.selectedLesson) back();
    else if (detail && level)
      window.history.replaceState(null, "", buildMapHref(level.route));
  }, [back, detail, level, quickTab]);
  const showTab = (tab: QuickTab) => {
    setInfo(null);
    setQuickError(false);
    setQuickTab((current) => current === tab ? null : tab);
  };
  const saveIconColor = (item: MapItem, color: string | null) => {
    if (!level) return;
    const next = { ...iconColors };
    if (color) next[item.occurrenceId] = color;
    else delete next[item.occurrenceId];
    setIconColors(next);
    try { localStorage.setItem(`map-icon-colors:${account}:${level.mapId}`, JSON.stringify(next)); } catch { /* Keep this session's choice. */ }
    setColorItem(null);
  };
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !dialog &&
        !movingId &&
        !(e.target instanceof HTMLInputElement)
      )
        closePanel();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [closePanel, dialog, movingId]);
  async function mutate(operation: string, body: Record<string, unknown>) {
    if (mutateLock.current || !level)
      throw new Error("Espera a que termine el guardado.");
    mutateLock.current = true;
    setBusy(true);
    setMessage("");
    const payload = JSON.stringify({
      expectedVersion: level.structuralVersion,
      ...body,
    });
    if (
      mutation.current?.operation !== operation ||
      mutation.current.payload !== payload
    )
      mutation.current = { operation, payload, key: crypto.randomUUID() };
    try {
      const response = await client.mutate(
        operation,
        JSON.parse(payload),
        mutation.current.key,
      );
      mutation.current = null;
      setUndo(response.undo);
      await refresh();
      setMessage("Cambio guardado.");
      return response;
    } finally {
      mutateLock.current = false;
      setBusy(false);
    }
  }
  async function add(item: MapCatalogItem) {
    const nodeId =
      dialog?.item?.kind === "node"
        ? dialog.item.occurrenceId
        : level?.route.nodeId;
    if (item.kind === "topic_template")
      await mutate("nodes", {
        title: item.title.slice(0, 80),
        iconKey: "folder",
        topicTemplateId: item.topicId,
      });
    else if (nodeId) await mutate("entries", { nodeId, ref: item.ref });
    else
      await mutate("nodes", {
        title: item.title.slice(0, 80),
        iconKey: "folder",
        items: [item.ref],
      });
  }
  async function submit(title: string, icon: MapIconKey) {
    if (!dialog || !level) return;
    if (dialog.mode === "rename")
      await mutate(`nodes/${dialog.item!.occurrenceId}`, { title });
    if (dialog.mode === "create")
      await mutate("nodes", { title, iconKey: icon });
    if (dialog.mode === "remove") {
      await mutate("remove", {
        target: {
          kind: dialog.item!.kind === "node" ? "node" : "entry",
          id: dialog.item!.occurrenceId,
        },
      });
      setInfo(null);
    }
    if (dialog.mode === "group") {
      const selections = level.items
        .filter((i) => selection.includes(i.occurrenceId))
        .map((i) =>
          i.kind === "node"
            ? { rootNodeId: i.occurrenceId }
            : level.levelKey.startsWith("block:")
              ? {
                  blockEntryId: level.route.entryId,
                  unitStableKey: i.unitStableKey,
                }
              : { entryId: i.occurrenceId },
        );
      await mutate("group", {
        title,
        iconKey: icon,
        route: level.route,
        selections,
      });
      setSelection([]);
      setSelecting(false);
    }
  }
  async function resolveConflict(mine: boolean) {
    try {
      for (const [key, q] of queue.levels)
        if (q.state === "conflict") {
          const r =
            queue.routes.get(key) ??
            (key === "root"
              ? ROOT_MAP_ROUTE
              : key.startsWith("node:")
                ? { nodeId: key.slice(5), entryId: null, unitStableKey: null }
                : level?.levelKey === key
                  ? level.route
                  : null);
          if (!r)
            throw new Error(
              "Vuelve al bloque con cambios pendientes para resolver su conflicto.",
            );
          const saved = await client.level(r);
          queue.resolve(key, saved.layout.rowVersion, mine);
        }
      await refresh();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "No pudimos recuperar las posiciones.",
      );
    }
  }
  const selected = selecting
    ? selection
    : level?.selectedLesson
      ? [
          level.route.unitStableKey
            ? `lesson:${level.route.unitStableKey}`
            : level.route.entryId!,
        ]
      : [];
  const unavailableSelection =
    level?.route.entryId &&
    !level.selectedLesson &&
    level.items.find(
      (item) =>
        item.occurrenceId === level.route.entryId &&
        item.kind === "lesson" &&
        item.availability !== "available",
    );
  const panel = quickTab ? (
    <MapQuickPanel
      tab={quickTab}
      summary={displayedSummary}
      loading={quickLoading}
      error={quickError}
      onTab={setQuickTab}
      onClose={() => setQuickTab(null)}
      onRetry={() => setQuickError(false)}
      onOpen={(item) => {
        setQuickTab(null);
        navigate({ nodeId: item.occurrenceId, entryId: null, unitStableKey: null });
      }}
    />
  ) : unavailableSelection ? (
    <aside className={styles.panel} aria-label="Lección no disponible">
      <header className={styles.panelHeader}>
        <h2>Lección no disponible</h2>
        <button
          className={styles.iconButton}
          aria-label="Cerrar lección"
          onClick={back}
        >
          <X size={18} />
        </button>
      </header>
      <div className={styles.panelScroll}>
        <p>
          La lección fue retirada o no existe en tu versión actual de la ruta.
          Tu organización y el progreso registrado se conservan.
        </p>
        <button
          className={styles.button}
          onClick={() => void refresh().catch((e) => setMessage(e.message))}
        >
          Actualizar contenido
        </button>
      </div>
    </aside>
  ) : level?.selectedLesson ? (
    <LessonDetailPanel
      key={`${level.selectedLesson.pathId}:${level.selectedLesson.unitStableKey}`}
      lesson={level.selectedLesson}
      onClose={closePanel}
    />
  ) : info || detail ? (
    <aside className={styles.panel} aria-label="Información del contenido">
      <header className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <h2>
            {info && info !== "container"
              ? info.title
              : level?.containerSummary.title}
          </h2>
          <p>{level?.containerSummary.description}</p>
        </div>
        <button
          className={styles.iconButton}
          aria-label="Cerrar información"
          onClick={closePanel}
        >
          <X size={18} />
        </button>
      </header>
      <div className={styles.panelScroll}>
        {info && info !== "container" ? (
          <>
            <p>
              {info.progress.percentage ?? "—"} % · {info.childCountLabel}
            </p>
            <button className={styles.primary} onClick={() => open(info)}>
              Abrir contenido
            </button>
          </>
        ) : (
          level?.items.map((item) => (
            <div className={styles.suggestion} key={item.occurrenceId}>
              <div>
                <strong>{item.title}</strong>
                <small>{item.progress.percentage ?? "—"} %</small>
              </div>
              <button
                className={styles.iconButton}
                aria-label={`Abrir ${item.title}`}
                onClick={() => open(item)}
              >
                <CaretRight size={18} />
              </button>
            </div>
          ))
        )}
        {level?.edges.length ? (
          <details>
            <summary>Relaciones del nivel</summary>
            <ul>
              {level.edges.map((e, i) => (
                <li key={i}>
                  {
                    level.items.find(
                      (x) => x.occurrenceId === e.sourceOccurrenceId,
                    )?.title
                  }{" "}
                  →{" "}
                  {
                    level.items.find(
                      (x) => x.occurrenceId === e.targetOccurrenceId,
                    )?.title
                  }
                  : {e.label}
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <p>No hay relaciones declaradas en este nivel.</p>
        )}
      </div>
    </aside>
  ) : null;
  return (
    <main className={styles.workspace} ref={root}>
      <div
        data-map-background
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
        }}
      >
        <header className={styles.header}>
          <div className={styles.headerIdentity}>
            {level?.route.nodeId ? (
              <button
                className={`${styles.iconButton} ${styles.backButton}`}
                aria-label="Atrás en el mapa"
                onClick={() => { setInfo(null); back(); }}
              >
                <ArrowLeft size={20} />
              </button>
            ) : null}
            <div className={styles.headerText}>
              {level?.route.nodeId ? (
                <nav className={styles.breadcrumbs} aria-label="Ruta del mapa">
                  {level.ancestry.slice(0, -1).map((ancestor, index) => (
                    <span key={index}>
                      <button onClick={() => { setInfo(null); navigate(ancestor.route); }}>
                        {ancestor.title}
                      </button>
                      <CaretRight size={12} />
                    </span>
                  ))}
                </nav>
              ) : null}
              <h1 ref={heading} tabIndex={-1}>
                {level?.containerSummary.title ?? "Mi mapa de aprendizaje"}
              </h1>
              {level?.containerSummary.progress.percentage !== null && level ? (
                <span className={styles.status}>
                  {`${level.containerSummary.progress.percentage} % · ${level.containerSummary.progress.completedEssentialSteps}/${level.containerSummary.progress.totalEssentialSteps} esenciales`}
                </span>
              ) : null}
            </div>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.primary} aria-label="Nuevo nodo o agregar contenido" title="Nuevo nodo o agregar contenido" onClick={() => setDialog({ mode: "add", initialTab: "node" })} disabled={!level}>
              <Plus size={18} />
              <span>Nodo</span>
            </button>
            <button className={`${styles.button} ${styles.summaryToggle}`} aria-label="Abrir resumen de aprendizaje" aria-pressed={Boolean(quickTab)} onClick={() => showTab(quickTab ?? "hoy")}>
              <MapTrifold size={18} /> <span>Resumen</span>
            </button>
            <button className={styles.mobileViewsMenu} aria-label="Abrir resumen de aprendizaje" aria-pressed={Boolean(quickTab)} onClick={() => showTab(quickTab ?? "hoy")}>
              <MapTrifold size={18} /> <span>Vistas</span>
            </button>
            {selecting ? (
              <>
                <button className={styles.button} disabled={!selection.length} onClick={() => setDialog({ mode: "group" })}>
                  Crear nodo ({selection.length})
                </button>
                <button className={styles.iconButton} aria-label="Cancelar selección" title="Cancelar selección" onClick={() => { setSelecting(false); setSelection([]); }}>
                  <X size={18} />
                </button>
              </>
            ) : null}
            <span className={styles.status} role="status">
              {loading ? "Abriendo…" : queue.state === "saving" ? "Guardando…" : queue.state === "saved" ? "" : "Posiciones pendientes"}
            </span>
            <button className={`${styles.button} ${styles.viewToggle}`} aria-label={list ? "Vista de mapa" : "Vista de lista"} onClick={() => setList(!list)}>
              {list ? <MapTrifold size={18} /> : <ListBullets size={18} />}
              <span>{list ? "Mapa" : "Lista"}</span>
            </button>
          </div>
        </header>
        {movingId ? (
          <div className={styles.notice}>
            Mover con flechas · Enter guarda · Escape restaura.
          </div>
        ) : null}
        {error ? (
          <div className={styles.notice} role="alert">
            {error}
            <button
              className={styles.button}
              onClick={() => void refresh().catch((e) => setMessage(e.message))}
            >
              Reintentar
            </button>
            <button
              className={styles.button}
              onClick={() => navigate(ROOT_MAP_ROUTE)}
            >
              Ir a mi mapa
            </button>
          </div>
        ) : null}
        {queue.state === "conflict" ? (
          <div className={styles.notice} role="alert">
            Hay otras posiciones guardadas. Tu borrador se conserva.
            <button
              className={styles.button}
              onClick={() => void resolveConflict(true)}
            >
              Aplicar mis posiciones
            </button>
            <button
              className={styles.button}
              onClick={() => void resolveConflict(false)}
            >
              Usar las guardadas
            </button>
          </div>
        ) : queue.state === "failed" ? (
          <div className={styles.notice} role="alert">
            No se confirmaron las posiciones.
            <button
              className={styles.button}
              onClick={() => {
                for (const [key, q] of queue.levels)
                  if (q.state === "failed") void queue.flush(key);
              }}
            >
              Reintentar guardado
            </button>
          </div>
        ) : null}
        {message || undo ? (
          <div className={styles.notice} role="status">
            {message}
            {undo ? (
              <button
                className={styles.button}
                disabled={busy}
                onClick={() =>
                  void mutate("restore", {
                    undoReceiptKey: undo.undoReceiptKey,
                  }).catch((e) => setMessage(e.message))
                }
              >
                Deshacer
              </button>
            ) : null}
          </div>
        ) : null}
        <div className={styles.body}>
          {!level ? (
            <div className={styles.empty}>
              <h2>
                {loading ? "Preparando tu mapa" : "No pudimos abrir el mapa"}
              </h2>
              <p>La información se confirma desde tu cuenta.</p>
            </div>
          ) : !level.items.length ? (
            <div className={styles.empty}>
              <MedicalMapIcon iconKey="folder" size={56} />
              <h2>Un espacio para tu aprendizaje</h2>
              <p>
                Añade un bloque o una lección, o crea tu primer nodo personal.
              </p>
              <button
                className={styles.primary}
                onClick={() => setDialog({ mode: "add" })}
              >
                <Plus size={18} />
                Añadir al mapa
              </button>
            </div>
          ) : list ? (
            <div className={styles.list}>
              {level.items.map((item) => (
                <LearningMapItem
                  key={item.occurrenceId}
                  data={{
                    item,
                    iconColor: iconColors[item.occurrenceId],
                    selected: selected.includes(item.occurrenceId),
                    selecting,
                    organizing: false,
                    onOpen: open,
                    onAction: action,
                    onPrefetch: intention,
                  }}
                />
              ))}
            </div>
          ) : (
            <Canvas
              level={level}
              account={account}
              iconColors={iconColors}
              queue={queue}
              onOpen={open}
              onAction={action}
              onPrefetch={intention}
              selecting={selecting}
              selected={selected}
              organizing={organizing}
              phase={phase}
              direction={direction}
              movingId={movingId}
              onMoveFinished={moveFinished}
            />
          )}
          {wide ? panel : null}
        </div>
        <span className={styles.hidden} aria-live="polite">
          {level
            ? `${level.containerSummary.title}, ${level.items.length} contenidos`
            : ""}
        </span>
      </div>
      {!wide && panel ? (
        <MapMobileSheet onClose={closePanel}>{panel}</MapMobileSheet>
      ) : null}
      {dialog ? (
        <MapEditDialog
          key={`${dialog.mode}:${dialog.item?.occurrenceId ?? ""}`}
          mode={dialog.mode}
          initialTab={dialog.initialTab}
          initialTitle={dialog.item?.title}
          targetNodeId={
            dialog.item?.kind === "node" ? dialog.item.occurrenceId : undefined
          }
          onClose={() => setDialog(null)}
          onSubmit={submit}
          onAdd={add}
          onCreateNode={async (title, iconKey) => {
            await mutate("nodes", { title, iconKey });
          }}
          onCompleteBlock={async (pathId) => {
            await mutate("complete-block", { nodeId: level?.route.nodeId, pathId });
          }}
          suggestions={suggestions}
          suggestionError={suggestionError}
        />
      ) : null}
      {colorItem ? (
        <MapIconColorDialog
          item={colorItem}
          color={iconColors[colorItem.occurrenceId] ?? null}
          onChoose={(color) => saveIconColor(colorItem, color)}
          onClose={() => setColorItem(null)}
        />
      ) : null}
    </main>
  );
}
export function LearningMapWorkspace({
  account,
  client,
}: {
  account: string;
  client?: MapClient;
}) {
  return (
    <MapWorkspaceProvider key={account} account={account} client={client}>
      <ReactFlowProvider>
        <Workspace />
      </ReactFlowProvider>
    </MapWorkspaceProvider>
  );
}
