"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X, Plus } from "@phosphor-icons/react";
import {
  MapIconKeySchema,
  type MapCatalogItem,
  type MapIconKey,
} from "@cediah/contracts";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useMapWorkspace } from "./map-provider";
import { mapQuery } from "./map-client";
import styles from "./learning-map.module.css";
export function MapEditDialog({
  mode,
  initialTitle = "",
  onClose,
  onSubmit,
  onAdd,
  targetNodeId,
}: {
  mode: "add" | "create" | "rename" | "group" | "remove";
  initialTitle?: string;
  targetNodeId?: string;
  onClose: () => void;
  onSubmit: (title: string, icon: MapIconKey) => Promise<void>;
  onAdd: (item: MapCatalogItem) => Promise<void>;
}) {
  const { client, level } = useMapWorkspace();
  const ref = useDialogFocus();
  useBodyScrollLock(true);
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initialTitle),
    [icon, setIcon] = useState<MapIconKey>("folder"),
    [query, setQuery] = useState(""),
    [kind, setKind] = useState("all");
  const [items, setItems] = useState<MapCatalogItem[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useLayoutEffect(() => {
    const launcher =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const bg = document.querySelector<HTMLElement>("[data-map-background]");
    if (bg) bg.inert = true;
    return () => {
      if (bg) bg.inert = false;
      requestAnimationFrame(() => {
        if (launcher?.isConnected) launcher.focus({ preventScroll: true });
      });
    };
  }, []);
  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    if (mode !== "add" || !level) return;
    const c = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      const q = new URLSearchParams(
        mapQuery(
          targetNodeId
            ? { nodeId: targetNodeId, entryId: null, unitStableKey: null }
            : level.route,
        ),
      );
      q.set("q", query);
      q.set("kind", kind);
      void client
        .catalog(q, c.signal)
        .then((r) => {
          setItems(r.items);
          setCursor(r.nextCursor);
        })
        .catch((e) => {
          if (!c.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!c.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [client, level, query, kind, mode, targetNodeId]);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await onSubmit(title.trim(), icon);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar.");
    } finally {
      setBusy(false);
    }
  }
  async function add(item: MapCatalogItem) {
    setBusy(true);
    setError("");
    try {
      await onAdd(item);
      setItems((current) =>
        current.map((i) =>
          i.key === item.key ? { ...i, membership: "direct" } : i,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos añadir.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.overlay}>
      <section
        ref={ref}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={
          {
            add: "Agregar contenido",
            create: "Crear nodo",
            rename: "Renombrar nodo",
            group: "Agrupar selección",
            remove: "Quitar del mapa",
          }[mode]
        }
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onClose();
        }}
      >
        <header>
          <h2>
            {
              {
                add: "Agregar contenido",
                create: "Nuevo nodo",
                rename: "Renombrar nodo",
                group: "Crear nodo con selección",
                remove: "Quitar del mapa",
              }[mode]
            }
          </h2>
          <button
            className={styles.iconButton}
            aria-label="Cerrar diálogo"
            onClick={onClose}
            disabled={busy}
          >
            <X size={18} />
          </button>
        </header>
        {mode === "add" ? (
          <>
            <label>
              Buscar bloques o lecciones
              <input
                ref={input}
                value={query}
                maxLength={120}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="¿Qué quieres aprender?"
              />
            </label>
            <div className={styles.tabs}>
              {[
                ["all", "Todo"],
                ["block", "Bloques"],
                ["lesson", "Lecciones"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={kind === value}
                  onClick={() => setKind(value!)}
                >
                  {label}
                </button>
              ))}
            </div>
            {loading ? (
              <p role="status">Buscando…</p>
            ) : !items.length ? (
              <p>No hay contenidos para esta búsqueda.</p>
            ) : null}
            {items.map((item) => (
              <div className={styles.suggestion} key={item.key}>
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {item.kind === "block"
                      ? "Bloque"
                      : item.kind === "lesson"
                        ? "Lección"
                        : "Tema"}{" "}
                    · {item.topicTitle}
                  </small>
                  {item.membership !== "absent" ? (
                    <small>
                      {item.membership === "direct"
                        ? "Ya añadido"
                        : "Incluido en un bloque de este nodo"}
                    </small>
                  ) : null}
                </div>
                <button
                  className={styles.iconButton}
                  aria-label={`Añadir ${item.title}`}
                  disabled={busy || item.membership !== "absent"}
                  onClick={() => void add(item)}
                >
                  <Plus size={18} />
                </button>
              </div>
            ))}
            {cursor ? (
              <button
                className={styles.button}
                disabled={loading}
                onClick={() => {
                  const q = new URLSearchParams(
                    mapQuery(
                      targetNodeId
                        ? {
                            nodeId: targetNodeId,
                            entryId: null,
                            unitStableKey: null,
                          }
                        : level!.route,
                    ),
                  );
                  q.set("q", query);
                  q.set("kind", kind);
                  q.set("cursor", cursor);
                  setLoading(true);
                  void client
                    .catalog(q)
                    .then((r) => {
                      setItems((old) => [...old, ...r.items]);
                      setCursor(r.nextCursor);
                    })
                    .catch((e) => setError(e.message))
                    .finally(() => setLoading(false));
                }}
              >
                Cargar más
              </button>
            ) : null}
          </>
        ) : mode === "remove" ? (
          <p>
            Se quitará «{initialTitle}» de tu organización personal. Tus
            inscripciones y tu progreso se conservan. Puedes deshacer durante 30
            segundos.
          </p>
        ) : (
          <>
            <label>
              Nombre del nodo
              <input
                ref={input}
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            {mode !== "rename" ? (
              <label>
                Icono
                <select
                  value={icon}
                  onChange={(e) => setIcon(e.target.value as MapIconKey)}
                >
                  {MapIconKeySchema.options.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </>
        )}
        <p role="status">{busy ? "Guardando…" : error}</p>
        {mode !== "add" ? (
          <footer>
            <button className={styles.button} onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button
              className={styles.primary}
              onClick={() => void submit()}
              disabled={busy || (mode !== "remove" && !title.trim())}
            >
              {busy ? "Guardando…" : mode === "remove" ? "Quitar" : "Guardar"}
            </button>
          </footer>
        ) : null}
      </section>
    </div>
  );
}
