import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  LearningMapLevelResponseSchema,
  type LearningMapProvider,
  type MapMutation,
  type LearningMapMutationResponse,
} from "@cediah/contracts";
import { createLearningMapTestDb } from "./helpers/learning-map-db.js";
import { createPostgresLearningMapProvider } from "../src/providers/postgres-learning-map.js";
const user = randomUUID(),
  other = randomUUID(),
  topic = randomUUID(),
  path = randomUUID(),
  version = randomUUID();
let harness: Awaited<ReturnType<typeof createLearningMapTestDb>>,
  provider: LearningMapProvider;
let now = new Date("2026-09-08T12:00:00Z");
let state: LearningMapMutationResponse, nodeId: string, lessonEntry: string;
const mutate = (m: MapMutation, idempotencyKey = randomUUID()) =>
  provider.mutate({ ...m, userId: user, idempotencyKey });
beforeAll(async () => {
  harness = await createLearningMapTestDb();
  const db = harness.database;
  await db
    .insertInto("auth_users")
    .values([
      { id: user, name: "Map test", email: "map@example.test" },
      { id: other, name: "Other", email: "othermap@example.test" },
    ])
    .execute();
  await harness.pg.query(
    "insert into content_items (id,kind,slug,title,summary,topic,content,author_user_id,status,published_by,published_at) values ($1,'topic','map-fixture','Tema','Fixture','Tema','{}',$2,'published',$2,now())",
    [topic, user],
  );
  await db
    .insertInto("learning_paths")
    .values({
      id: path,
      created_by: user,
      topic_content_id: topic,
      title: "Bloque prueba",
      slug: "bloque-prueba",
      summary: "Fixture",
      cover_key: "heart" as const,
    })
    .execute();
  await db
    .insertInto("learning_path_versions")
    .values({
      id: version,
      path_id: path,
      version_number: 1,
      policy_version: "guided-v1",
      release_notes: "fixture",
      status: "published",
      published_at: now,
      published_by: user,
    })
    .execute();
  await db
    .updateTable("learning_paths")
    .set({ published_version_id: version })
    .where("id", "=", path)
    .execute();
  for (let i = 0; i < 2; i++) {
    const unit = await db
      .insertInto("learning_path_units")
      .values({
        path_version_id: version,
        stable_key: `lesson-${i}`,
        title: `Lección ${i}`,
        position: i,
        objectives_json: "[]",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db
      .insertInto("learning_path_steps")
      .values({
        unit_id: unit.id,
        path_version_id: version,
        stable_key: `step-${i}`,
        title: "Actividad",
        position: 0,
        purpose: "understand",
        objective_ids_json: "[]",
        recommended_after_json: "[]",
      })
      .execute();
  }
  provider = createPostgresLearningMapProvider(db, { clock: () => now });
}, 30_000);
afterAll(async () => {
  await harness?.close();
});
describe("private persistent map", () => {
  it("GET is read-only; ensure replays without duplicating", async () => {
    expect((await provider.summary(user)).map).toBeNull();
    const key = randomUUID();
    const first = await mutate({ operation: "ensure", request: {} }, key);
    expect(first.status).toBe("success");
    if (first.status !== "success") return;
    state = first.value;
    expect(await mutate({ operation: "ensure", request: {} }, key)).toEqual(
      first,
    );
    expect((await provider.summary(other)).map).toBeNull();
  });
  it("adds references without enrolling; duplicate identity is stable", async () => {
    const created = await mutate({
      operation: "nodes",
      request: {
        expectedVersion: state.structuralVersion,
        title: "Mi nodo",
        iconKey: "heart",
        items: [{ kind: "lesson", pathId: path, unitStableKey: "lesson-0" }],
      },
    });
    expect(created.status).toBe("success");
    if (created.status !== "success") return;
    state = created.value;
    nodeId = state.changedIds[0]!;
    lessonEntry = state.changedIds[1]!;
    const level = await provider.level(user, {
      nodeId,
      entryId: lessonEntry,
      unitStableKey: null,
    });
    expect(LearningMapLevelResponseSchema.safeParse(level).success).toBe(true);
    expect(level?.selectedLesson?.progress.totalEssentialSteps).toBe(1);
    expect(
      await harness.database
        .selectFrom("learning_enrollments")
        .selectAll()
        .execute(),
    ).toHaveLength(0);
    const duplicate = await mutate({
      operation: "entries",
      request: {
        expectedVersion: state.structuralVersion,
        nodeId,
        ref: { kind: "lesson", pathId: path, unitStableKey: "lesson-0" },
      },
    });
    expect(duplicate.status).toBe("success");
    if (duplicate.status === "success") state = duplicate.value;
    expect(
      (
        await provider.level(user, {
          nodeId,
          entryId: null,
          unitStableKey: null,
        })
      )?.items,
    ).toHaveLength(1);
  });
  it("isolates accounts and rejects structural and idempotency conflicts", async () => {
    expect(
      await provider.level(other, {
        nodeId,
        entryId: null,
        unitStableKey: null,
      }),
    ).toBeNull();
    const bad = await mutate({
      operation: "entries",
      request: {
        expectedVersion: 1,
        nodeId,
        ref: { kind: "block", pathId: path },
      },
    });
    expect(bad.status).toBe("version_conflict");
    const key = randomUUID();
    await mutate({ operation: "ensure", request: {} }, key);
    expect(
      (
        await mutate(
          {
            operation: "remove",
            request: {
              expectedVersion: state.structuralVersion,
              target: { kind: "node", id: nodeId },
            },
          },
          key,
        )
      ).status,
    ).toBe("idempotency_conflict");
  });
  it("keeps layout version independent and rejects foreign positions", async () => {
    const key = randomUUID();
    const request = {
      levelKey: "root",
      expectedVersion: 0,
      positions: [{ id: nodeId, x: 123.5, y: -42 }],
    };
    const saved = await mutate({ operation: "layout", request }, key);
    expect(saved.status).toBe("success");
    expect(await mutate({ operation: "layout", request }, key)).toEqual(saved);
    expect((await mutate({ operation: "layout", request })).status).toBe(
      "version_conflict",
    );
    expect(
      (
        await mutate({
          operation: "layout",
          request: {
            ...request,
            expectedVersion: 1,
            positions: [{ id: other, x: 0, y: 0 }],
          },
        })
      ).status,
    ).toBe("not_found");
    const root = await provider.level(user, {
      nodeId: null,
      entryId: null,
      unitStableKey: null,
    });
    expect(root?.layout.positions[nodeId]).toEqual({ x: 123.5, y: -42 });
    expect(root?.structuralVersion).toBe(state.structuralVersion);
  });
  it("completes grouping and undoes it without awarding progress", async () => {
    const done = await mutate({
      operation: "complete-block",
      request: {
        expectedVersion: state.structuralVersion,
        nodeId,
        pathId: path,
      },
    });
    expect(done.status).toBe("success");
    if (done.status !== "success") return;
    state = done.value;
    expect(
      (
        await provider.level(user, {
          nodeId,
          entryId: null,
          unitStableKey: null,
        })
      )?.containerSummary.progress,
    ).toMatchObject({ totalEssentialSteps: 2, completedEssentialSteps: 0 });
    const restored = await mutate({
      operation: "restore",
      request: {
        expectedVersion: state.structuralVersion,
        undoReceiptKey: state.undo!.undoReceiptKey,
      },
    });
    expect(restored.status).toBe("success");
    if (restored.status === "success") state = restored.value;
    expect(
      (
        await provider.level(user, {
          nodeId,
          entryId: null,
          unitStableKey: null,
        })
      )?.items[0]?.occurrenceId,
    ).toBe(lessonEntry);
  });
  it("paginates the catalog without repeated identities and marks coverage", async () => {
    const first = await provider.catalog(user, {
      kind: "all",
      q: "leccion",
      limit: 1,
      node: nodeId,
    });
    expect(first?.items).toHaveLength(1);
    expect(first?.items[0]?.membership).toBe("direct");
    const second = await provider.catalog(user, {
      kind: "all",
      q: "leccion",
      limit: 1,
      node: nodeId,
      cursor: first!.nextCursor!,
    });
    expect(second?.items).toHaveLength(1);
    expect(second?.items[0]?.key).not.toBe(first?.items[0]?.key);
    expect(second?.nextCursor).toBeNull();
    expect(
      (
        await provider.suggestions(user, {
          nodeId,
          entryId: null,
          unitStableKey: null,
        })
      )?.incompleteBlocks,
    ).toEqual([
      {
        pathId: path,
        title: "Bloque prueba",
        addedLessons: 1,
        totalLessons: 2,
      },
    ]);
  });
  it("rejects every foreign mutation without changing the owner map", async () => {
    const own = await provider.mutate({
      operation: "ensure",
      request: {},
      userId: other,
      idempotencyKey: randomUUID(),
    });
    expect(own.status).toBe("success");
    if (own.status !== "success") return;
    const expectedVersion = own.value.structuralVersion;
    const attempts: (MapMutation & { nodeId?: string })[] = [
      {
        operation: "updateNode",
        nodeId,
        request: { expectedVersion, title: "Intrusión" },
      },
      {
        operation: "entries",
        request: {
          expectedVersion,
          nodeId,
          ref: { kind: "block", pathId: path },
        },
      },
      {
        operation: "complete-block",
        request: { expectedVersion, nodeId, pathId: path },
      },
      {
        operation: "remove",
        request: { expectedVersion, target: { kind: "node", id: nodeId } },
      },
      {
        operation: "group",
        request: {
          expectedVersion,
          title: "Copia",
          iconKey: "folder",
          route: { nodeId: null, entryId: null, unitStableKey: null },
          selections: [{ rootNodeId: nodeId }],
        },
      },
      {
        operation: "layout",
        request: {
          expectedVersion: 0,
          levelKey: `node:${nodeId}`,
          positions: [{ id: lessonEntry, x: 1, y: 1 }],
        },
      },
    ];
    for (const mutation of attempts)
      expect(
        (
          await provider.mutate({
            ...mutation,
            userId: other,
            idempotencyKey: randomUUID(),
          })
        ).status,
      ).toBe("not_found");
    expect((await provider.summary(user)).structuralVersion).toBe(
      state.structuralVersion,
    );
  });
  it("groups references without changing originals or double-counting global progress", async () => {
    const grouped = await mutate({
      operation: "group",
      request: {
        expectedVersion: state.structuralVersion,
        title: "Repaso",
        iconKey: "folder",
        route: { nodeId: null, entryId: null, unitStableKey: null },
        selections: [{ rootNodeId: nodeId }],
      },
    });
    expect(grouped.status).toBe("success");
    if (grouped.status !== "success") return;
    state = grouped.value;
    const root = await provider.summary(user);
    expect(root.nodes).toHaveLength(2);
    expect(root.progress.totalEssentialSteps).toBe(1);
    expect(
      (
        await provider.level(user, {
          nodeId,
          entryId: null,
          unitStableKey: null,
        })
      )?.items[0]?.occurrenceId,
    ).toBe(lessonEntry);
    const removed = await mutate({
      operation: "remove",
      request: {
        expectedVersion: state.structuralVersion,
        target: { kind: "node", id: grouped.value.changedIds[0]! },
      },
    });
    if (removed.status === "success") state = removed.value;
  });
  it("resolves pinned versions, excludes skipped progress and flags missing stable keys after upgrade", async () => {
    const db = harness.database;
    const enrollment = await db.transaction().execute(async (tx) => {
      const row = await tx
        .insertInto("learning_enrollments")
        .values({
          user_id: user,
          path_id: path,
          path_version_id: version,
          status: "paused",
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      await tx
        .insertInto("learning_enrollment_versions")
        .values({
          enrollment_id: row.id,
          path_id: path,
          path_version_id: version,
          previous_version_id: null,
        })
        .execute();
      return row;
    });
    const step = await db
      .selectFrom("learning_path_steps")
      .select("id")
      .where("path_version_id", "=", version)
      .where("stable_key", "=", "step-0")
      .executeTakeFirstOrThrow();
    await db
      .insertInto("learning_step_progress")
      .values({
        enrollment_id: enrollment.id,
        path_version_id: version,
        step_id: step.id,
        state: "skipped",
      })
      .execute();
    expect((await provider.summary(user)).progress.percentage).toBe(0);
    await db
      .updateTable("learning_step_progress")
      .set({
        state: "completed",
        completed_at: now,
        completion_method: "self_reported",
      })
      .where("enrollment_id", "=", enrollment.id)
      .execute();
    expect((await provider.summary(user)).progress.percentage).toBe(100);
    const nextVersion = randomUUID();
    await db
      .insertInto("learning_path_versions")
      .values({
        id: nextVersion,
        path_id: path,
        version_number: 2,
        policy_version: "guided-v1",
        release_notes: "fixture",
        status: "published",
        published_at: now,
        published_by: user,
      })
      .execute();
    await db
      .updateTable("learning_paths")
      .set({ published_version_id: nextVersion })
      .where("id", "=", path)
      .execute();
    const route = { nodeId, entryId: lessonEntry, unitStableKey: null };
    expect(
      (await provider.level(user, route))?.selectedLesson?.pathVersionId,
    ).toBe(version);
    await db
      .insertInto("learning_enrollment_versions")
      .values({
        enrollment_id: enrollment.id,
        path_id: path,
        path_version_id: nextVersion,
        previous_version_id: version,
      })
      .execute();
    await db
      .updateTable("learning_enrollments")
      .set({ path_version_id: nextVersion })
      .where("id", "=", enrollment.id)
      .execute();
    const upgraded = await provider.level(user, route);
    expect(upgraded?.selectedLesson).toBeNull();
    expect(upgraded?.items[0]?.availability).toBe("version_missing");
    expect(upgraded?.containerSummary.progress.percentage).toBeNull();
    await db
      .updateTable("learning_paths")
      .set({ published_version_id: version })
      .where("id", "=", path)
      .execute();
    await db
      .updateTable("learning_enrollments")
      .set({ path_version_id: version })
      .where("id", "=", enrollment.id)
      .execute();
  });
  it("removal undo expires and ensure never reimports", async () => {
    const removed = await mutate({
      operation: "remove",
      request: {
        expectedVersion: state.structuralVersion,
        target: { kind: "node", id: nodeId },
      },
    });
    expect(removed.status).toBe("success");
    if (removed.status !== "success") return;
    state = removed.value;
    now = new Date(now.getTime() + 31_000);
    expect(
      (
        await mutate({
          operation: "restore",
          request: {
            expectedVersion: state.structuralVersion,
            undoReceiptKey: state.undo!.undoReceiptKey,
          },
        })
      ).status,
    ).toBe("invalid_state");
    await mutate({ operation: "ensure", request: {} });
    expect((await provider.summary(user)).nodes).toHaveLength(0);
  });
  it("enables RLS and strips inherited browser grants", async () => {
    const rows = await harness.pg.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where relname in ('learning_maps','learning_map_nodes','learning_map_entries','learning_map_layouts')",
    );
    expect(rows.rows).toHaveLength(4);
    expect(rows.rows.every((r) => r.relrowsecurity)).toBe(true);
    const grants = await harness.pg.query<{ allowed: boolean }>(
      "select has_table_privilege('anon','learning_maps','SELECT') as allowed",
    );
    expect(grants.rows[0]?.allowed).toBe(false);
  });
  it("reads 5,000 references as one current level with bounded query count", async () => {
    const db = harness.database,
      mapId = (await provider.summary(user)).map!.id;
    const paths = Array.from({ length: 25 }, (_, i) => ({
      id: randomUUID(),
      created_by: user,
      topic_content_id: topic,
      title: `Volumen ${i}`,
      slug: `volumen-${i}`,
      summary: "Fixture de volumen",
      cover_key: "heart" as const,
    }));
    await db.insertInto("learning_paths").values(paths).execute();
    const versions = paths.map((p) => ({
      id: randomUUID(),
      path_id: p.id,
      version_number: 1,
      policy_version: "guided-v1",
      release_notes: "fixture",
      status: "published" as const,
      published_at: now,
      published_by: user,
    }));
    await db.insertInto("learning_path_versions").values(versions).execute();
    for (const v of versions)
      await db
        .updateTable("learning_paths")
        .set({ published_version_id: v.id })
        .where("id", "=", v.path_id)
        .execute();
    const units = versions.map((v) => ({
      id: randomUUID(),
      path_version_id: v.id,
      stable_key: "unit",
      title: "Lección",
      position: 0,
      objectives_json: "[]",
    }));
    await db.insertInto("learning_path_units").values(units).execute();
    await db
      .insertInto("learning_path_steps")
      .values(
        units.map((u) => ({
          unit_id: u.id,
          path_version_id: u.path_version_id,
          stable_key: "step",
          title: "Actividad",
          position: 0,
          purpose: "understand" as const,
          objective_ids_json: "[]",
          recommended_after_json: "[]",
        })),
      )
      .execute();
    const nodes = Array.from({ length: 200 }, (_, i) => ({
      id: randomUUID(),
      map_id: mapId,
      title: `Nodo ${i}`,
      icon_key: "folder" as const,
      sort_order: i,
    }));
    await db.insertInto("learning_map_nodes").values(nodes).execute();
    await db
      .insertInto("learning_map_entries")
      .values(
        nodes.flatMap((n) =>
          paths.map((p, i) => ({
            map_id: mapId,
            node_id: n.id,
            path_id: p.id,
            kind: "block" as const,
            unit_stable_key: null,
            sort_order: i,
          })),
        ),
      )
      .execute();
    const timings: number[] = [],
      counts: number[] = [];
    for (let i = 0; i < 35; i++) {
      const before = harness.queryCount,
        start = performance.now();
      const level = await provider.level(user, {
        nodeId: null,
        entryId: null,
        unitStableKey: null,
      });
      if (i >= 5) {
        timings.push(performance.now() - start);
        counts.push(harness.queryCount - before);
      }
      expect(level?.items).toHaveLength(200);
      expect(level?.containerSummary.progress.totalEssentialSteps).toBe(25);
      expect(JSON.stringify(level)).not.toMatch(
        /manifest_json|signedUrl|correctOptionIndex/,
      );
    }
    const p95 = timings.sort((a, b) => a - b)[
      Math.ceil(timings.length * 0.95) - 1
    ]!;
    expect(Math.max(...counts)).toBeLessThanOrEqual(10);
    const output = new URL("../.map-test-results/", import.meta.url);
    await mkdir(output, { recursive: true });
    await writeFile(
      new URL("root-performance.json", output),
      JSON.stringify(
        {
          benchmark: "map-root",
          engine: "PGlite",
          references: 5000,
          visibleLevel: 200,
          samples: 30,
          p95Ms: Math.round(p95),
          queriesPerRead: Math.max(...counts),
        },
        null,
        2,
      ),
    );
  }, 60_000);
});
