"use client";

import {
  DotsSixVertical,
  NotePencil,
  Trash,
} from "@phosphor-icons/react";
import {
  ContentItemSchema,
  ContentWorkspaceResponseSchema,
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
  topics: z.array(z.object({
    contentIds: z.array(z.string().uuid()),
    topic: z.string().trim().min(1).max(120),
  })),
});

const topicItemSummarySchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["guide", "video"]),
  status: z.enum([
    "draft",
    "in_review",
    "changes_requested",
    "approved",
    "published",
    "archived",
  ]),
  subjectIds: z.array(z.string().uuid()),
  title: z.string().max(200),
  topics: z.array(z.string().trim().min(1).max(120)),
});

const topicItemsResponseSchema = z.object({
  items: z.array(topicItemSummarySchema),
  topics: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    subjectIds: z.array(z.string().uuid()),
  })),
});

type TopicItemSummary = z.infer<typeof topicItemSummarySchema>;

type TopicItemsSnapshot = z.infer<typeof topicItemsResponseSchema>;

const mutationErrors: Partial<Record<string, string>> = {
  content_conflict: "El contenido cambió mientras intentabas editarlo. Actualiza la página y vuelve a intentarlo.",
  content_unavailable: "No se pudo actualizar el contenido. Comprueba la conexión y vuelve a intentarlo.",
  forbidden: "Tu cuenta no tiene permiso para realizar esta acción.",
  invalid_content: "El nombre no es válido o el contenido ya no cumple los requisitos del editor.",
  invalid_topic_order: "No se pudo guardar el nuevo orden.",
  not_found: "El elemento ya no existe o dejó de estar disponible.",
  topic_order_conflict: "El orden cambió o uno de los elementos ya no pertenece a este tema.",
};

