"use client";

import {
  DotsSixVertical,
  NotePencil,
  Trash,
} from "@phosphor-icons/react";
import {
  ContentItemSchema,
  normalizeContentLearningIdentity,
  type ContentDraft,
  type ContentItem,
} from "@cediah/contracts";
import {
  createContext,
  type DragEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { z } from "zod";
import { applyContentIdOrder } from "@/lib/content-order";
import { normalizeRegion, uniqueRegions } from "@/lib/content-regions";
import { StudioConfirmDialog } from "./studio-confirm-dialog";
import { StudioNameDialog } from "./studio-name-dialog";
import styles from "./topic-item-manager.module.css";

const orderResponseSchema = z.object({
  topicOrder: z.array(z.string().trim().min(1).max(120)).default([]),
  topics: z.array(z.object({
    contentIds: z.array(z.string().uuid()),
    topic: z.string().trim().min(1).max(120),
  })),
});

type TopicItemSummary = {
  id: string;
  kind: "guide" | "video";
  status: ContentItem["status"];
  subjectIds: string[];
  title: string;
  topics: string[];
};

const mutationErrors: Partial<Record<string, string>> = {
  content_conflict: "El contenido cambió mientras intentabas editarlo. Actualiza la página y vuelve a intentarlo.",
  content_unavailable: "No se pudo actualizar el contenido. Comprueba la conexión y vuelve a intentarlo.",
  forbidden: "Tu cuenta no tiene permiso para realizar esta acción.",
  invalid_content: "El nombre no es válido o el contenido ya no cumple los requisitos del editor.",
  invalid_topic_order: "No se pudo guardar el nuevo orden.",
  not_found: "El elemento ya no existe o dejó de estar disponible.",
  topic_order_conflict: "El orden cambió o uno de los elementos ya no pertenece a este tema.",
};

const statusLabels: Record<ContentItem["status"], string> = {
  approved: "Aprobado",
  archived: "Archivado",
  changes_requested: "Cambios solicitados",
  draft: "Borrador",
  in_review: "En revisión",
  published: "Publicado",
};

function contentItemDraft(item: ContentItem): ContentDraft {
  const draft = structuredClone(item) as unknown as Record<string, unknown>;
  for (const key of [
    "asset",
    "authorUserId",
    "createdAt",
    "id",
    "publishedAt",
    "status",
    "updatedAt",
    "viewCount",
  ]) {
    delete draft[key];
  }
  return normalizeContentLearningIdentity(
    draft as ContentDraft,
    () => crypto.randomUUID(),
  ).value;
}

function contentItemTopics(item: ContentItem) {
  return uniqueRegions(
    item.content.regions.length > 0
      ? item.content.regions
      : item.topic ? [item.topic] : [],
  );
}

function toTopicItemSummary(item: ContentItem): TopicItemSummary | null {
  if (item.kind !== "guide" && item.kind !== "video") return null;
  return {
    id: item.id,
    kind: item.kind,
    status: item.status,
    subjectIds: item.subjectIds,
    title: item.title,
    topics: contentItemTopics(item),
  };
}

function errorMessage(body: unknown, fallback: string) {
  const code = body && typeof body === "object" && "error" in body && typeof body.error === "string"
    ? body.error
    : "content_unavailable";
  return mutationErrors[code] ?? fallback;
}

function itemOrderStorageKey(subjectId: string, topicKey: string) {
  return `cediah:content-order:${subjectId}:${topicKey}`;
}

function readStoredItemOrder(subjectId: string, topicKey: string) {
  try {
    const stored = window.localStorage.getItem(itemOrderStorageKey(subjectId, topicKey));
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function writeStoredItemOrder(subjectId: string, topicKey: string, contentIds: readonly string[]) {
  try {
    window.localStorage.setItem(
      itemOrderStorageKey(subjectId, topicKey),
      JSON.stringify([...contentIds]),
    );
  } catch {
    // Server persistence remains authoritative; storage only keeps the editor stable offline.
  }
}

type OrdersBySubject = Record<string, Record<string, string[]>>;

type TopicItemManagementContextValue = {
  configuredSubjectIds: readonly string[];
  deleteItem: () => Promise<void>;
  deleteTarget: TopicItemSummary | null;
  deleteError: string | null;
  draggingItemId: string | null;
  enabled: boolean;
  items: TopicItemSummary[];
  localOrders: Record<string, string[]>;
  mutationBusyId: string | null;
  openDelete: (item: TopicItemSummary) => void;
  openRename: (item: TopicItemSummary) => void;
  hasPendingOrderChanges: boolean;
  orderSaveBusy: boolean;
  ordersBySubject: OrdersBySubject;
  savePendingOrders: () => Promise<void>;
  stageOrder: (topic: string, orderedIds: string[], topicItems: TopicItemSummary[]) => void;
  renameError: string | null;
  renameInput: string;
  renameItem: () => Promise<void>;
  renameTarget: TopicItemSummary | null;
  setDeleteTarget: (item: TopicItemSummary | null) => void;
  setDraggingItemId: (id: string | null) => void;
  setRenameInput: (value: string) => void;
  setRenameTarget: (item: TopicItemSummary | null) => void;
};

const TopicItemManagementContext = createContext<TopicItemManagementContextValue | null>(null);

export function TopicItemManagementProvider({
  children,
  enabled,
  items = [],
  subjectIds = [],
  topics = [],
}: {
  children: ReactNode;
  enabled: boolean;
  items?: readonly ContentItem[];
  subjectIds?: readonly string[];
  topics?: readonly string[];
}) {
  const configuredSubjectKey = [...new Set(subjectIds)].sort().join("|");
  const configuredSubjectIds = useMemo(
    () => configuredSubjectKey ? configuredSubjectKey.split("|") : [],
    [configuredSubjectKey],
  );
  const requestedTopicKey = uniqueRegions(topics)
    .map(normalizeRegion)
    .sort()
    .join("|");
  const requestedTopicKeys = useMemo(
    () => new Set(requestedTopicKey ? requestedTopicKey.split("|") : []),
    [requestedTopicKey],
  );
  const baseItems = useMemo(
    () => items.flatMap((item) => {
      const summary = toTopicItemSummary(item);
      return summary ? [summary] : [];
    }),
    [items],
  );
  const [itemOverrides, setItemOverrides] = useState<Record<string, TopicItemSummary | null>>({});
  const managedItems = useMemo(
    () => baseItems.flatMap((item) => {
      if (!(item.id in itemOverrides)) return [item];
      const override = itemOverrides[item.id];
      return override ? [override] : [];
    }),
    [baseItems, itemOverrides],
  );
  const [ordersBySubject, setOrdersBySubject] = useState<OrdersBySubject>({});
  const [localOrders, setLocalOrders] = useState<Record<string, string[]>>({});
  const [dirtyTopicKeys, setDirtyTopicKeys] = useState<Set<string>>(() => new Set());
  const [orderSaveBusy, setOrderSaveBusy] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<TopicItemSummary | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TopicItemSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [mutationBusyId, setMutationBusyId] = useState<string | null>(null);

  const orderSubjectKey = useMemo(() => {
    if (configuredSubjectIds.length > 0) return configuredSubjectIds.join("|");
    const inferred = new Set<string>();
    for (const item of baseItems) {
      if (!item.topics.some((topic) => requestedTopicKeys.has(normalizeRegion(topic)))) continue;
      item.subjectIds.forEach((subjectId) => inferred.add(subjectId));
    }
    return [...inferred].sort().join("|");
  }, [baseItems, configuredSubjectIds, requestedTopicKeys]);

  useEffect(() => {
    if (!enabled || !orderSubjectKey) return;
    let cancelled = false;
    const orderSubjectIds = orderSubjectKey.split("|");

    void Promise.all(orderSubjectIds.map(async (subjectId) => {
      const response = await fetch(
        `/api/content-order?subjectId=${encodeURIComponent(subjectId)}`,
        { cache: "no-store" },
      );
      const body: unknown = await response.json().catch(() => ({ topics: [] }));
      const parsed = orderResponseSchema.safeParse(body);
      return {
        subjectId,
        topics: response.ok && parsed.success ? parsed.data.topics : [],
      };
    })).then((results) => {
      if (cancelled) return;
      const nextOrders: OrdersBySubject = {};
      const fallbackDirtyKeys = new Set<string>();
      for (const result of results) {
        const subjectOrders = Object.fromEntries(
          result.topics.map((topic) => [normalizeRegion(topic.topic), topic.contentIds]),
        ) as Record<string, string[]>;
        for (const topicKey of requestedTopicKeys) {
          const serverOrder = subjectOrders[topicKey] ?? [];
          if (serverOrder.length > 0) {
            writeStoredItemOrder(result.subjectId, topicKey, serverOrder);
            continue;
          }
          const storedOrder = readStoredItemOrder(result.subjectId, topicKey);
          if (storedOrder.length > 0) {
            subjectOrders[topicKey] = storedOrder;
            setLocalOrders((current) => ({ ...current, [topicKey]: storedOrder }));
            fallbackDirtyKeys.add(topicKey);
          }
        }
        nextOrders[result.subjectId] = subjectOrders;
      }
      setOrdersBySubject(nextOrders);
      if (fallbackDirtyKeys.size > 0) {
        setDirtyTopicKeys((current) => new Set([...current, ...fallbackDirtyKeys]));
      }
    }).catch(() => {
      if (cancelled) return;
      const fallback: OrdersBySubject = {};
      for (const subjectId of orderSubjectKey.split("|")) {
        fallback[subjectId] = {};
        for (const topicKey of requestedTopicKeys) {
          const storedOrder = readStoredItemOrder(subjectId, topicKey);
          if (storedOrder.length > 0) fallback[subjectId][topicKey] = storedOrder;
        }
      }
      setOrdersBySubject(fallback);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, orderSubjectKey, requestedTopicKeys]);

  function openRename(item: TopicItemSummary) {
    setRenameError(null);
    setRenameTarget(item);
    setRenameInput(item.title);
  }

  function openDelete(item: TopicItemSummary) {
    setDeleteError(null);
    setDeleteTarget(item);
  }

  async function renameItem() {
    if (!renameTarget || mutationBusyId) return;
    const title = renameInput.trim();
    if (!title) return;
    if (title === renameTarget.title) {
      setRenameTarget(null);
      setRenameInput("");
      return;
    }

    setMutationBusyId(renameTarget.id);
    setRenameError(null);
    try {
      const sourceResponse = await fetch(
        `/api/editor/content/${encodeURIComponent(renameTarget.id)}`,
        { cache: "no-store" },
      );
      const sourceBody: unknown = await sourceResponse
        .json()
        .catch(() => ({ error: "content_unavailable" }));
      const source = ContentItemSchema.safeParse(sourceBody);
      if (!sourceResponse.ok || !source.success) {
        throw new Error(errorMessage(sourceBody, "No se pudo cargar el elemento para editarlo."));
      }

      const draft = contentItemDraft(source.data);
      const response = await fetch(`/api/editor/content/${encodeURIComponent(renameTarget.id)}`, {
        body: JSON.stringify({ ...draft, title }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const body: unknown = await response
        .json()
        .catch(() => ({ error: "content_unavailable" }));
      if (!response.ok) {
        throw new Error(errorMessage(body, `No se pudo editar el elemento (${response.status}).`));
      }
      const parsed = ContentItemSchema.safeParse(body);
      if (!parsed.success) throw new Error(mutationErrors.content_unavailable);
      const summary = toTopicItemSummary(parsed.data);
      if (!summary) throw new Error(mutationErrors.content_unavailable);
      setItemOverrides((current) => ({ ...current, [summary.id]: summary }));
      setRenameTarget(null);
      setRenameInput("");
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : mutationErrors.content_unavailable ?? null);
    } finally {
      setMutationBusyId(null);
    }
  }

  async function deleteItem() {
    if (!deleteTarget || mutationBusyId) return;
    setMutationBusyId(deleteTarget.id);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/editor/content/${encodeURIComponent(deleteTarget.id)}`, {
        cache: "no-store",
        method: "DELETE",
      });
      const body: unknown = await response
        .json()
        .catch(() => ({ error: "content_unavailable" }));
      if (!response.ok) {
        throw new Error(errorMessage(body, `No se pudo eliminar el elemento (${response.status}).`));
      }
      setItemOverrides((current) => ({ ...current, [deleteTarget.id]: null }));
      setLocalOrders((current) => Object.fromEntries(
        Object.entries(current).map(([topic, ids]) => [topic, ids.filter((id) => id !== deleteTarget.id)]),
      ));
      setOrdersBySubject((current) => Object.fromEntries(
        Object.entries(current).map(([subjectId, topicOrders]) => [
          subjectId,
          Object.fromEntries(
            Object.entries(topicOrders).map(([topic, ids]) => [
              topic,
              ids.filter((id) => id !== deleteTarget.id),
            ]),
          ),
        ]),
      ));
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : mutationErrors.content_unavailable ?? null);
    } finally {
      setMutationBusyId(null);
    }
  }

  function stageOrder(topic: string, orderedIds: string[], topicItems: TopicItemSummary[]) {
    const topicKey = normalizeRegion(topic);
    if (!topicKey || orderSaveBusy) return;
    const topicItemSubjectIds = new Set(topicItems.flatMap((item) => item.subjectIds));
    const relevantSubjectIds = (configuredSubjectIds.length > 0
      ? configuredSubjectIds
      : [...topicItemSubjectIds])
      .filter((subjectId) => topicItemSubjectIds.has(subjectId));
    if (relevantSubjectIds.length === 0) return;

    setLocalOrders((current) => ({ ...current, [topicKey]: orderedIds }));
    setDirtyTopicKeys((current) => new Set(current).add(topicKey));
    for (const subjectId of relevantSubjectIds) {
      const validIds = orderedIds.filter((id) =>
        topicItems.some((item) => item.id === id && item.subjectIds.includes(subjectId)),
      );
      writeStoredItemOrder(subjectId, topicKey, validIds);
    }
  }

  async function savePendingOrders() {
    if (orderSaveBusy || dirtyTopicKeys.size === 0) return;
    const dirtyKeys = [...dirtyTopicKeys];
    const topicByKey = new Map(topics.map((topic) => [normalizeRegion(topic), topic]));
    const expectedBySubject: OrdersBySubject = {};

    for (const topicKey of dirtyKeys) {
      const orderedIds = localOrders[topicKey];
      const topic = topicByKey.get(topicKey);
      if (!orderedIds || !topic) continue;

      const topicItems = managedItems.filter((item) =>
        item.topics.some((candidate) => normalizeRegion(candidate) === topicKey),
      );
      const topicItemSubjectIds = new Set(topicItems.flatMap((item) => item.subjectIds));
      const relevantSubjectIds = (configuredSubjectIds.length > 0
        ? configuredSubjectIds
        : [...topicItemSubjectIds])
        .filter((subjectId) => topicItemSubjectIds.has(subjectId));

      for (const subjectId of relevantSubjectIds) {
        const validIds = orderedIds.filter((id) =>
          topicItems.some((item) => item.id === id && item.subjectIds.includes(subjectId)),
        );
        expectedBySubject[subjectId] = {
          ...(expectedBySubject[subjectId] ?? {}),
          [topicKey]: validIds,
        };
      }
    }

    if (Object.keys(expectedBySubject).length === 0) {
      setDirtyTopicKeys(new Set());
      return;
    }

    setOrderSaveBusy(true);
    try {
      for (const [subjectId, topicOrders] of Object.entries(expectedBySubject)) {
        for (const [topicKey, contentIds] of Object.entries(topicOrders)) {
          const topic = topicByKey.get(topicKey);
          if (!topic) continue;

          let lastError: Error | null = null;
          for (let attempt = 0; attempt < 2; attempt += 1) {
            const response = await fetch("/api/editor/content-order", {
              body: JSON.stringify({ contentIds, subjectId, topic }),
              cache: "no-store",
              headers: { "Content-Type": "application/json" },
              method: "PATCH",
            });
            const body: unknown = await response
              .json()
              .catch(() => ({ error: "content_unavailable" }));
            if (response.ok) {
              lastError = null;
              break;
            }

            lastError = new Error(errorMessage(body, `No se pudo guardar el orden (${response.status}).`));
            if (attempt === 0 && (response.status === 502 || response.status === 503)) {
              await new Promise((resolve) => setTimeout(resolve, 700));
              continue;
            }
            break;
          }
          if (lastError) throw lastError;
        }
      }

      for (const [subjectId, topicOrders] of Object.entries(expectedBySubject)) {
        const response = await fetch(
          `/api/content-order?subjectId=${encodeURIComponent(subjectId)}&verify=${Date.now()}`,
          { cache: "no-store" },
        );
        const body: unknown = await response.json().catch(() => ({ topics: [] }));
        const parsed = orderResponseSchema.safeParse(body);
        if (!response.ok || !parsed.success) {
          throw new Error("El servidor no pudo confirmar el nuevo orden. Intenta guardar de nuevo.");
        }
        const confirmed = new Map(
          parsed.data.topics.map((entry) => [normalizeRegion(entry.topic), entry.contentIds]),
        );
        for (const [topicKey, expectedIds] of Object.entries(topicOrders)) {
          const actualIds = confirmed.get(topicKey) ?? [];
          if (
            actualIds.length !== expectedIds.length ||
            actualIds.some((id, index) => id !== expectedIds[index])
          ) {
            throw new Error("El servidor no confirmó el nuevo orden. Intenta guardar de nuevo.");
          }
        }
      }

      setOrdersBySubject((current) => {
        const next: OrdersBySubject = { ...current };
        for (const [subjectId, topicOrders] of Object.entries(expectedBySubject)) {
          next[subjectId] = {
            ...(next[subjectId] ?? {}),
            ...topicOrders,
          };
        }
        return next;
      });
      setDirtyTopicKeys((current) => {
        const next = new Set(current);
        dirtyKeys.forEach((key) => next.delete(key));
        return next;
      });
    } finally {
      setOrderSaveBusy(false);
    }
  }

  const context: TopicItemManagementContextValue = {
    configuredSubjectIds,
    deleteItem,
    deleteTarget,
    deleteError,
    draggingItemId,
    enabled,
    items: managedItems,
    hasPendingOrderChanges: dirtyTopicKeys.size > 0,
    localOrders,
    mutationBusyId,
    openDelete,
    openRename,
    orderSaveBusy,
    ordersBySubject,
    savePendingOrders,
    stageOrder,
    renameError,
    renameInput,
    renameItem,
    renameTarget,
    setDeleteTarget,
    setDraggingItemId,
    setRenameInput,
    setRenameTarget,
  };

  return (
    <TopicItemManagementContext.Provider value={context}>
      {children}
      <StudioNameDialog
        busy={Boolean(renameTarget && mutationBusyId === renameTarget.id)}
        description={renameTarget
          ? `Cambia el nombre de “${renameTarget.title}” sin abrir el editor completo.`
          : "Cambia el nombre del elemento."}
        icon={<NotePencil size={21} />}
        inputLabel="Nombre del elemento"
        maxLength={200}
        open={renameTarget !== null}
        placeholder="Nombre del elemento"
        submitLabel="Guardar nombre"
        title="Editar nombre"
        value={renameInput}
        onChange={(value) => {
          setRenameInput(value);
          setRenameError(null);
        }}
        onClose={() => {
          if (mutationBusyId) return;
          setRenameTarget(null);
          setRenameInput("");
          setRenameError(null);
        }}
        onSubmit={renameItem}
      >
        {renameError && <p role="alert">{renameError}</p>}
      </StudioNameDialog>
      <StudioConfirmDialog
        busy={Boolean(deleteTarget && mutationBusyId === deleteTarget.id)}
        busyLabel="Eliminando…"
        confirmLabel="Eliminar elemento"
        description={deleteTarget
          ? `Se eliminará “${deleteTarget.title}” del contenido de la plataforma. Esta acción no se puede deshacer.`
          : "Selecciona el elemento que deseas eliminar."}
        error={deleteError}
        icon={<Trash size={21} />}
        open={deleteTarget !== null}
        title="Eliminar elemento"
        onClose={() => {
          if (mutationBusyId) return;
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={deleteItem}
      />
    </TopicItemManagementContext.Provider>
  );
}

export function useTopicItemManagement() {
  const context = useContext(TopicItemManagementContext);
  if (!context) throw new Error("TopicItemManager must be used inside TopicItemManagementProvider");
  return context;
}

export function TopicItemManager({
  disabled = false,
  topic,
}: {
  disabled?: boolean;
  topic: string;
}) {
  const management = useTopicItemManagement();
  const [orderError, setOrderError] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const topicKey = normalizeRegion(topic);
  const topicItems = useMemo(() => {
    const filtered = management.items
      .filter((item) => item.topics.some((candidate) => normalizeRegion(candidate) === topicKey))
      .filter((item) => management.configuredSubjectIds.length === 0 ||
        management.configuredSubjectIds.some((subjectId) => item.subjectIds.includes(subjectId)))
      .sort((left, right) => left.title.localeCompare(right.title, "es"));

    const localOrder = management.localOrders[topicKey];
    if (localOrder) return applyContentIdOrder(filtered, localOrder);

    const candidateOrders = Object.values(management.ordersBySubject)
      .map((subjectOrders) => subjectOrders[topicKey] ?? [])
      .filter((order) => order.length > 0)
      .sort((left, right) => right.length - left.length);
    return applyContentIdOrder(filtered, candidateOrders[0] ?? []);
  }, [management.configuredSubjectIds, management.items, management.localOrders, management.ordersBySubject, topicKey]);
  const busy = disabled || Boolean(management.mutationBusyId) || management.orderSaveBusy;
  const canReorder = !busy && topicItems.length > 1;

  function dropOn(targetId: string, event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const sourceId = management.draggingItemId || event.dataTransfer.getData("text/plain");
    management.setDraggingItemId(null);
    setDragOverItemId(null);
    if (!sourceId || sourceId === targetId || !canReorder) return;
    const ids = topicItems.map((item) => item.id);
    const sourceIndex = ids.indexOf(sourceId);
    const targetIndex = ids.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    ids.splice(sourceIndex, 1);
    ids.splice(targetIndex, 0, sourceId);
    setOrderError(null);
    management.stageOrder(topic, ids, topicItems);
  }

  if (!management.enabled) return null;

  return (
    <section className={styles.container} aria-label={`Elementos de ${topic}`}>
      <header className={styles.header}>
        <div>
          <strong>Elementos del tema</strong>
          <span>{topicItems.length === 1 ? "1 elemento" : `${topicItems.length} elementos`}</span>
        </div>
        {topicItems.length > 1 && <small>Arrastra el icono de puntos para reorganizar.</small>}
      </header>
      {topicItems.length === 0 ? (
        <p className={styles.empty}>Todavía no hay guías o videos asociados a este tema.</p>
      ) : (
        <div className={styles.list}>
          {topicItems.map((item) => (
            <div
              className={`${styles.item} ${management.draggingItemId === item.id ? styles.itemDragging : ""} ${dragOverItemId === item.id && management.draggingItemId !== item.id ? styles.itemDropTarget : ""}`}
              data-topic-item-drag-preview="true"
              key={item.id}
              onDragEnter={() => {
                if (canReorder && management.draggingItemId !== item.id) setDragOverItemId(item.id);
              }}
              onDragOver={(event) => {
                if (!canReorder) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                if (management.draggingItemId !== item.id) setDragOverItemId(item.id);
              }}
              onDrop={(event) => dropOn(item.id, event)}
            >
              <button
                aria-label={`Mover ${item.title}`}
                className={styles.moveButton}
                disabled={!canReorder}
                draggable={canReorder}
                title={canReorder ? "Arrastra para cambiar el orden" : "Se necesitan al menos dos elementos para reordenar"}
                type="button"
                onDragEnd={() => {
                  management.setDraggingItemId(null);
                  setDragOverItemId(null);
                }}
                onDragStart={(event) => {
                  if (!canReorder) {
                    event.preventDefault();
                    return;
                  }
                  const preview = event.currentTarget.closest<HTMLElement>("[data-topic-item-drag-preview='true']");
                  if (preview) {
                    preview.classList.add(styles.dragPreviewLift!);
                    event.dataTransfer.setDragImage(preview, 24, Math.min(28, preview.offsetHeight / 2));
                    requestAnimationFrame(() => preview.classList.remove(styles.dragPreviewLift!));
                  }
                  management.setDraggingItemId(item.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", item.id);
                }}
              >
                <DotsSixVertical aria-hidden="true" size={18} weight="bold" />
              </button>
              <div className={styles.copy}>
                <strong>{item.title}</strong>
                <span>{item.kind === "guide" ? "Guía" : "Video"} · {statusLabels[item.status]}</span>
              </div>
              <div className={styles.actions}>
                <button
                  aria-label={`Editar nombre de ${item.title}`}
                  disabled={busy}
                  title="Editar nombre"
                  type="button"
                  onClick={() => management.openRename(item)}
                >
                  <NotePencil aria-hidden="true" size={16} />
                </button>
                <button
                  aria-label={`Eliminar ${item.title}`}
                  className={styles.danger}
                  disabled={busy}
                  title="Eliminar"
                  type="button"
                  onClick={() => management.openDelete(item)}
                >
                  <Trash aria-hidden="true" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {orderError && <p className={styles.error} role="alert">{orderError}</p>}
    </section>
  );
}
