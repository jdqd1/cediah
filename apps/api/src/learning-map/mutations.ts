import { sql, type Selectable } from "kysely";
import {
  LearningMapMutationResponseSchema,
  type LearningMapMutationResponse,
  type LearningMapProvider,
  type MapContentRef,
  type GuidedLearningResult,
} from "@cediah/contracts";
import type {
  DatabaseClient,
  JsonValue,
  LearningMapEntryTable,
  LearningMapNodeTable,
  LearningMapLayoutTable,
} from "../db/database.js";
import { withLearningReceipt } from "../guided-learning/mutation-receipt.js";
import {
  entryRef,
  readMapLevel,
  resolveMapReferences,
  rootRoute,
  type MapDatabase,
} from "./resolver.js";

type Entry = Selectable<LearningMapEntryTable>;
type Node = Selectable<LearningMapNodeTable>;
type Undo = {
  nodes: Node[];
  entries: Entry[];
  layouts: Selectable<LearningMapLayoutTable>[];
  removeEntryIds: string[];
  versionAfter: number;
  expiresAt: string;
};
class MapFailure extends Error {
  constructor(
    readonly status:
      | "not_found"
      | "not_ready"
      | "version_conflict"
      | "invalid_state"
      | "resource_changed",
  ) {
    super(status);
  }
}
function canonical(ref: MapContentRef) {
  return `${ref.pathId}:${ref.kind === "block" ? "*" : ref.unitStableKey}`;
}
export function coalesceMapRefs(refs: MapContentRef[]) {
  const blocks = new Set(
    refs.filter((r) => r.kind === "block").map((r) => r.pathId),
  );
  return [
    ...new Map(
      refs
        .filter((r) => r.kind === "block" || !blocks.has(r.pathId))
        .map((r) => [canonical(r), r]),
    ).values(),
  ];
}
async function validateRefs(
  db: MapDatabase,
  userId: string,
  refs: MapContentRef[],
) {
  const resolver = await resolveMapReferences(
    db,
    userId,
    refs.map((r) => r.pathId),
  );
  if (refs.some((r) => resolver.resolve(r).unavailable))
    throw new MapFailure("resource_changed");
}

