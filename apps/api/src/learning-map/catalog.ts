import type {
  MapCatalogQuery,
  MapRoute,
  LearningMapCatalogResponse,
  LearningMapSuggestionsResponse,
  MapCatalogItem,
} from "@cediah/contracts";
import {
  readMapLevel,
  resolveMapReferences,
  type MapDatabase,
} from "./resolver.js";

export const normalizedMapTitle = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
async function catalogItems(
  db: MapDatabase,
  userId: string,
  route: MapRoute,
): Promise<MapCatalogItem[] | null> {
  const level = await readMapLevel(db, userId, route);
  if (!level && route.nodeId) return null;
  const published = await db
    .selectFrom("learning_paths")
    .select("id")
    .where("archived_at", "is", null)
    .where("published_version_id", "is not", null)
    .execute();
  const resolver = await resolveMapReferences(
    db,
    userId,
    published.map((p) => p.id),
  );
  const entries = level
    ? await db
        .selectFrom("learning_map_entries")
        .selectAll()
        .where("map_id", "=", level.mapId)
        .$if(Boolean(route.nodeId), (q) =>
          q.where("node_id", "=", route.nodeId!),
        )
        .execute()
    : [];
  const nodes = level
    ? await db
        .selectFrom("learning_map_nodes")
        .select("origin_topic_id")
        .where("map_id", "=", level.mapId)
        .execute()
    : [];
  const membership = (
    pathId: string,
    unit?: string,
  ): MapCatalogItem["membership"] =>
    !route.nodeId
      ? "absent"
      : entries.some(
            (e) =>
              e.path_id === pathId &&
              (unit ? e.unit_stable_key === unit : e.kind === "block"),
          )
        ? "direct"
        : unit &&
            entries.some((e) => e.path_id === pathId && e.kind === "block")
          ? "covered"
          : "absent";
  const items: MapCatalogItem[] = [];
  const topics = new Set<string>();
  for (const path of resolver.paths) {
    const r = resolver.resolve({ kind: "block", pathId: path.id });
    if (r.unavailable) continue;
    if (!topics.has(path.topic_content_id)) {
      topics.add(path.topic_content_id);
      items.push({
        key: `topic:${path.topic_content_id}`,
        kind: "topic_template",
        title: path.topic_title,
        topicId: path.topic_content_id,
        topicTitle: path.topic_title,
        ref: null,
        reason: "Agrupa bloques publicados de este tema",
        membership: nodes.some(
          (n) => n.origin_topic_id === path.topic_content_id,
        )
          ? "direct"
          : "absent",
      });
    }
    items.push({
      key: `block:${path.id}`,
      kind: "block",
      title: path.title,
      topicId: path.topic_content_id,
      topicTitle: path.topic_title,
      ref: { kind: "block", pathId: path.id },
      reason: null,
      membership: membership(path.id),
    });
    for (const unit of r.units)
      items.push({
        key: `lesson:${path.id}:${unit.stable_key}`,
        kind: "lesson",
        title: unit.title,
        topicId: path.topic_content_id,
        topicTitle: path.topic_title,
        ref: {
          kind: "lesson",
          pathId: path.id,
          unitStableKey: unit.stable_key,
        },
        reason: null,
        membership: membership(path.id, unit.stable_key),
      });
  }
  return items;
}
const key = (i: MapCatalogItem) =>
  `${normalizedMapTitle(i.title)}|${i.kind}|${i.key}`;
export async function readMapCatalog(
  db: MapDatabase,
  userId: string,
  query: MapCatalogQuery,
): Promise<LearningMapCatalogResponse | null> {
  const items = await catalogItems(db, userId, {
    nodeId: query.node ?? null,
    entryId: query.item ?? null,
    unitStableKey: query.unit ?? null,
  });
  if (!items) return null;
  const sorted = items
    .filter(
      (i) =>
        (query.kind === "all" || i.kind === query.kind) &&
        normalizedMapTitle(`${i.title} ${i.topicTitle}`).includes(
          normalizedMapTitle(query.q),
        ),
    )
    .sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  const page = sorted
    .filter((i) => !query.cursor || key(i) > query.cursor)
    .slice(0, query.limit + 1);
  return {
    items: page.slice(0, query.limit),
    nextCursor: page.length > query.limit ? key(page[query.limit - 1]!) : null,
  };
}

export async function readMapSuggestions(
  db: MapDatabase,
  userId: string,
  route: MapRoute,
): Promise<LearningMapSuggestionsResponse | null> {
  const level = await readMapLevel(db, userId, route);
  if (!level) return null;
  const entries = await db
    .selectFrom("learning_map_entries")
    .selectAll()
    .where("map_id", "=", level.mapId)
    .$if(Boolean(route.nodeId), (q) => q.where("node_id", "=", route.nodeId!))
    .execute();
  const resolver = await resolveMapReferences(
    db,
    userId,
    entries.map((e) => e.path_id),
  );
  const contextTopics = new Set(resolver.paths.map((p) => p.topic_content_id));
  const result: LearningMapSuggestionsResponse = {
    items: [],
    incompleteBlocks: [],
  };
  const candidates = await catalogItems(db, userId, route);
  if (!candidates) return null;
  result.items = candidates
    .filter(
      (i) =>
        i.membership === "absent" &&
        (route.nodeId
          ? i.kind !== "topic_template" && contextTopics.has(i.topicId)
          : i.kind === "topic_template"),
    )
    .map((i) => ({
      ...i,
      reason: route.nodeId
        ? "Comparte el tema del contenido de este nodo"
        : "Tema publicado que puedes añadir al mapa",
    }));
  const selectedPath = level.selectedLesson?.pathId;
  result.items.sort(
    (a, b) =>
      Number(b.ref?.pathId === selectedPath) -
        Number(a.ref?.pathId === selectedPath) ||
      key(a).localeCompare(key(b), "es"),
  );
  result.items = result.items.slice(0, 3);
  if (route.nodeId)
    for (const path of resolver.paths) {
      const direct = entries.filter((e) => e.path_id === path.id);
      const r = resolver.resolve({ kind: "block", pathId: path.id });
      const added = new Set(
        direct
          .filter(
            (e) =>
              e.kind === "lesson" &&
              r.units.some((u) => u.stable_key === e.unit_stable_key),
          )
          .map((e) => e.unit_stable_key),
      ).size;
      if (
        !r.unavailable &&
        !direct.some((e) => e.kind === "block") &&
        added > 0 &&
        added < r.units.length
      )
        result.incompleteBlocks.push({
          pathId: path.id,
          title: path.title,
          addedLessons: added,
          totalLessons: r.units.length,
        });
    }
  return result;
}
