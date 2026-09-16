import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type QueryResult,
} from "kysely";
import type { CediahDatabase } from "../src/db/database.js";
import {
  decodeEditorContentCursor,
  encodeEditorContentCursor,
  listEditorContentIndex,
} from "../src/editor-content-index.js";

const pg = new PGlite();
const author = "41000000-0000-4000-8000-000000000001";
const targetGuide = "41000000-0000-4000-8000-000000000002";
const videoId = "41000000-0000-4000-8000-000000900001";
const linkedGuideId = "41000000-0000-4000-8000-000000900002";
const connection: DatabaseConnection = {
  async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
    const result = await pg.query<R>(query.sql, [...query.parameters]);
    return { rows: result.rows, numAffectedRows: BigInt(result.affectedRows ?? 0) };
  },
  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    yield { rows: [] };
  },
};
const database = new Kysely<CediahDatabase>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createIntrospector: (db) => new PostgresIntrospector(db),
    createQueryCompiler: () => new PostgresQueryCompiler(),
    createDriver: () => ({
      init: async () => {},
      destroy: async () => {},
      acquireConnection: async () => connection,
      releaseConnection: async () => {},
      beginTransaction: async () => { await pg.exec("begin"); },
      commitTransaction: async () => { await pg.exec("commit"); },
      rollbackTransaction: async () => { await pg.exec("rollback"); },
    }),
  },
});

const guideContent = (linkedVideoId: string | null = null) => JSON.stringify({
  document: null,
  keyPoints: [],
  linkedVideoId,
  quiz: { questions: [] },
  regions: ["Anatomía"],
  sections: [],
});

beforeAll(async () => {
  await pg.exec("create role cediah_runtime;");
  for (const file of [
    "0001_auth.sql",
    "0002_platform.sql",
    "0003_content.sql",
    "0004_subjects.sql",
    "0006_simplify_platform_roles.sql",
    "0009_learning_content_identity.sql",
    "0019_content_search.sql",
    "0020_content_search_function_hardening.sql",
    "0023_editor_content_search_index.sql",
  ]) {
    await pg.exec(
      `begin;\n${await readFile(new URL(`../../../database/migrations/${file}`, import.meta.url), "utf8")}\ncommit;`,
    );
  }

  await pg.query(
    "insert into auth_users (id, name, email) values ($1, 'Editor Index Author', 'editor-index@example.test')",
    [author],
  );

  await pg.query(
    `insert into content_items (
      id, kind, slug, title, summary, topic, content, author_user_id,
      status, catalog_visibility, updated_at
    ) values (
      $1, 'guide', 'guia-neurovascular-historica', 'Anatomía neurovascular histórica',
      'Una guía antigua que debe seguir siendo encontrable.', 'Anatomía', $2::jsonb, $3,
      'draft', 'catalog', '2020-01-01T00:00:00Z'
    )`,
    [targetGuide, guideContent(), author],
  );

  await pg.query(
    `insert into content_items (
      id, kind, slug, title, summary, topic, content, author_user_id,
      status, catalog_visibility, updated_at
    )
    select
      ('41000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
      'guide'::content_kind,
      'guia-relleno-' || series,
      'Guía de relleno ' || series,
      'Contenido editorial de prueba.',
      'Anatomía',
      '{"document":null,"keyPoints":[],"linkedVideoId":null,"quiz":{"questions":[]},"regions":["Anatomía"],"sections":[]}'::jsonb,
      $1,
      'draft'::course_status,
      'catalog'::catalog_visibility,
      now() + series * interval '1 minute'
    from generate_series(3, 205) as series`,
    [author],
  );

  await pg.query(
    `insert into content_items (
      id, kind, slug, title, summary, topic, content, author_user_id,
      status, catalog_visibility, updated_at
    ) values (
      $1, 'video', 'video-con-guia', 'Video con guía vinculada', 'Video de prueba.', 'Anatomía', $2::jsonb, $3,
      'draft', 'catalog', now() + interval '500 minutes'
    )`,
    [
      videoId,
      JSON.stringify({
        coverImageUrl: null,
        description: "Video de prueba.",
        durationSeconds: null,
        externalUrl: null,
        guide: { document: null, sections: [] },
        keyPoints: [],
        quiz: { questions: [] },
        regions: ["Anatomía"],
      }),
      author,
    ],
  );

  await pg.query(
    `insert into content_items (
      id, kind, slug, title, summary, topic, content, author_user_id,
      status, catalog_visibility, updated_at
    ) values (
      $1, 'guide', 'guia-vinculada-al-video', 'Guía vinculada al video', 'No cuenta como publicación independiente.',
      'Anatomía', $2::jsonb, $3, 'draft', 'catalog', now() + interval '501 minutes'
    )`,
    [linkedGuideId, guideContent(videoId), author],
  );
}, 30_000);

afterAll(async () => {
  await database.destroy();
  await pg.close();
});

describe("PostgreSQL editorial content index", () => {
  it("loads beyond the former 200-item cutoff and reports the real publication total", async () => {
    const response = await listEditorContentIndex(database, {
      actorUserId: author,
      canEditAll: true,
      limit: 500,
      scope: "all",
    });

    expect(response.items).toHaveLength(206);
    expect(response.index).toEqual({
      nextCursor: null,
      totalItems: 206,
      totalPublications: 205,
    });
  });

  it("paginates independent publications without duplicates or omissions", async () => {
    const ids = new Set<string>();
    let cursor: string | null = null;

    do {
      const response = await listEditorContentIndex(database, {
        actorUserId: author,
        canEditAll: true,
        cursor: cursor ? decodeEditorContentCursor(cursor) ?? undefined : undefined,
        limit: 100,
        scope: "publications",
      });
      for (const item of response.items) ids.add(item.id);
      cursor = response.index.nextCursor;
    } while (cursor);

    expect(ids.size).toBe(205);
    expect(ids.has(linkedGuideId)).toBe(false);
    expect(ids.has(videoId)).toBe(true);
    expect(ids.has(targetGuide)).toBe(true);
  });

  it("searches the full editorial corpus instead of only the loaded page", async () => {
    const response = await listEditorContentIndex(database, {
      actorUserId: author,
      canEditAll: true,
      limit: 20,
      query: "neurov",
      scope: "publications",
    });

    expect(response.index.totalPublications).toBe(1);
    expect(response.items.map((item) => item.id)).toEqual([targetGuide]);
  });

  it("round-trips stable cursors and rejects malformed values", () => {
    const cursor = {
      id: "41000000-0000-4000-8000-000000000123",
      updatedAt: "2026-09-16T12:34:56.000Z",
    };
    expect(decodeEditorContentCursor(encodeEditorContentCursor(cursor))).toEqual(cursor);
    expect(decodeEditorContentCursor("not-a-cursor")).toBeNull();
  });
});
