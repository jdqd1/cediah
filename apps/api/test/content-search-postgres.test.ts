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
import { searchPublishedContent } from "../src/content-search.js";

const pg = new PGlite();
const author = "30000000-0000-4000-8000-000000000001";
const targetGuide = "30000000-0000-4000-8000-000000000002";
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
  ]) {
    await pg.exec(
      `begin;\n${await readFile(new URL(`../../../database/migrations/${file}`, import.meta.url), "utf8")}\ncommit;`,
    );
  }

  await pg.query(
    "insert into auth_users (id, name, email) values ($1, 'Search Author', 'search@example.test')",
    [author],
  );
  await pg.query(
    `insert into content_items (
      id, kind, slug, title, summary, topic, content, author_user_id,
      status, published_by, published_at, catalog_visibility
    ) values (
      $1, 'guide', 'guia-triangulo-carotideo', 'Guía anatómica del cuello',
      'Material clínico del cuello.', 'Anatomía', $2::jsonb, $3,
      'published', $3, now() - interval '1 year', 'catalog'
    )`,
    [
      targetGuide,
      JSON.stringify({
        document: {
          type: "doc",
          content: [{
            type: "paragraph",
            content: [{
              type: "text",
              text: "El triángulo carotídeo contiene un paquete neurovascular profundo.",
            }],
          }],
        },
        keyPoints: [],
        linkedVideoId: null,
        quiz: { questions: [] },
        regions: ["Cuello"],
        sections: [],
      }),
      author,
    ],
  );

  await pg.query(
    `insert into content_items (
      id, kind, slug, title, summary, topic, content, author_user_id,
      status, published_by, published_at, catalog_visibility
    )
    select
      ('30000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
      'guide'::content_kind,
      'guia-relleno-' || series,
      'Guía de relleno ' || series,
      'Contenido de prueba.',
      'Anatomía',
      '{"document":null,"keyPoints":[],"linkedVideoId":null,"quiz":{"questions":[]},"regions":[],"sections":[]}'::jsonb,
      $1,
      'published'::course_status,
      $1,
      now() + series * interval '1 minute',
      'catalog'::catalog_visibility
    from generate_series(10, 128) as series`,
    [author],
  );

  await pg.exec("grant select on content_items to cediah_runtime;");
  await pg.exec("set role cediah_runtime;");
}, 30_000);

afterAll(async () => {
  await pg.exec("reset role;");
  await database.destroy();
  await pg.close();
});

describe("PostgreSQL published-content search", () => {
  it("matches prefixes and preserves accented source excerpts", async () => {
    const response = await searchPublishedContent(database, { query: "triang carot" });

    expect(response.guides[0]).toMatchObject({
      id: targetGuide,
      kind: "guide",
      excerptType: "content",
      href: "/guias/guia-triangulo-carotideo",
    });
    expect(response.guides[0]?.excerpt).toContain("triángulo carotídeo");
  });

  it("finds an old publication even when more than 100 newer guides exist", async () => {
    const response = await searchPublishedContent(database, { query: "neurovascularprof" });

    expect(response.guides.map((guide) => guide.id)).toContain(targetGuide);
  });

  it("keeps the result payload bounded", async () => {
    const response = await searchPublishedContent(database, { query: "guia" });

    expect(response.guides.length).toBeLessThanOrEqual(4);
    expect(response.videos.length).toBeLessThanOrEqual(4);
  });
});
