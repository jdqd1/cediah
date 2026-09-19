"use client";

import {
  CaretDown,
  CaretRight,
  Check,
  DotsSixVertical,
  FloppyDisk,
  MagnifyingGlass,
  NotePencil,
  Plus,
  Tag,
  Trash,
  X,
} from "@phosphor-icons/react";
import { type DragEvent, useDeferredValue, useEffect, useMemo, useState } from "react";
import { ContentTopicSchema, type ContentItem, type ContentTopic } from "@cediah/contracts";
import { cleanRegion, normalizeRegion, uniqueRegions } from "@/lib/content-regions";
import { StudioConfirmDialog } from "./studio-confirm-dialog";
import { StudioNameDialog } from "./studio-name-dialog";
import {
  TopicItemManagementProvider,
  TopicItemManager,
  useTopicItemManagement,
} from "./topic-item-manager";
import styles from "./topic-selector.module.css";

const contentUnavailableMessage =
  "No se pudo guardar el tema. Actualiza la página y vuelve a intentarlo.";

const topicErrors: Partial<Record<string, string>> = {
  content_unavailable: contentUnavailableMessage,
  forbidden: "Tu cuenta no tiene permiso para administrar temas.",
  invalid_topic: "El nombre del tema no es válido.",
  not_found: "El tema ya no existe o no está disponible.",
  topic_conflict: "Ya existe un tema con ese nombre o no se pudo guardar con las materias seleccionadas.",
  topic_in_use: "No puedes eliminar este tema porque todavía está asociado a contenido. Quita el tema de ese contenido, guarda los cambios y vuelve a intentarlo.",
};

function OrderingSaveButton({
  disabled,
  onError,
  onSaveTopicOrder,
  topicOrderDirty,
  topicOrderSaving,
}: {
  disabled: boolean;
  onError: (message: string | null) => void;
  onSaveTopicOrder: () => Promise<void>;
  topicOrderDirty: boolean;
  topicOrderSaving: boolean;
}) {
  const management = useTopicItemManagement();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = topicOrderDirty || management.hasPendingOrderChanges;
  const busy = saving || topicOrderSaving || management.orderSaveBusy;

  const showSaved = saved && !dirty;
  if (!dirty && !showSaved) return null;

  return (
    <button
      className={`studio-entity-create-button ${styles.saveOrderButton} ${showSaved ? styles.saveOrderButtonSaved : ""}`}
      disabled={disabled || busy || !dirty}
      type="button"
      onClick={async () => {
        if (!dirty || busy) return;
        setSaving(true);
        setSaved(false);
        onError(null);
        try {
          const results = await Promise.allSettled([
            topicOrderDirty ? onSaveTopicOrder() : Promise.resolve(),
            management.hasPendingOrderChanges
              ? management.savePendingOrders()
              : Promise.resolve(),
          ]);
          const rejection = results.find(
            (result): result is PromiseRejectedResult => result.status === "rejected",
          );
          if (rejection) throw rejection.reason;
          setSaved(true);
          window.setTimeout(() => setSaved(false), 1800);
        } catch (caught) {
          onError(
            caught instanceof Error
              ? caught.message
              : "No se pudo guardar el orden. Intenta nuevamente.",
          );
        } finally {
          setSaving(false);
        }
      }}
    >
      <FloppyDisk aria-hidden="true" size={16} weight={saved ? "fill" : "regular"} />
      {busy ? "Guardando…" : showSaved ? "Orden guardado" : "Guardar orden"}
    </button>
  );
}

