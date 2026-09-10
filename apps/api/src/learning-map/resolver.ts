import { sql, type Selectable, type Transaction } from "kysely";
import {
  MapLayoutSchema,
  type LearningMapLevelResponse,
  type MapContentRef,
  type MapItem,
  type MapLesson,
  type MapRoute,
} from "@cediah/contracts";
import type {
  CediahDatabase,
  DatabaseClient,
  LearningMapEntryTable,
} from "../db/database.js";
import { aggregateMapProgress, type EssentialStep } from "./progress.js";

export type MapDatabase = DatabaseClient | Transaction<CediahDatabase>;
export const rootRoute: MapRoute = {
  nodeId: null,
  entryId: null,
  unitStableKey: null,
};
export function entryRef(
  e: Pick<
    Selectable<LearningMapEntryTable>,
    "kind" | "path_id" | "unit_stable_key"
  >,
): MapContentRef {
  return e.kind === "block"
    ? { kind: "block", pathId: e.path_id }
    : { kind: "lesson", pathId: e.path_id, unitStableKey: e.unit_stable_key! };
}

/** One batch per relation, irrespective of the number of repeated occurrences. No manifests or resource payloads. */
export async function resolveMapReferences(
  db: MapDatabase,
  userId: string,
  pathIds: string[],
) {
  const ids = [...new Set(pathIds)];
  const paths = ids.length
    ? await db
        .selectFrom("learning_paths")
        .innerJoin(
          "content_items as topic",
          "topic.id",
          "learning_paths.topic_content_id",
        )
        .select([
          "learning_paths.id",
          "learning_paths.title",
          "learning_paths.slug",
          "learning_paths.summary",
          "learning_paths.published_version_id",
          "learning_paths.archived_at",
          "learning_paths.topic_content_id",
          "topic.title as topic_title",
        ])
        .where("learning_paths.id", "in", ids)
        .execute()
    : [];
  const enrollments = ids.length
    ? await db
        .selectFrom("learning_enrollments")
        .selectAll()
        .where("user_id", "=", userId)
        .where("path_id", "in", ids)
        .execute()
    : [];
  const enrollmentByPath = new Map(enrollments.map((e) => [e.path_id, e]));
  const versions = [
    ...new Set(
      paths.flatMap((p) => {
        const e = enrollmentByPath.get(p.id);
        const v =
          e?.path_version_id ??
          (!p.archived_at ? p.published_version_id : null);
        return v ? [v] : [];
      }),
    ),
  ];
  const units = versions.length
    ? await db
        .selectFrom("learning_path_units")
        .select(["id", "path_version_id", "stable_key", "title", "position"])
        .where("path_version_id", "in", versions)
        .orderBy("position")
        .orderBy("id")
        .execute()
    : [];
  // Aggregate in SQL: one row per unit, even with thousands of map occurrences.
  // Since units partition path/version/step, deduplicating these weighted groups
  // is exactly the same union as deduplicating their essential step identities.
  const counts = versions.length
    ? (
        await sql<{
          unit_id: string;
          total: number;
          completed: number;
          step_count: number;
          started: boolean;
        }>`
    select s.unit_id, count(distinct s.id)::int as step_count,
      (count(distinct s.id) filter(where s.is_essential))::int as total,
      (count(distinct s.id) filter(where s.is_essential and p.state='completed'))::int as completed,
      bool_or(p.state in ('in_progress','completed') or a.step_id is not null) as started
    from learning_path_steps s
    left join learning_enrollments e on e.path_version_id=s.path_version_id and e.user_id=${userId}::uuid
    left join learning_step_progress p on p.enrollment_id=e.id and p.step_id=s.id and p.path_version_id=s.path_version_id
    left join (select distinct step_id from learning_attempts where user_id=${userId}::uuid and path_version_id in (${sql.join(versions)})) a on a.step_id=s.id
    where s.path_version_id in (${sql.join(versions)}) group by s.unit_id
  `.execute(db)
      ).rows
    : [];
  const countsByUnit = new Map(counts.map((c) => [c.unit_id, c]));
  const unitsByVersion = new Map<string, typeof units>();
  for (const unit of units) {
    const group = unitsByVersion.get(unit.path_version_id) ?? [];
    group.push(unit);
    unitsByVersion.set(unit.path_version_id, group);
  }
  const pathById = new Map(paths.map((p) => [p.id, p]));
  function resolve(ref: MapContentRef) {
    const path = pathById.get(ref.pathId);
    const enrollment = enrollmentByPath.get(ref.pathId);
    const versionId =
      enrollment?.path_version_id ??
      (path && !path.archived_at ? path.published_version_id : null);
    const pathUnits = unitsByVersion.get(versionId ?? "") ?? [];
    const selectedUnits =
      ref.kind === "lesson"
        ? pathUnits.filter((u) => u.stable_key === ref.unitStableKey)
        : pathUnits;
    const unavailable =
      !path ||
      !versionId ||
      Boolean(path.archived_at) ||
      (ref.kind === "lesson" && selectedUnits.length === 0);
    const essential: EssentialStep[] = selectedUnits.map((u) => {
      const c = countsByUnit.get(u.id);
      return {
        key: `${ref.pathId}:${versionId}:unit:${u.id}`,
        total: c?.total ?? 0,
        completedCount: c?.completed ?? 0,
        completed: Boolean(c && c.total > 0 && c.completed === c.total),
        started: c?.started ?? false,
      };
    });
    const stepCount = selectedUnits.reduce(
      (n, u) => n + (countsByUnit.get(u.id)?.step_count ?? 0),
      0,
    );
    return {
      path,
      enrollment,
      versionId,
      pathUnits,
      units: selectedUnits,
      stepCount,
      essential,
      unavailable,
    };
  }
  function item(ref: MapContentRef, occurrenceId: string): MapItem {
    const r = resolve(ref);
    const childCount = ref.kind === "block" ? r.units.length : r.stepCount;
    return {
      occurrenceId,
      canonicalKey:
        ref.kind === "block"
          ? ref.pathId
          : `${ref.pathId}:${ref.unitStableKey}`,
      kind: ref.kind,
      title: r.unavailable
        ? "Contenido no disponible"
        : ref.kind === "block"
          ? r.path!.title
          : r.units[0]!.title,
      iconKey: "folder",
      progress: aggregateMapProgress(r.essential, r.unavailable),
      childCount,
      childCountLabel: `${childCount} ${ref.kind === "block" ? "lecciones" : "actividades"}`,
      availability: r.unavailable
        ? r.path && !r.path.archived_at && r.versionId
          ? "version_missing"
          : "retired"
        : "available",
      enrollmentState: r.enrollment?.status ?? "none",
      pathId: ref.pathId,
      pathVersionId: r.versionId ?? null,
      unitStableKey: ref.kind === "lesson" ? ref.unitStableKey : null,
    };
  }
  async function lesson(ref: MapContentRef): Promise<MapLesson | null> {
    const r = resolve(ref);
    if (r.unavailable || ref.kind !== "lesson") return null;
    const steps = await db
      .selectFrom("learning_path_steps")
      .select(["id", "stable_key", "title", "is_essential"])
      .where("unit_id", "=", r.units[0]!.id)
      .where("path_version_id", "=", r.versionId!)
      .orderBy("position")
      .execute();
    const stepIds = steps.map((s) => s.id);
    const progress =
      r.enrollment && stepIds.length
        ? await db
            .selectFrom("learning_step_progress")
            .select(["step_id", "state"])
            .where("enrollment_id", "=", r.enrollment.id)
            .where("path_version_id", "=", r.versionId!)
            .where("step_id", "in", stepIds)
            .execute()
        : [];
    const attempts =
      r.enrollment && stepIds.length
        ? await db
            .selectFrom("learning_attempts")
            .select(["id", "step_id", "step_option_id", "status"])
            .where("user_id", "=", userId)
            .where("enrollment_id", "=", r.enrollment.id)
            .where("path_version_id", "=", r.versionId!)
            .where("step_id", "in", stepIds)
            .orderBy("updated_at", "desc")
            .execute()
        : [];
    const progressByStep = new Map(progress.map((p) => [p.step_id, p.state])),
      attempted = new Set(attempts.map((a) => a.step_id));
    const options = stepIds.length
      ? await db
          .selectFrom("learning_step_options")
          .innerJoin(
            "learning_resource_revisions as revision",
            "revision.id",
            "learning_step_options.resource_revision_id",
          )
          .innerJoin(
            "learning_resources as resource",
            "resource.id",
            "revision.resource_id",
          )
          .innerJoin(
            "content_items as source",
            "source.id",
            "learning_step_options.source_content_id",
          )
          .select([
            "learning_step_options.id",
            "learning_step_options.step_id",
            "learning_step_options.label",
            "learning_step_options.projection",
            "learning_step_options.estimated_minutes",
            "learning_step_options.is_default",
          ])
          .where("learning_step_options.step_id", "in", stepIds)
          .where("resource.retired_at", "is", null)
          .where("source.status", "=", "published")
          .orderBy("learning_step_options.position")
          .execute()
      : [];
    return {
      pathId: ref.pathId,
      pathSlug: r.path!.slug,
      pathVersionId: r.versionId!,
      unitStableKey: ref.unitStableKey,
      title: r.units[0]!.title,
      description: r.path!.summary,
      enrollmentId: r.enrollment?.id ?? null,
      enrollmentState: r.enrollment?.status ?? "none",
      enrollmentVersion: r.enrollment?.row_version ?? null,
      progress: aggregateMapProgress(r.essential),
      activities: steps.map((s) => ({
        id: s.id,
        stableKey: s.stable_key,
        title: s.title,
        isEssential: s.is_essential,
        state:
          progressByStep.get(s.id) ??
          (attempted.has(s.id) ? "in_progress" : "not_started"),
        options: options
          .filter((o) => o.step_id === s.id)
          .map((o) => ({
            id: o.id,
            label: o.label,
            projection: o.projection,
            estimatedMinutes: o.estimated_minutes,
            isDefault: o.is_default,
            existingAttemptId:
              attempts.find(
                (a) => a.step_option_id === o.id && a.status === "in_progress",
              )?.id ?? null,
          })),
      })),
    };
  }
  return { resolve, item, lesson, paths, versions };
}