const statusLabels: Record<TopicItemSummary["status"], string> = {
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

function commonSubjectIds(
  snapshot: TopicItemsSnapshot,
  requestedTopicKeys: Set<string>,
) {
  const matchingTopics = snapshot.topics.filter(
    (topic) => requestedTopicKeys.has(normalizeRegion(topic.name)),
  );
  if (matchingTopics.length === 0) return [];

  const common = new Set(matchingTopics[0]?.subjectIds ?? []);
  for (const topic of matchingTopics.slice(1)) {
    const current = new Set(topic.subjectIds);
    for (const subjectId of [...common]) {
      if (!current.has(subjectId)) common.delete(subjectId);
    }
  }
  return [...common];
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
  loaded: boolean;
  localOrders: Record<string, string[]>;
  mutationBusyId: string | null;
  openDelete: (item: TopicItemSummary) => void;
  openRename: (item: TopicItemSummary) => void;
  orderBusyTopic: string | null;
  ordersBySubject: OrdersBySubject;
  persistOrder: (topic: string, orderedIds: string[], topicItems: TopicItemSummary[]) => Promise<void>;
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
  subjectIds = [],
  topics = [],
}: {
  children: ReactNode;
  enabled: boolean;
  subjectIds?: readonly string[];
  topics?: readonly string[];
}) {
  const configuredSubjectKey = [...new Set(subjectIds)].sort().join("|");
  const requestedTopicKey = uniqueRegions(topics)
    .map(normalizeRegion)
    .sort()
    .join("|");
  const [configuredSubjectIds, setConfiguredSubjectIds] = useState<string[]>(
    configuredSubjectKey ? configuredSubjectKey.split("|") : [],
  );
  const [items, setItems] = useState<TopicItemSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [ordersBySubject, setOrdersBySubject] = useState<OrdersBySubject>({});
  const [localOrders, setLocalOrders] = useState<Record<string, string[]>>({});
  const [orderBusyTopic, setOrderBusyTopic] = useState<string | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<TopicItemSummary | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TopicItemSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [mutationBusyId, setMutationBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoaded(false);
      return;
    }
    let cancelled = false;
    setLoaded(false);

    void (async () => {
      const topicItemsResponse = await fetch("/api/editor/topic-items", { cache: "no-store" });
      const topicItemsBody: unknown = await topicItemsResponse
        .json()
        .catch(() => ({ error: "content_unavailable" }));
      const snapshot = topicItemsResponseSchema.safeParse(topicItemsBody);
      if (!topicItemsResponse.ok || !snapshot.success) throw new Error("topic_items_unavailable");

      const requestedTopicKeys = new Set(
        requestedTopicKey ? requestedTopicKey.split("|") : [],
      );
      const explicitSubjectIds = configuredSubjectKey
        ? configuredSubjectKey.split("|")
        : [];
      const inferredSubjectIds = explicitSubjectIds.length > 0
        ? explicitSubjectIds
        : commonSubjectIds(snapshot.data, requestedTopicKeys);
      const relevantItems = requestedTopicKeys.size === 0
        ? []
        : snapshot.data.items.filter((item) => item.topics.some(
            (topic) => requestedTopicKeys.has(normalizeRegion(topic)),
          ));
      const orderSubjectIds = inferredSubjectIds.length > 0
        ? inferredSubjectIds
        : [...new Set(relevantItems.flatMap((item) => item.subjectIds))];

      const orderResults = await Promise.all(orderSubjectIds.map(async (subjectId) => {
        const response = await fetch(
          `/api/content-order?subjectId=${encodeURIComponent(subjectId)}`,
          { cache: "no-store" },
        );
        const body: unknown = await response
          .json()
          .catch(() => ({ topics: [] }));
        const parsed = orderResponseSchema.safeParse(body);
        return {
          subjectId,
          topics: response.ok && parsed.success ? parsed.data.topics : [],
        };
      }));

      if (cancelled) return;
      const nextOrders: OrdersBySubject = {};
      for (const result of orderResults) {
        nextOrders[result.subjectId] = Object.fromEntries(
          result.topics.map((topic) => [normalizeRegion(topic.topic), topic.contentIds]),
        );
      }
      setConfiguredSubjectIds(inferredSubjectIds);
      setItems(snapshot.data.items);
      setOrdersBySubject(nextOrders);
      setLoaded(true);
    })().catch(() => {
      if (cancelled) return;
      setConfiguredSubjectIds(configuredSubjectKey ? configuredSubjectKey.split("|") : []);
      setItems([]);
      setOrdersBySubject({});
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [configuredSubjectKey, enabled, requestedTopicKey]);

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
      // The lightweight topic index intentionally omits heavy guide documents.
      // Fetch the complete item only when the user actually renames one.
      const workspaceResponse = await fetch("/api/editor/content", { cache: "no-store" });
      const workspaceBody: unknown = await workspaceResponse
        .json()
        .catch(() => ({ error: "content_unavailable" }));
      const workspace = ContentWorkspaceResponseSchema.safeParse(workspaceBody);
      if (!workspaceResponse.ok || !workspace.success) {
        throw new Error(mutationErrors.content_unavailable);
      }
      const source = workspace.data.items.find((item) => item.id === renameTarget.id);
      if (!source) throw new Error(mutationErrors.not_found);

      const draft = contentItemDraft(source);
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
      setItems((current) => current.map((item) => item.id === summary.id ? summary : item));
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
      setItems((current) => current.filter((item) => item.id !== deleteTarget.id));
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

  async function persistOrder(topic: string, orderedIds: string[], topicItems: TopicItemSummary[]) {
    const topicKey = normalizeRegion(topic);
    if (!topicKey || orderBusyTopic) return;
    const relevantSubjectIds = configuredSubjectIds.length > 0
      ? configuredSubjectIds
      : [...new Set(topicItems.flatMap((item) => item.subjectIds))];
    if (relevantSubjectIds.length === 0) return;

    const previousLocal = localOrders[topicKey];
    setLocalOrders((current) => ({ ...current, [topicKey]: orderedIds }));
    setOrderBusyTopic(topicKey);
    try {
      const responses = await Promise.all(relevantSubjectIds.map(async (subjectId) => {
        const validIds = orderedIds.filter((id) =>
          topicItems.some((item) => item.id === id && item.subjectIds.includes(subjectId)),
        );
        const response = await fetch("/api/editor/content-order", {
          body: JSON.stringify({ contentIds: validIds, subjectId, topic }),
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        const body: unknown = await response
          .json()
          .catch(() => ({ error: "content_unavailable" }));
        if (!response.ok) {
          throw new Error(errorMessage(body, `No se pudo guardar el orden (${response.status}).`));
        }
        return { contentIds: validIds, subjectId };
      }));
      setOrdersBySubject((current) => {
        const next: OrdersBySubject = { ...current };
        for (const result of responses) {
          next[result.subjectId] = {
            ...(next[result.subjectId] ?? {}),
            [topicKey]: result.contentIds,
          };
        }
        return next;
      });
    } catch (error) {
      setLocalOrders((current) => {
        const next = { ...current };
        if (previousLocal) next[topicKey] = previousLocal;
        else delete next[topicKey];
        return next;
      });
      throw error;
    } finally {
      setOrderBusyTopic(null);
    }
  }

  const context: TopicItemManagementContextValue = {
    configuredSubjectIds,
    deleteItem,
    deleteTarget,
    deleteError,
    draggingItemId,
    enabled,
    items,
    loaded,
    localOrders,
    mutationBusyId,
    openDelete,
    openRename,
    orderBusyTopic,
    ordersBySubject,
    persistOrder,
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

function useTopicItemManagement() {
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
  const busy = disabled || Boolean(management.mutationBusyId) || management.orderBusyTopic === topicKey;
  const canReorder = !busy && topicItems.length > 1;

  async function dropOn(targetId: string, event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const sourceId = management.draggingItemId || event.dataTransfer.getData("text/plain");
    management.setDraggingItemId(null);
    if (!sourceId || sourceId === targetId || !canReorder) return;
    const ids = topicItems.map((item) => item.id);
    const sourceIndex = ids.indexOf(sourceId);
    const targetIndex = ids.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    ids.splice(sourceIndex, 1);
    ids.splice(targetIndex, 0, sourceId);
    setOrderError(null);
    try {
      await management.persistOrder(topic, ids, topicItems);
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : "No se pudo guardar el nuevo orden.");
    }
  }

  if (!management.enabled) return null;

  return (
    <section className={styles.container} aria-label={`Elementos de ${topic}`}>
      <header className={styles.header}>
        <div>
          <strong>Elementos del tema</strong>
          <span>{topicItems.length === 1 ? "1 elemento" : `${topicItems.length} elementos`}</span>
        </div>
        {topicItems.length > 1 && <small>Arrastra desde “Mover” para reorganizar.</small>}
      </header>
      {!management.loaded ? (
        <p className={styles.empty}>Cargando elementos…</p>
      ) : topicItems.length === 0 ? (
        <p className={styles.empty}>Todavía no hay guías o videos asociados a este tema.</p>
      ) : (
        <div className={styles.list}>
          {topicItems.map((item) => (
            <div
              className={`${styles.item} ${management.draggingItemId === item.id ? styles.itemDragging : ""}`}
              key={item.id}
              onDragOver={(event) => {
                if (!canReorder) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => void dropOn(item.id, event)}
            >
              <button
                aria-label={`Mover ${item.title}`}
                className={styles.moveButton}
                disabled={!canReorder}
                draggable={canReorder}
                title={canReorder ? "Arrastra para cambiar el orden" : "Se necesitan al menos dos elementos para reordenar"}
                type="button"
                onDragEnd={() => management.setDraggingItemId(null)}
                onDragStart={(event) => {
                  if (!canReorder) {
                    event.preventDefault();
                    return;
                  }
                  management.setDraggingItemId(item.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", item.id);
                }}
              >
                <DotsSixVertical aria-hidden="true" size={17} weight="bold" />
                <span>Mover</span>
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