export function TopicSelector({
  allowCreate = false,
  disabled = false,
  items = [],
  onChange,
  subjectIds = [],
  subjectSelected,
  suggestions = [],
  values,
}: {
  allowCreate?: boolean;
  disabled?: boolean;
  items?: readonly ContentItem[];
  onChange: (values: string[]) => void;
  subjectIds?: readonly string[];
  subjectSelected: boolean;
  suggestions?: readonly string[];
  values: readonly string[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTopics, setCreatedTopics] = useState<ContentTopic[]>([]);
  const [deletedTopics, setDeletedTopics] = useState<string[]>([]);
  const [renamedTopics, setRenamedTopics] = useState<Record<string, string>>({});
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [topicSearch, setTopicSearch] = useState("");
  const [topicOrder, setTopicOrder] = useState<string[]>([]);
  const [topicOrderDirty, setTopicOrderDirty] = useState(false);
  const [topicOrderSaving, setTopicOrderSaving] = useState(false);
  const [topicOrderError, setTopicOrderError] = useState<string | null>(null);
  const [draggingTopicKey, setDraggingTopicKey] = useState<string | null>(null);
  const [dragOverTopicKey, setDragOverTopicKey] = useState<string | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(() => new Set());
  const deferredTopicSearch = useDeferredValue(topicSearch);
  const topicOrderStorageKey = useMemo(() => {
    const key = [...new Set(subjectIds)].sort().join("|");
    return `cediah:topic-order:${key || "unassigned"}`;
  }, [subjectIds]);
  const options = useMemo(() => {
    const resolveRenamedTopic = (topic: string) => {
      let current = topic;
      const seen = new Set<string>();
      while (true) {
        const key = normalizeRegion(current);
        if (seen.has(key)) return current;
        seen.add(key);
        const renamed = renamedTopics[key];
        if (!renamed) return current;
        current = renamed;
      }
    };

    return uniqueRegions([
      ...suggestions,
      ...createdTopics
        .filter((topic) =>
          subjectIds.length === 0 || subjectIds.every((id) => topic.subjectIds.includes(id)),
        )
        .map((topic) => topic.name),
      ...values,
    ].map(resolveRenamedTopic)).filter(
      (topic) => !deletedTopics.some(
        (deleted) => normalizeRegion(deleted) === normalizeRegion(topic),
      ),
    );
  }, [createdTopics, deletedTopics, renamedTopics, subjectIds, suggestions, values]);

  useEffect(() => {
    let cancelled = false;
    let fallbackOrder: string[] = [];
    try {
      const stored = window.localStorage.getItem(topicOrderStorageKey);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      fallbackOrder = Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : [];
    } catch {
      fallbackOrder = [];
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setTopicOrder(fallbackOrder);
      setTopicOrderDirty(false);
      setTopicOrderError(null);
      setDraggingTopicKey(null);
      setDragOverTopicKey(null);
      setExpandedTopics(new Set());
    });

    const subjectId = subjectIds[0];
    if (subjectId) {
      void fetch(`/api/content-order?subjectId=${encodeURIComponent(subjectId)}`, {
        cache: "no-store",
      })
        .then(async (response) => {
          const body: unknown = await response.json().catch(() => null);
          if (!response.ok || !body || typeof body !== "object" || !("topicOrder" in body)) return null;
          const order = Array.isArray(body.topicOrder)
            ? body.topicOrder.filter((value: unknown): value is string => typeof value === "string")
            : [];
          return order.map(normalizeRegion);
        })
        .then((serverOrder) => {
          if (cancelled || !serverOrder) return;
          if (serverOrder.length > 0) {
            setTopicOrder(serverOrder);
            setTopicOrderDirty(false);
            try {
              window.localStorage.setItem(topicOrderStorageKey, JSON.stringify(serverOrder));
            } catch {
              // Browser storage is only a local fallback; server order remains authoritative.
            }
            return;
          }

          if (fallbackOrder.length > 0) {
            // Keep the previous local arrangement visible, but require an
            // explicit save so the editor can confirm it reached the server.
            setTopicOrder(fallbackOrder);
            setTopicOrderDirty(true);
          }
        })
        .catch(() => undefined);
    }

    return () => {
      cancelled = true;
    };
  }, [subjectIds, topicOrderStorageKey]);

  const orderedOptions = useMemo(() => {
    const order = new Map(topicOrder.map((key, index) => [key, index]));
    const base = new Map(options.map((topic, index) => [normalizeRegion(topic), index]));
    return [...options].sort((left, right) => {
      const leftKey = normalizeRegion(left);
      const rightKey = normalizeRegion(right);
      const leftOrder = order.get(leftKey);
      const rightOrder = order.get(rightKey);
      if (leftOrder !== undefined || rightOrder !== undefined) {
        if (leftOrder === undefined) return 1;
        if (rightOrder === undefined) return -1;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      }
      return (base.get(leftKey) ?? 0) - (base.get(rightKey) ?? 0);
    });
  }, [options, topicOrder]);

  const filteredOptions = useMemo(() => {
    const normalizedSearch = normalizeRegion(deferredTopicSearch);
    if (!normalizedSearch) return orderedOptions;
    const terms = normalizedSearch.split(" ").filter(Boolean);
    return orderedOptions
      .filter((topic) => {
        const normalizedTopic = normalizeRegion(topic);
        return terms.every((term) => normalizedTopic.includes(term));
      })
      .sort((left, right) => {
        const normalizedLeft = normalizeRegion(left);
        const normalizedRight = normalizeRegion(right);
        const leftStarts = normalizedLeft.startsWith(normalizedSearch);
        const rightStarts = normalizedRight.startsWith(normalizedSearch);
        if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
        return left.localeCompare(right, "es");
      });
  }, [deferredTopicSearch, orderedOptions]);
  const cleanInput = cleanRegion(input);
  const cleanRenameInput = cleanRegion(renameInput);
  const existingTopic = options.find(
    (topic) => normalizeRegion(topic) === normalizeRegion(cleanInput),
  );
  const interactive = !disabled && !busy && subjectSelected;
  const canReorderTopics =
    allowCreate && interactive && orderedOptions.length > 1 && !deferredTopicSearch.trim();

  function stageTopicOrder(nextOrder: string[]) {
    const uniqueOrder = [...new Set(nextOrder.filter(Boolean))];
    setTopicOrder(uniqueOrder);
    setTopicOrderDirty(true);
    setTopicOrderError(null);
    try {
      window.localStorage.setItem(topicOrderStorageKey, JSON.stringify(uniqueOrder));
    } catch {
      // The visible order remains staged even when browser storage is unavailable.
    }
  }

  async function saveTopicOrder() {
    if (!topicOrderDirty || topicOrderSaving || subjectIds.length === 0) return;
    const topicByKey = new Map(options.map((topic) => [normalizeRegion(topic), topic]));
    const orderedTopics = topicOrder.flatMap((key) => {
      const topic = topicByKey.get(key);
      return topic ? [topic] : [];
    });
    for (const topic of options) {
      if (!topicOrder.includes(normalizeRegion(topic))) orderedTopics.push(topic);
    }

    setTopicOrderSaving(true);
    setTopicOrderError(null);
    try {
      for (const subjectId of subjectIds) {
        let lastError: Error | null = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const response = await fetch("/api/editor/topic-list-order", {
            body: JSON.stringify({ subjectId, topics: orderedTopics }),
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          });
          const body: unknown = await response.json().catch(() => ({ error: "content_unavailable" }));
          if (response.ok) {
            lastError = null;
            break;
          }
          const code = body && typeof body === "object" && "error" in body && typeof body.error === "string"
            ? body.error
            : "content_unavailable";
          lastError = new Error(topicErrors[code] ?? `No se pudo guardar el orden de los temas (${response.status}).`);
          if (attempt === 0 && (response.status === 502 || response.status === 503)) {
            await new Promise((resolve) => setTimeout(resolve, 700));
            continue;
          }
          break;
        }
        if (lastError) throw lastError;
      }

      const expected = orderedTopics.map(normalizeRegion);
      for (const subjectId of subjectIds) {
        const response = await fetch(
          `/api/content-order?subjectId=${encodeURIComponent(subjectId)}&verify=${Date.now()}`,
          { cache: "no-store" },
        );
        const body: unknown = await response.json().catch(() => null);
        const confirmed = body && typeof body === "object" && "topicOrder" in body && Array.isArray(body.topicOrder)
          ? body.topicOrder.filter((value: unknown): value is string => typeof value === "string").map(normalizeRegion)
          : [];
        if (
          !response.ok ||
          confirmed.length !== expected.length ||
          confirmed.some((topic, index) => topic !== expected[index])
        ) {
          throw new Error("El servidor no confirmó el orden de los temas. Intenta guardar de nuevo.");
        }
      }

      setTopicOrder(orderedTopics.map(normalizeRegion));
      setTopicOrderDirty(false);
      try {
        window.localStorage.setItem(
          topicOrderStorageKey,
          JSON.stringify(orderedTopics.map(normalizeRegion)),
        );
      } catch {
        // Server persistence already succeeded.
      }
    } finally {
      setTopicOrderSaving(false);
    }
  }

  function setTopicExpanded(topic: string, expanded: boolean) {
    const key = normalizeRegion(topic);
    setExpandedTopics((current) => {
      const next = new Set(current);
      if (expanded) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function dropTopicOn(targetTopic: string, event: DragEvent<HTMLDivElement>) {
    const sourceKey =
      draggingTopicKey || event.dataTransfer.getData("application/x-cediah-topic");
    if (!sourceKey) return;
    event.preventDefault();
    event.stopPropagation();
    setDraggingTopicKey(null);
    setDragOverTopicKey(null);
    if (!canReorderTopics) return;

    const targetKey = normalizeRegion(targetTopic);
    if (!targetKey || sourceKey === targetKey) return;
    const keys = orderedOptions.map(normalizeRegion);
    const sourceIndex = keys.indexOf(sourceKey);
    const targetIndex = keys.indexOf(targetKey);
    if (sourceIndex < 0 || targetIndex < 0) return;
    keys.splice(sourceIndex, 1);
    keys.splice(targetIndex, 0, sourceKey);
    stageTopicOrder(keys);
  }

  function closeDialog() {
    if (busy) return;
    setDialogOpen(false);
    setInput("");
    setError(null);
  }

  function closeRenameDialog() {
    if (busy) return;
    setRenameTarget(null);
    setRenameInput("");
    setRenameError(null);
  }

  async function addTopic() {
    if (!allowCreate || !interactive || !cleanInput) return;
    if (existingTopic) {
      onChange(uniqueRegions([...values, existingTopic]));
      closeDialog();
      return;
    }

    if (subjectIds.length === 0) {
      const localTopic = { name: cleanInput, subjectIds: [] } satisfies ContentTopic;
      setCreatedTopics((current) => [
        ...current.filter(
          (topic) => normalizeRegion(topic.name) !== normalizeRegion(localTopic.name),
        ),
        localTopic,
      ]);
      stageTopicOrder([...topicOrder, normalizeRegion(localTopic.name)]);
      onChange(uniqueRegions([...values, localTopic.name]));
      setDialogOpen(false);
      setInput("");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/editor/topics", {
        body: JSON.stringify({ name: cleanInput, subjectIds: [...subjectIds] }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body: unknown = await response
        .json()
        .catch(() => ({ error: "content_unavailable" }));
      if (!response.ok) {
        const code = body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error
          : "content_unavailable";
        throw new Error(topicErrors[code] ?? `No se pudo crear el tema (${response.status}).`);
      }
      const parsed = ContentTopicSchema.safeParse(
        body && typeof body === "object" && "topic" in body ? body.topic : null,
      );
      if (!parsed.success) throw new Error(contentUnavailableMessage);

      setCreatedTopics((current) => [
        ...current.filter(
          (topic) => normalizeRegion(topic.name) !== normalizeRegion(parsed.data.name),
        ),
        parsed.data,
      ]);
      stageTopicOrder([...topicOrder, normalizeRegion(parsed.data.name)]);
      onChange(uniqueRegions([...values, parsed.data.name]));
      setDialogOpen(false);
      setInput("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : contentUnavailableMessage);
    } finally {
      setBusy(false);
    }
  }

  async function renameTopic() {
    if (!allowCreate || !renameTarget || !cleanRenameInput || busy) return;
    if (cleanRenameInput === renameTarget) {
      closeRenameDialog();
      return;
    }

    setBusy(true);
    setRenameError(null);
    try {
      const response = await fetch("/api/editor/topics", {
        body: JSON.stringify({ name: cleanRenameInput, previousName: renameTarget }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const body: unknown = await response
        .json()
        .catch(() => ({ error: "content_unavailable" }));
      if (!response.ok) {
        const code = body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error
          : "content_unavailable";
        throw new Error(topicErrors[code] ?? `No se pudo renombrar el tema (${response.status}).`);
      }
      const parsed = ContentTopicSchema.safeParse(
        body && typeof body === "object" && "topic" in body ? body.topic : null,
      );
      if (!parsed.success) throw new Error(contentUnavailableMessage);

      const previousKey = normalizeRegion(renameTarget);
      const nextKey = normalizeRegion(parsed.data.name);
      stageTopicOrder(topicOrder.map((key) => key === previousKey ? nextKey : key));
      setExpandedTopics((current) => {
        if (!current.has(previousKey)) return current;
        const next = new Set(current);
        next.delete(previousKey);
        next.add(nextKey);
        return next;
      });
      setCreatedTopics((current) => [
        ...current.filter((topic) =>
          normalizeRegion(topic.name) !== previousKey &&
          normalizeRegion(topic.name) !== normalizeRegion(parsed.data.name),
        ),
        parsed.data,
      ]);
      setRenamedTopics((current) => {
        const next = { ...current };
        for (const [key, value] of Object.entries(next)) {
          if (normalizeRegion(value) === previousKey) next[key] = parsed.data.name;
        }
        next[previousKey] = parsed.data.name;
        return next;
      });
      setDeletedTopics((current) => current.filter(
        (topic) => normalizeRegion(topic) !== normalizeRegion(parsed.data.name),
      ));
      onChange(uniqueRegions(values.map((value) =>
        normalizeRegion(value) === previousKey ? parsed.data.name : value,
      )));
      setRenameTarget(null);
      setRenameInput("");
      setRenameError(null);
    } catch (caught) {
      setRenameError(caught instanceof Error ? caught.message : contentUnavailableMessage);
    } finally {
      setBusy(false);
    }
  }

  async function deleteTopic() {
    if (!allowCreate || !deleteTarget || busy) return;
    setBusy(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/editor/topics", {
        body: JSON.stringify({ name: deleteTarget }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });
      const body: unknown = await response
        .json()
        .catch(() => ({ error: "content_unavailable" }));
      if (!response.ok) {
        const code = body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error
          : "content_unavailable";
        throw new Error(topicErrors[code] ?? `No se pudo eliminar el tema (${response.status}).`);
      }
      const parsed = ContentTopicSchema.safeParse(
        body && typeof body === "object" && "topic" in body ? body.topic : null,
      );
      if (!parsed.success) throw new Error(contentUnavailableMessage);

      const deletedKey = normalizeRegion(deleteTarget);
      stageTopicOrder(topicOrder.filter((key) => key !== deletedKey));
      setExpandedTopics((current) => {
        if (!current.has(deletedKey)) return current;
        const next = new Set(current);
        next.delete(deletedKey);
        return next;
      });
      setCreatedTopics((current) => current.filter(
        (topic) => normalizeRegion(topic.name) !== deletedKey,
      ));
      setDeletedTopics((current) => uniqueRegions([...current, parsed.data.name]));
      onChange(values.filter(
        (value) => normalizeRegion(value) !== normalizeRegion(deleteTarget),
      ));
      setDeleteTarget(null);
      setDeleteError(null);
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : contentUnavailableMessage);
    } finally {
      setBusy(false);
    }
  }

  function toggleTopic(topic: string) {
    const selected = values.some(
      (value) => normalizeRegion(value) === normalizeRegion(topic),
    );
    onChange(selected
      ? values.filter((value) => normalizeRegion(value) !== normalizeRegion(topic))
      : uniqueRegions([...values, topic]));
  }

  return (
    <TopicItemManagementProvider
      enabled={allowCreate && subjectSelected}
      items={items}
      subjectIds={subjectIds}
      topics={options}
    >
      <div className="topic-selector-field studio-field-wide">
        <span className="topic-selector-label">Tema (opcional)</span>
        <div className="topic-selector-controls">
          {subjectSelected && options.length > 3 && (
            <div className={styles.topicSearch} role="search">
              <MagnifyingGlass aria-hidden="true" size={17} />
              <input
                aria-label="Buscar tema"
                autoComplete="off"
                placeholder="Buscar tema…"
                type="search"
                value={topicSearch}
                onChange={(event) => setTopicSearch(event.target.value)}
              />
              {topicSearch && (
                <button
                  aria-label="Limpiar búsqueda de temas"
                  title="Limpiar búsqueda"
                  type="button"
                  onClick={() => setTopicSearch("")}
                >
                  <X aria-hidden="true" size={15} />
                </button>
              )}
              {deferredTopicSearch.trim() && (
                <span aria-live="polite">{filteredOptions.length}/{options.length}</span>
              )}
            </div>
          )}
          <div
            aria-label="Seleccionar tema opcional"
            aria-disabled={!interactive}
            className="topic-selector-options"
            role="group"
          >
            {subjectSelected && filteredOptions.length > 0 ? filteredOptions.map((topic) => {
              const topicKey = normalizeRegion(topic);
              const selected = values.some(
                (value) => normalizeRegion(value) === topicKey,
              );
              const expanded = expandedTopics.has(topicKey);
              return (
                <div
                  className={`${styles.topicBlock} ${draggingTopicKey === topicKey ? styles.topicDragging : ""} ${dragOverTopicKey === topicKey && draggingTopicKey !== topicKey ? styles.topicDropTarget : ""}`}
                  key={topicKey}
                  onDragEnter={() => {
                    if (canReorderTopics && draggingTopicKey !== topicKey) setDragOverTopicKey(topicKey);
                  }}
                  onDragOver={(event) => {
                    if (!canReorderTopics ||
                      !Array.from(event.dataTransfer.types).includes("application/x-cediah-topic")) {
                      return;
                    }
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    if (draggingTopicKey !== topicKey) setDragOverTopicKey(topicKey);
                  }}
                  onDrop={(event) => dropTopicOn(topic, event)}
                >
                  <div className={styles.topicRow} data-topic-drag-preview="true">
                    <button
                      aria-pressed={selected}
                      className={`${styles.topicToggle} ${selected ? styles.topicToggleSelected : ""}`}
                      disabled={!interactive}
                      type="button"
                      onClick={() => toggleTopic(topic)}
                    >
                      <span className={styles.topicCheck} aria-hidden="true">
                        {selected && <Check size={14} weight="bold" />}
                      </span>
                      <Tag aria-hidden="true" size={16} />
                      <span>{topic}</span>
                    </button>
                    {allowCreate && (
                      <div className={styles.topicActions}>
                        <button
                          aria-label={`Mover tema ${topic}`}
                          className={styles.topicDragHandle}
                          disabled={!canReorderTopics}
                          draggable={canReorderTopics}
                          title={canReorderTopics
                            ? "Arrastra para cambiar el orden de los temas"
                            : deferredTopicSearch.trim()
                              ? "Limpia la búsqueda para reordenar temas"
                              : "Se necesitan al menos dos temas para reordenar"}
                          type="button"
                          onDragEnd={() => {
                            setDraggingTopicKey(null);
                            setDragOverTopicKey(null);
                          }}
                          onDragStart={(event) => {
                            if (!canReorderTopics) {
                              event.preventDefault();
                              return;
                            }
                            const preview = event.currentTarget.closest<HTMLElement>("[data-topic-drag-preview='true']");
                            if (preview) {
                              preview.classList.add(styles.dragPreviewLift);
                              event.dataTransfer.setDragImage(preview, 28, 24);
                              requestAnimationFrame(() => preview.classList.remove(styles.dragPreviewLift));
                            }
                            setDraggingTopicKey(topicKey);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("application/x-cediah-topic", topicKey);
                          }}
                        >
                          <DotsSixVertical aria-hidden="true" size={18} weight="bold" />
                        </button>
                        <button
                          aria-expanded={expanded}
                          aria-label={expanded ? `Colapsar tema ${topic}` : `Expandir tema ${topic}`}
                          className={styles.topicAction}
                          disabled={!interactive}
                          title={expanded ? "Colapsar tema" : "Expandir tema"}
                          type="button"
                          onClick={() => setTopicExpanded(topic, !expanded)}
                        >
                          {expanded
                            ? <CaretDown aria-hidden="true" size={16} />
                            : <CaretRight aria-hidden="true" size={16} />}
                        </button>
                        <button
                          aria-label={`Editar nombre del tema ${topic}`}
                          className={styles.topicAction}
                          disabled={!interactive}
                          title="Editar nombre"
                          type="button"
                          onClick={() => {
                            setRenameError(null);
                            setRenameTarget(topic);
                            setRenameInput(topic);
                          }}
                        >
                          <NotePencil aria-hidden="true" size={16} />
                        </button>
                        <button
                          aria-label={`Eliminar tema ${topic}`}
                          className={`${styles.topicAction} ${styles.topicActionDanger}`}
                          disabled={!interactive}
                          title="Eliminar tema"
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(topic);
                          }}
                        >
                          <Trash aria-hidden="true" size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  {allowCreate && expanded && (
                    <TopicItemManager disabled={!interactive} topic={topic} />
                  )}
                </div>
              );
            }) : (
              <p>
                {subjectSelected
                  ? options.length > 0 && deferredTopicSearch.trim()
                    ? "No hay temas que coincidan con la búsqueda."
                    : allowCreate
                      ? "El tema es opcional. Puedes publicar directamente en la materia o añadir uno para organizar el contenido."
                      : "Esta materia no tiene temas. El contenido puede publicarse directamente en ella."
                  : "Selecciona primero una materia."}
              </p>
            )}
          </div>
          {topicOrderError && (
            <p className={styles.topicOrderError} role="alert">{topicOrderError}</p>
          )}
          {allowCreate && (
            <div className={styles.topicFooterActions}>
              <button
                className={`studio-entity-create-button studio-entity-create-button-primary ${styles.addTopicButton}`}
                disabled={!interactive}
                type="button"
                onClick={() => {
                  setError(null);
                  setDialogOpen(true);
                }}
              >
                <Plus aria-hidden="true" size={16} />
                Añadir tema
              </button>
              <OrderingSaveButton
                disabled={!interactive}
                topicOrderDirty={topicOrderDirty}
                topicOrderSaving={topicOrderSaving}
                onError={setTopicOrderError}
                onSaveTopicOrder={saveTopicOrder}
              />
            </div>
          )}
        </div>

        {allowCreate && (
          <StudioNameDialog
            busy={busy}
            description="El tema quedará disponible dentro de las materias seleccionadas y se sumará a tu selección actual."
            icon={<Tag size={21} />}
            inputLabel="Nombre del tema"
            maxLength={120}
            open={dialogOpen}
            placeholder="Ej. Abdomen"
            submitLabel={existingTopic ? "Seleccionar tema" : "Crear tema"}
            title="Añadir tema"
            value={input}
            onChange={(value) => {
              setInput(value);
              setError(null);
            }}
            onClose={closeDialog}
            onSubmit={addTopic}
          >
            {error && <p role="alert">{error}</p>}
          </StudioNameDialog>
        )}

        {allowCreate && (
          <StudioNameDialog
            busy={busy}
            description={renameTarget
              ? `Cambia el nombre de “${renameTarget}”. El nuevo nombre se aplicará también al contenido que ya usa este tema.`
              : "Cambia el nombre del tema."}
            icon={<NotePencil size={21} />}
            inputLabel="Nombre del tema"
            maxLength={120}
            open={renameTarget !== null}
            placeholder="Ej. Abdomen"
            submitLabel="Guardar nombre"
            title="Editar nombre del tema"
            value={renameInput}
            onChange={(value) => {
              setRenameInput(value);
              setRenameError(null);
            }}
            onClose={closeRenameDialog}
            onSubmit={renameTopic}
          >
            {renameError && <p role="alert">{renameError}</p>}
          </StudioNameDialog>
        )}

        <StudioConfirmDialog
          busy={busy}
          busyLabel="Eliminando…"
          confirmLabel="Eliminar tema"
          description={deleteTarget
            ? `Se eliminará “${deleteTarget}” de la lista de temas. Si todavía está asociado a cualquier contenido, la eliminación se bloqueará hasta que retires ese tema del contenido.`
            : "Selecciona el tema que deseas eliminar."}
          error={deleteError}
          icon={<Trash size={21} />}
          open={deleteTarget !== null}
          title="Eliminar tema"
          onClose={() => {
            if (busy) return;
            setDeleteTarget(null);
            setDeleteError(null);
          }}
          onConfirm={deleteTopic}
        />
      </div>
    </TopicItemManagementProvider>
  );
}