export async function readMapLevel(
  db: MapDatabase,
  userId: string,
  route: MapRoute,
): Promise<LearningMapLevelResponse | null> {
  const map = await db
    .selectFrom("learning_maps")
    .selectAll()
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!map) return null;
  const nodes = await db
    .selectFrom("learning_map_nodes")
    .select(["id", "title", "icon_key", "sort_order"])
    .where("map_id", "=", map.id)
    .orderBy("sort_order")
    .orderBy("id")
    .execute();
  const entries = await db
    .selectFrom("learning_map_entries")
    .select(["id", "node_id", "path_id", "kind", "unit_stable_key", "sort_order"])
    .where("map_id", "=", map.id)
    .orderBy("sort_order")
    .orderBy("id")
    .execute();
  const node = nodes.find((n) => n.id === route.nodeId);
  const entry = entries.find(
    (e) => e.id === route.entryId && e.node_id === route.nodeId,
  );
  if (
    (route.nodeId && !node) ||
    (route.entryId && !entry) ||
    (route.unitStableKey && entry?.kind !== "block")
  )
    return null;
  const refs = await resolveMapReferences(
    db,
    userId,
    entries.map((e) => e.path_id),
  );
  const resolvedEntry = entry ? refs.resolve(entryRef(entry)) : null;
  if (
    route.unitStableKey &&
    !resolvedEntry?.units.some((u) => u.stable_key === route.unitStableKey)
  )
    return null;
  const levelKey =
    entry?.kind === "block"
      ? `block:${entry.id}`
      : node
        ? `node:${node.id}`
        : "root";
  const rawLayout = await db
    .selectFrom("learning_map_layouts")
    .selectAll()
    .where("map_id", "=", map.id)
    .where("level_key", "=", levelKey)
    .executeTakeFirst();
  const ancestry = [{ title: "Mi mapa", route: rootRoute }];
  if (node)
    ancestry.push({
      title: node.title,
      route: { nodeId: node.id, entryId: null, unitStableKey: null },
    });
  if (entry?.kind === "block")
    ancestry.push({
      title: refs.item(entryRef(entry), entry.id).title,
      route: { ...route, unitStableKey: null },
    });
  const currentEntries = node
    ? entries.filter((e) => e.node_id === node.id)
    : entries;
  const covered =
    entry?.kind === "block"
      ? [refs.resolve(entryRef(entry))]
      : currentEntries.map((e) => refs.resolve(entryRef(e)));
  const progress = aggregateMapProgress(
    covered.flatMap((r) => r.essential),
    covered.some((r) => r.unavailable),
  );
  let items: MapItem[];
  if (!node)
    items = nodes.map((n) => {
      const children = entries.filter((e) => e.node_id === n.id);
      const resolved = children.map((e) => refs.resolve(entryRef(e)));
      return {
        occurrenceId: n.id,
        canonicalKey: n.id,
        kind: "node",
        title: n.title,
        iconKey: n.icon_key,
        progress: aggregateMapProgress(
          resolved.flatMap((r) => r.essential),
          resolved.some((r) => r.unavailable),
        ),
        childCount: children.length,
        childCountLabel: `${children.length} contenidos`,
        availability: "available",
        enrollmentState: "none",
        pathId: null,
        pathVersionId: null,
        unitStableKey: null,
      };
    });
  else if (entry?.kind === "block")
    items = (resolvedEntry?.units ?? []).map((u) =>
      refs.item(
        { kind: "lesson", pathId: entry.path_id, unitStableKey: u.stable_key },
        `lesson:${u.stable_key}`,
      ),
    );
  else items = currentEntries.map((e) => refs.item(entryRef(e), e.id));
  const selectedRef: MapContentRef | null =
    entry?.kind === "lesson"
      ? entryRef(entry)
      : entry && route.unitStableKey
        ? {
            kind: "lesson",
            pathId: entry.path_id,
            unitStableKey: route.unitStableKey,
          }
        : null;
  const selectedLesson = selectedRef ? await refs.lesson(selectedRef) : null;
  const activities = selectedLesson?.activities ?? [];
  const next =
    activities.find((a) => a.options.some((o) => o.existingAttemptId)) ??
    activities.find(
      (a) => a.isEssential && a.state !== "completed" && a.state !== "skipped",
    ) ??
    activities.find((a) => a.isEssential && a.state === "skipped");
  const nextOption =
    next?.options.find((o) => o.existingAttemptId) ??
    next?.options.find((o) => o.isDefault) ??
    next?.options[0];
  const edges: LearningMapLevelResponse["edges"] =
    entry?.kind === "block"
      ? items
          .slice(1)
          .map((i, index) => ({
            sourceOccurrenceId: items[index]!.occurrenceId,
            targetOccurrenceId: i.occurrenceId,
            kind: "sequence",
            provenance: "published_unit_order",
            label: "Orden recomendado; acceso libre",
          }))
      : [];
  if (entry?.kind !== "block") {
    const topics = new Map<string, Set<string>>();
    for (const e of currentEntries) {
      const id = node ? e.id : e.node_id;
      const topic = refs.resolve(entryRef(e)).path?.topic_content_id;
      if (topic) {
        const set = topics.get(id) ?? new Set<string>();
        set.add(topic);
        topics.set(id, set);
      }
    }
    const counts = new Map<string, number>();
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]!.occurrenceId,
          b = items[j]!.occurrenceId;
        if ((counts.get(a) ?? 0) >= 2 || (counts.get(b) ?? 0) >= 2) continue;
        if ([...(topics.get(a) ?? [])].some((t) => topics.get(b)?.has(t))) {
          edges.push({
            sourceOccurrenceId: a,
            targetOccurrenceId: b,
            kind: "related",
            provenance: "shared_topic",
            label: "Comparten tema",
          });
          counts.set(a, (counts.get(a) ?? 0) + 1);
          counts.set(b, (counts.get(b) ?? 0) + 1);
        }
      }
  }
  const allowed = new Set(items.map((i) => i.occurrenceId));
  const layout = MapLayoutSchema.parse({
    schemaVersion: 1,
    levelKey,
    rowVersion: rawLayout?.row_version ?? 0,
    positions: rawLayout?.positions_json ?? {},
  });
  layout.positions = Object.fromEntries(
    Object.entries(layout.positions).filter(([id]) => allowed.has(id)),
  );
  return {
    mapId: map.id,
    structuralVersion: map.row_version,
    route,
    levelKey,
    ancestry,
    layout,
    items,
    edges,
    selectedLesson,
    containerSummary: {
      title:
        ancestry.at(-1)!.title === "Mi mapa"
          ? "Mi mapa de aprendizaje"
          : ancestry.at(-1)!.title,
      description:
        entry?.kind === "block"
          ? (resolvedEntry?.path?.summary ?? "")
          : "Organiza tu aprendizaje y elige tu próximo paso.",
      progress,
    },
    nextActivity:
      next && nextOption
        ? {
            stepId: next.id,
            optionId: nextOption.id,
            reason: nextOption.existingAttemptId
              ? "Retoma la actividad en curso"
              : "Siguiente actividad esencial pendiente",
          }
        : null,
    generatedAt: new Date().toISOString(),
    resolvedVersionIds: refs.versions,
  };
}