export function createMapMutator(
  database: DatabaseClient,
  clock: () => Date,
): LearningMapProvider["mutate"] {
  return async (input) => {
    try {
      return await database.transaction().execute(async (tx) => {
        let undo: Undo | null = null;
        const result = await withLearningReceipt(
          tx,
          {
            userId: input.userId,
            idempotencyKey: input.idempotencyKey,
            request: {
              operation: input.operation,
              nodeId: input.nodeId ?? null,
              request: input.request,
            },
            responseSchema: LearningMapMutationResponseSchema,
          },
          async (): Promise<
            GuidedLearningResult<LearningMapMutationResponse>
          > => {
            await sql`savepoint map_change`.execute(tx);
            try {
              if (input.operation === "ensure") {
                const inserted = await tx
                  .insertInto("learning_maps")
                  .values({ user_id: input.userId })
                  .onConflict((c) => c.column("user_id").doNothing())
                  .returningAll()
                  .executeTakeFirst();
                const map =
                  inserted ??
                  (await tx
                    .selectFrom("learning_maps")
                    .selectAll()
                    .where("user_id", "=", input.userId)
                    .executeTakeFirstOrThrow());
                if (inserted) {
                  const enrollments = await tx
                    .selectFrom("learning_enrollments")
                    .innerJoin(
                      "learning_paths",
                      "learning_paths.id",
                      "learning_enrollments.path_id",
                    )
                    .innerJoin(
                      "content_items",
                      "content_items.id",
                      "learning_paths.topic_content_id",
                    )
                    .select([
                      "learning_paths.id",
                      "learning_paths.topic_content_id",
                      "content_items.title",
                    ])
                    .where("learning_enrollments.user_id", "=", input.userId)
                    .where("learning_enrollments.status", "!=", "archived")
                    .orderBy("content_items.title")
                    .orderBy("learning_paths.id")
                    .execute();
                  const topics = [
                    ...new Set(enrollments.map((e) => e.topic_content_id)),
                  ];
                  if (
                    topics.length > 200 ||
                    enrollments.length > 5000 ||
                    topics.some(
                      (t) =>
                        enrollments.filter((e) => e.topic_content_id === t)
                          .length > 200,
                    )
                  )
                    throw new MapFailure("not_ready");
                  for (const [order, topic] of topics.entries()) {
                    const paths = enrollments.filter(
                      (e) => e.topic_content_id === topic,
                    );
                    const node = await tx
                      .insertInto("learning_map_nodes")
                      .values({
                        map_id: map.id,
                        title: paths[0]!.title.slice(0, 80).trim(),
                        icon_key: "folder",
                        origin_topic_id: topic,
                        sort_order: order,
                      })
                      .returning("id")
                      .executeTakeFirstOrThrow();
                    if (paths.length)
                      await tx
                        .insertInto("learning_map_entries")
                        .values(
                          paths.map((p, i) => ({
                            map_id: map.id,
                            node_id: node.id,
                            path_id: p.id,
                            kind: "block" as const,
                            unit_stable_key: null,
                            sort_order: i,
                          })),
                        )
                        .execute();
                  }
                }
                return {
                  status: "success",
                  value: {
                    mapId: map.id,
                    structuralVersion: map.row_version,
                    affectedLevelKeys: ["root"],
                    changedIds: [],
                    undo: null,
                  },
                };
              }
              const map = await tx
                .selectFrom("learning_maps")
                .selectAll()
                .where("user_id", "=", input.userId)
                .forUpdate()
                .executeTakeFirst();
              if (!map) return { status: "not_found" };
              const nodes = await tx
                .selectFrom("learning_map_nodes")
                .selectAll()
                .where("map_id", "=", map.id)
                .execute();
              const entries = await tx
                .selectFrom("learning_map_entries")
                .selectAll()
                .where("map_id", "=", map.id)
                .execute();
              const requireNode = (id: string) => {
                const n = nodes.find((n) => n.id === id);
                if (!n) throw new MapFailure("not_found");
                return n;
              };
              const affected = new Set<string>(["root"]),
                changed: string[] = [];
              const base = (): LearningMapMutationResponse => ({
                mapId: map.id,
                structuralVersion: map.row_version,
                affectedLevelKeys: [...affected],
                changedIds: changed,
                undo: null,
              });
              if (input.operation === "layout") {
                const body = input.request;
                let route = rootRoute;
                if (body.levelKey.startsWith("node:")) {
                  const nodeId = body.levelKey.slice(5);
                  requireNode(nodeId);
                  route = { ...rootRoute, nodeId };
                } else if (body.levelKey.startsWith("block:")) {
                  const e = entries.find(
                    (e) =>
                      e.id === body.levelKey.slice(6) && e.kind === "block",
                  );
                  if (!e) return { status: "not_found" };
                  route = {
                    nodeId: e.node_id,
                    entryId: e.id,
                    unitStableKey: null,
                  };
                }
                const level = await readMapLevel(tx, input.userId, route);
                if (
                  !level ||
                  body.positions.some(
                    (p) => !level.items.some((i) => i.occurrenceId === p.id),
                  )
                )
                  return { status: "not_found" };
                if (level.layout.rowVersion !== body.expectedVersion)
                  return { status: "version_conflict" };
                const positions = {
                  ...level.layout.positions,
                  ...Object.fromEntries(
                    body.positions.map(({ id, x, y }) => [id, { x, y }]),
                  ),
                };
                const version = body.expectedVersion + 1;
                await tx
                  .insertInto("learning_map_layouts")
                  .values({
                    map_id: map.id,
                    level_key: body.levelKey,
                    positions_json: positions,
                    row_version: version,
                  })
                  .onConflict((c) =>
                    c
                      .columns(["map_id", "level_key"])
                      .doUpdateSet({
                        positions_json: positions,
                        row_version: version,
                        updated_at: clock(),
                      }),
                  )
                  .execute();
                return {
                  status: "success",
                  value: {
                    ...base(),
                    affectedLevelKeys: [body.levelKey],
                    changedIds: body.positions.map((p) => p.id),
                    layoutVersion: version,
                  },
                };
              }
              if (input.request.expectedVersion !== map.row_version)
                return { status: "version_conflict" };
              async function insertRefs(nodeId: string, refs: MapContentRef[]) {
                requireNodeOrNew(nodeId);
                await validateRefs(tx, input.userId, refs);
                const stored = await tx
                  .selectFrom("learning_map_entries")
                  .selectAll()
                  .where("map_id", "=", map!.id)
                  .execute();
                const direct = stored.filter((e) => e.node_id === nodeId);
                const additions = [
                  ...new Map(refs.map((r) => [canonical(r), r])).values(),
                ].filter(
                  (r) =>
                    !direct.some(
                      (e) =>
                        canonical(entryRef(e)) === canonical(r) ||
                        (e.kind === "block" && e.path_id === r.pathId),
                    ),
                );
                if (
                  stored.length + additions.length > 5000 ||
                  direct.length + additions.length > 200
                )
                  throw new MapFailure("not_ready");
                const order =
                  Math.max(-1, ...direct.map((e) => e.sort_order)) + 1;
                for (const [i, ref] of additions.entries()) {
                  const e = await tx
                    .insertInto("learning_map_entries")
                    .values({
                      map_id: map!.id,
                      node_id: nodeId,
                      kind: ref.kind,
                      path_id: ref.pathId,
                      unit_stable_key:
                        ref.kind === "lesson" ? ref.unitStableKey : null,
                      sort_order: order + i,
                    })
                    .returning("id")
                    .executeTakeFirstOrThrow();
                  changed.push(e.id);
                }
                if (!additions.length)
                  changed.push(
                    ...direct
                      .filter((e) =>
                        refs.some(
                          (r) =>
                            e.path_id === r.pathId &&
                            (e.kind === "block" ||
                              canonical(entryRef(e)) === canonical(r)),
                        ),
                      )
                      .map((e) => e.id),
                  );
                affected.add(`node:${nodeId}`);
              }
              const newNodes = new Set<string>();
              const requireNodeOrNew = (id: string) => {
                if (!newNodes.has(id)) requireNode(id);
              };
              async function createNode(
                title: string,
                iconKey: Node["icon_key"],
                refs: MapContentRef[],
                topicId: string | null = null,
              ) {
                if (nodes.length >= 200) throw new MapFailure("not_ready");
                const n = await tx
                  .insertInto("learning_map_nodes")
                  .values({
                    map_id: map!.id,
                    title,
                    icon_key: iconKey,
                    origin_topic_id: topicId,
                    sort_order:
                      Math.max(-1, ...nodes.map((n) => n.sort_order)) + 1,
                  })
                  .returning("id")
                  .executeTakeFirstOrThrow();
                newNodes.add(n.id);
                changed.push(n.id);
                await insertRefs(n.id, refs);
              }
              async function captureUndo(
                savedNodes: Node[],
                savedEntries: Entry[],
                levelKeys: string[],
              ) {
                undo = {
                  nodes: savedNodes,
                  entries: savedEntries,
                  layouts: await tx
                    .selectFrom("learning_map_layouts")
                    .selectAll()
                    .where("map_id", "=", map!.id)
                    .where("level_key", "in", ["root", ...levelKeys])
                    .execute(),
                  removeEntryIds: [],
                  versionAfter: map!.row_version + 1,
                  expiresAt: new Date(clock().getTime() + 30_000).toISOString(),
                };
              }
              if (input.operation === "nodes") {
                let refs = input.request.items ?? [];
                if (input.request.topicTemplateId) {
                  const topic = await tx
                    .selectFrom("content_items")
                    .select("id")
                    .where("id", "=", input.request.topicTemplateId)
                    .where("kind", "=", "topic")
                    .where("status", "=", "published")
                    .executeTakeFirst();
                  if (!topic) throw new MapFailure("not_found");
                  refs = (
                    await tx
                      .selectFrom("learning_paths")
                      .select("id")
                      .where("topic_content_id", "=", topic.id)
                      .where("archived_at", "is", null)
                      .where("published_version_id", "is not", null)
                      .execute()
                  ).map((p) => ({ kind: "block", pathId: p.id }));
                }
                await createNode(
                  input.request.title,
                  input.request.iconKey,
                  coalesceMapRefs(refs),
                  input.request.topicTemplateId ?? null,
                );
              } else if (input.operation === "updateNode") {
                if (!input.nodeId) throw new MapFailure("not_found");
                requireNode(input.nodeId);
                await tx
                  .updateTable("learning_map_nodes")
                  .set({
                    ...(input.request.title !== undefined
                      ? { title: input.request.title }
                      : {}),
                    ...(input.request.iconKey
                      ? { icon_key: input.request.iconKey }
                      : {}),
                    updated_at: clock(),
                  })
                  .where("id", "=", input.nodeId)
                  .where("map_id", "=", map.id)
                  .execute();
                changed.push(input.nodeId);
                affected.add(`node:${input.nodeId}`);
              } else if (input.operation === "entries")
                await insertRefs(input.request.nodeId, [input.request.ref]);
              else if (input.operation === "group") {
                const level = await readMapLevel(
                  tx,
                  input.userId,
                  input.request.route,
                );
                if (!level) throw new MapFailure("not_found");
                const refs: MapContentRef[] = [];
                for (const selection of input.request.selections) {
                  if ("rootNodeId" in selection) {
                    if (
                      level.levelKey !== "root" ||
                      !level.items.some(
                        (i) => i.occurrenceId === selection.rootNodeId,
                      )
                    )
                      throw new MapFailure("not_found");
                    refs.push(
                      ...entries
                        .filter((e) => e.node_id === selection.rootNodeId)
                        .map(entryRef),
                    );
                  } else if ("entryId" in selection) {
                    const e = entries.find((e) => e.id === selection.entryId);
                    if (!e || level.levelKey !== `node:${e.node_id}`)
                      throw new MapFailure("not_found");
                    refs.push(entryRef(e));
                  } else {
                    const e = entries.find(
                      (e) =>
                        e.id === selection.blockEntryId && e.kind === "block",
                    );
                    if (
                      !e ||
                      level.levelKey !== `block:${e.id}` ||
                      !level.items.some(
                        (i) => i.unitStableKey === selection.unitStableKey,
                      )
                    )
                      throw new MapFailure("not_found");
                    refs.push({
                      kind: "lesson",
                      pathId: e.path_id,
                      unitStableKey: selection.unitStableKey,
                    });
                  }
                }
                await createNode(
                  input.request.title,
                  input.request.iconKey,
                  coalesceMapRefs(refs),
                );
              } else if (input.operation === "complete-block") {
                const body = input.request;
                requireNode(body.nodeId);
                const removed = entries.filter(
                  (e) =>
                    e.node_id === body.nodeId &&
                    e.path_id === body.pathId &&
                    e.kind === "lesson",
                );
                await validateRefs(tx, input.userId, [
                  { kind: "block", pathId: body.pathId },
                ]);
                await captureUndo([], removed, [`node:${body.nodeId}`]);
                if (removed.length)
                  await tx
                    .deleteFrom("learning_map_entries")
                    .where("map_id", "=", map.id)
                    .where(
                      "id",
                      "in",
                      removed.map((e) => e.id),
                    )
                    .execute();
                await insertRefs(body.nodeId, [
                  { kind: "block", pathId: body.pathId },
                ]);
                if (undo)
                  (undo as Undo).removeEntryIds = changed.filter(
                    (id) => !entries.some((e) => e.id === id),
                  );
              } else if (input.operation === "remove") {
                const target = input.request.target;
                const removedNodes =
                  target.kind === "node" ? [requireNode(target.id)] : [];
                const removedEntries = entries.filter((e) =>
                  target.kind === "node"
                    ? e.node_id === target.id
                    : e.id === target.id,
                );
                if (target.kind === "entry" && !removedEntries.length)
                  throw new MapFailure("not_found");
                const levelKeys = [
                  ...removedNodes.map((n) => `node:${n.id}`),
                  ...removedEntries
                    .filter((e) => e.kind === "block")
                    .map((e) => `block:${e.id}`),
                ];
                if (target.kind === "entry")
                  affected.add(`node:${removedEntries[0]!.node_id}`);
                levelKeys.forEach((k) => affected.add(k));
                await captureUndo(removedNodes, removedEntries, [
                  ...levelKeys,
                  ...removedEntries.map((e) => `node:${e.node_id}`),
                ]);
                if (target.kind === "node")
                  await tx
                    .deleteFrom("learning_map_nodes")
                    .where("map_id", "=", map.id)
                    .where("id", "=", target.id)
                    .execute();
                else
                  await tx
                    .deleteFrom("learning_map_entries")
                    .where("map_id", "=", map.id)
                    .where("id", "=", target.id)
                    .execute();
                if (levelKeys.length)
                  await tx
                    .deleteFrom("learning_map_layouts")
                    .where("map_id", "=", map.id)
                    .where("level_key", "in", levelKeys)
                    .execute();
                changed.push(target.id);
              } else if (input.operation === "restore") {
                const receipt = await tx
                  .selectFrom("learning_mutation_receipts")
                  .select("response_json")
                  .where("user_id", "=", input.userId)
                  .where("idempotency_key", "=", input.request.undoReceiptKey)
                  .executeTakeFirst();
                const saved = receipt?.response_json as unknown as
                  | { mapUndo?: Undo }
                  | undefined;
                const inverse = saved?.mapUndo;
                if (
                  !inverse ||
                  Date.parse(inverse.expiresAt) < clock().getTime()
                )
                  throw new MapFailure("invalid_state");
                if (inverse.versionAfter !== map.row_version)
                  throw new MapFailure("version_conflict");
                if (
                  nodes.length + inverse.nodes.length > 200 ||
                  entries.length +
                    inverse.entries.length -
                    inverse.removeEntryIds.length >
                    5000
                )
                  throw new MapFailure("not_ready");
                await validateRefs(
                  tx,
                  input.userId,
                  inverse.entries.map(entryRef),
                );
                if (inverse.removeEntryIds.length)
                  await tx
                    .deleteFrom("learning_map_entries")
                    .where("map_id", "=", map.id)
                    .where("id", "in", inverse.removeEntryIds)
                    .execute();
                for (const n of inverse.nodes)
                  await tx
                    .insertInto("learning_map_nodes")
                    .values({ ...n, map_id: map.id })
                    .execute();
                for (const e of inverse.entries)
                  await tx
                    .insertInto("learning_map_entries")
                    .values({ ...e, map_id: map.id })
                    .execute();
                for (const l of inverse.layouts) {
                  const current = await tx
                    .selectFrom("learning_map_layouts")
                    .select("row_version")
                    .where("map_id", "=", map.id)
                    .where("level_key", "=", l.level_key)
                    .executeTakeFirst();
                  if (current && current.row_version !== l.row_version)
                    throw new MapFailure("version_conflict");
                  await tx
                    .insertInto("learning_map_layouts")
                    .values({
                      ...l,
                      map_id: map.id,
                      row_version: (current?.row_version ?? l.row_version) + 1,
                    })
                    .onConflict((c) =>
                      c
                        .columns(["map_id", "level_key"])
                        .doUpdateSet({
                          positions_json: l.positions_json,
                          row_version:
                            (current?.row_version ?? l.row_version) + 1,
                          updated_at: clock(),
                        }),
                    )
                    .execute();
                  affected.add(l.level_key);
                }
                changed.push(
                  ...inverse.nodes.map((n) => n.id),
                  ...inverse.entries.map((e) => e.id),
                );
              }
              await tx
                .updateTable("learning_maps")
                .set({
                  row_version: sql<number>`row_version + 1`,
                  updated_at: clock(),
                })
                .where("id", "=", map.id)
                .where("user_id", "=", input.userId)
                .execute();
              return {
                status: "success",
                value: {
                  ...base(),
                  structuralVersion: map.row_version + 1,
                  undo: undo
                    ? {
                        undoReceiptKey: input.idempotencyKey,
                        expiresAt: (undo as Undo).expiresAt,
                      }
                    : null,
                },
              };
            } catch (error) {
              if (!(error instanceof MapFailure)) throw error;
              await sql`rollback to savepoint map_change`.execute(tx);
              undo = null;
              return error.status === "not_ready"
                ? { status: "not_ready", issues: [] }
                : { status: error.status };
            } finally {
              await sql`release savepoint map_change`.execute(tx);
            }
          },
        );
        if (undo && result.status === "success")
          await tx
            .updateTable("learning_mutation_receipts")
            .set({
              response_json: {
                ...result,
                mapUndo: undo,
              } as unknown as JsonValue,
            })
            .where("user_id", "=", input.userId)
            .where("idempotency_key", "=", input.idempotencyKey)
            .execute();
        return result;
      });
    } catch (error) {
      if (error instanceof MapFailure)
        return error.status === "not_ready"
          ? { status: "not_ready", issues: [] }
          : { status: error.status };
      throw error;
    }
  };
}
