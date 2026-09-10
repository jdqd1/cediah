"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  CaretRight,
  Plus,
  List,
  MapTrifold,
  X,
  ArrowsOutCardinal,
} from "@phosphor-icons/react";
import type {
  MapItem,
  MapRoute,
  MapCatalogItem,
  MapIconKey,
  LearningMapSuggestionsResponse,
  LearningMapMutationResponse,
} from "@cediah/contracts";
import { MapWorkspaceProvider, useMapWorkspace } from "./map-provider";
import type { MapClient } from "./map-client";
import { buildMapHref, ROOT_MAP_ROUTE } from "./map-route";
import { LearningMapItem, type MapItemAction } from "./nodes/learning-map-item";
import { MedicalMapIcon } from "./medical-map-icon";
import { LessonDetailPanel } from "./lesson-detail-panel";
import { MapMobileSheet } from "./map-mobile-sheet";
import { MapEditDialog } from "./add-content-dialog";
import styles from "./learning-map.module.css";
const Canvas = dynamic(() => import("./learning-map-canvas"), {
  ssr: false,
  loading: () => <p className={styles.empty}>Preparando mapa…</p>,
});
type Dialog = {
  mode: "add" | "create" | "rename" | "group" | "remove";
  item?: MapItem;
};

function Workspace() {
  const {
    account,
    client,
    level,
    loading,
    error,
    phase,
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
    [showSuggestions, setShowSuggestions] = useState(false),
    [list, setList] = useState(false),
    [organizing, setOrganizing] = useState(false),
    [organizeToken, setOrganizeToken] = useState(0),
    [movingId, setMovingId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false),
    [selection, setSelection] = useState<string[]>([]),
    [dialog, setDialog] = useState<Dialog | null>(null),
    [info, setInfo] = useState<MapItem | "container" | null>(null);
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
      setWide(entries[0]!.contentRect.width >= 1180);
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
      setShowSuggestions(false);
      navigate(routeFor(item));
    },
    [navigate, routeFor, selecting],
  );
  const action = useCallback((item: MapItem, action: MapItemAction) => {
    if (action === "move") {
      setList(false);
      setOrganizing(true);
      setMovingId(item.occurrenceId);
      return;
    }
    if (action === "info") {
      setInfo(item);
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
  const moveFinished = useCallback(() => setMovingId(null), []);
  const closePanel = useCallback(() => {
    setInfo(null);
    setShowSuggestions(false);
    if (level?.selectedLesson) back();
    else if (detail && level)
      window.history.replaceState(null, "", buildMapHref(level.route));
  }, [back, detail, level]);
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
  const panel = unavailableSelection ? (
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
  ) : wide || showSuggestions ? (
    <aside className={styles.panel} aria-label="Sugerencias">
      <header className={styles.panelHeader}>
        <div>
          <h2>Tu próximo descubrimiento</h2>
          <p>Contenido relacionado con tu mapa.</p>
        </div>
        {!wide ? (
          <button
            className={styles.iconButton}
            aria-label="Cerrar sugerencias"
            onClick={closePanel}
          >
            <X size={18} />
          </button>
        ) : null}
      </header>
      <div className={styles.panelScroll}>
        {suggestionError ? (
          <p>
            No pudimos cargar las sugerencias.{" "}
            <button className={styles.button} onClick={() => void refresh()}>
              Reintentar
            </button>
          </p>
        ) : suggestions?.items.length ? (
          suggestions.items.map((item) => (
            <div className={styles.suggestion} key={item.key}>
              <div>
                <strong>{item.title}</strong>
                <small>{item.reason}</small>
              </div>
              <button
                className={styles.iconButton}
                aria-label={`Añadir ${item.title}`}
                disabled={busy}
                onClick={() =>
                  void add(item).catch((e) => setMessage(e.message))
                }
              >
                <Plus size={18} />
              </button>
            </div>
          ))
        ) : (
          <p>Añade contenido desde el buscador para construir tu mapa.</p>
        )}
        {suggestions?.incompleteBlocks.map((block) => (
          <div className={styles.suggestion} key={block.pathId}>
            <div>
              <strong>{block.title}</strong>
              <small>
                Añadiste {block.addedLessons} de {block.totalLessons} lecciones.
                Completar el bloque añade las restantes y las agrupa.
              </small>
              <button
                className={styles.button}
                disabled={busy}
                onClick={() =>
                  void mutate("complete-block", {
                    nodeId: level?.route.nodeId,
                    pathId: block.pathId,
                  }).catch((e) => setMessage(e.message))
                }
              >
                Completar bloque
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  ) : null;
  return (
    <div className={styles.workspace} ref={root}>
      <div
        data-map-background
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
        }}
      >
        <div className={styles.toolbar}>
          <nav className={styles.breadcrumbs} aria-label="Ruta del mapa">
            {level?.route.nodeId ? (
              <button
                className={styles.iconButton}
                aria-label="Atrás en el mapa"
                onClick={() => {
                  setInfo(null);
                  back();
                }}
              >
                <ArrowLeft size={18} />
              </button>
            ) : null}
            {(
              level?.ancestry ?? [{ title: "Mi mapa", route: ROOT_MAP_ROUTE }]
            ).map((a, i) => (
              <span key={i}>
                <button
                  className={styles.button}
                  onClick={() => {
                    setInfo(null);
                    navigate(a.route);
                  }}
                >
                  {a.title}
                </button>
                {i < (level?.ancestry.length ?? 1) - 1 ? (
                  <CaretRight size={14} />
                ) : null}
              </span>
            ))}
          </nav>
          <Link className={styles.button} href="/aprendizaje?tab=hoy">
            Hoy
          </Link>
          <Link className={styles.button} href="/aprendizaje?tab=rutas">
            Rutas
          </Link>
          <Link className={styles.button} href="/aprendizaje?tab=progreso">
            Progreso
          </Link>
          <button
            className={styles.primary}
            aria-label="Agregar contenido"
            onClick={() => setDialog({ mode: "add" })}
            disabled={!level}
          >
            <Plus size={18} />
            Agregar contenido
          </button>
        </div>
        <header className={styles.header}>
          <span className={styles.iconWell}>
            <MedicalMapIcon iconKey="folder" size={48} />
          </span>
          <div className={styles.headerText}>
            <h1 ref={heading} tabIndex={-1}>
              {level?.containerSummary.title ?? "Mi mapa de aprendizaje"}
            </h1>
            <p>
              {level?.containerSummary.description ??
                "Tu espacio para conectar y organizar el aprendizaje."}
            </p>
            {level ? (
              <span className={styles.status}>
                {level.containerSummary.progress.percentage === null
                  ? "Sin avance disponible"
                  : `${level.containerSummary.progress.percentage} % · ${level.containerSummary.progress.completedEssentialSteps}/${level.containerSummary.progress.totalEssentialSteps} esenciales`}
              </span>
            ) : null}
          </div>
          <button
            className={styles.iconButton}
            aria-label={list ? "Vista de mapa" : "Vista de lista"}
            onClick={() => setList(!list)}
          >
            {list ? <MapTrifold size={20} /> : <List size={20} />}
          </button>
          <button
            className={styles.button}
            onClick={() => setInfo("container")}
          >
            Información
          </button>
        </header>
        <div className={styles.toolbar}>
          {!wide ? (
            <button
              className={styles.button}
              onClick={() => {
                setInfo(null);
                setShowSuggestions(true);
              }}
            >
              Sugerencias
            </button>
          ) : null}
          <button
            className={styles.button}
            onClick={() => setDialog({ mode: "create" })}
            disabled={!level}
          >
            Nuevo nodo
          </button>
          <button
            className={styles.button}
            aria-pressed={selecting}
            onClick={() => {
              setSelecting(!selecting);
              setSelection([]);
            }}
          >
            {selecting ? "Terminar selección" : "Seleccionar contenidos"}
          </button>
          {selecting ? (
            <button
              className={styles.primary}
              disabled={!selection.length}
              onClick={() => setDialog({ mode: "group" })}
            >
              Crear nodo ({selection.length})
            </button>
          ) : (
            <>
              <button
                className={styles.button}
                aria-pressed={organizing}
                onClick={() => setOrganizing(!organizing)}
              >
                <ArrowsOutCardinal size={18} />
                {organizing ? "Terminar organización" : "Organizar"}
              </button>
              {organizing && !list ? (
                <button
                  className={styles.button}
                  onClick={() => setOrganizeToken((n) => n + 1)}
                >
                  Ordenar este nivel
                </button>
              ) : null}
            </>
          )}
          <span className={styles.status} role="status">
            {loading
              ? "Abriendo…"
              : queue.state === "saving"
                ? "Guardando posiciones…"
                : queue.state === "saved"
                  ? "Posiciones guardadas"
                  : "Posiciones pendientes"}
          </span>
        </div>
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
                Agregar contenido
              </button>
            </div>
          ) : list ? (
            <div className={styles.list}>
              {level.items.map((item) => (
                <LearningMapItem
                  key={item.occurrenceId}
                  data={{
                    item,
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
              queue={queue}
              onOpen={open}
              onAction={action}
              onPrefetch={intention}
              selecting={selecting}
              selected={selected}
              organizing={organizing}
              phase={phase}
              organizeToken={organizeToken}
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
          initialTitle={dialog.item?.title}
          targetNodeId={
            dialog.item?.kind === "node" ? dialog.item.occurrenceId : undefined
          }
          onClose={() => setDialog(null)}
          onSubmit={submit}
          onAdd={add}
        />
      ) : null}
    </div>
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
