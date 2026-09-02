import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler, type CompiledQuery, type DatabaseConnection, type QueryResult } from "kysely";
import type { CediahDatabase } from "../src/db/database.js";
import { createPostgresContentProvider } from "../src/providers/postgres-content.js";

const authorId = "10000000-0000-4000-8000-000000000099";
const videoId = "10000000-0000-4000-8000-000000000001";
const guideId = "10000000-0000-4000-8000-000000000002";
const draftId = "10000000-0000-4000-8000-000000000003";
const viewerKey = "a".repeat(64);
const migration = new URL("../../../database/migrations/0008_content_reactions.sql", import.meta.url);
const pg = new PGlite();
const statements: string[] = [];

// A single-connection test dialect runs the real provider SQL, constraints and
// policies in PostgreSQL/WASM. No production database or network is used.
const connection: DatabaseConnection = {
  async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
    statements.push(query.sql);
    const result = await pg.query<R>(query.sql, [...query.parameters]);
    return { rows: result.rows, numAffectedRows: BigInt(result.affectedRows ?? 0) };
  },
  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> { yield { rows: [] }; },
};
let connectionQueue = Promise.resolve();
let releaseConnection: () => void = () => {};
const database = new Kysely<CediahDatabase>({ dialect: {
  createAdapter: () => new PostgresAdapter(),
  createIntrospector: (db) => new PostgresIntrospector(db),
  createQueryCompiler: () => new PostgresQueryCompiler(),
  createDriver: () => ({
    init: async () => {}, destroy: async () => {},
    acquireConnection: async () => {
      const previous = connectionQueue;
      let release: () => void = () => {};
      connectionQueue = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      releaseConnection = release;
      return connection;
    },
    releaseConnection: async () => releaseConnection(),
    beginTransaction: async () => { await pg.exec("begin"); },
    commitTransaction: async () => { await pg.exec("commit"); },
    rollbackTransaction: async () => { await pg.exec("rollback"); },
  }),
} });
const provider = createPostgresContentProvider(database);
const react = (reaction: "liked" | "disliked" | null, key = viewerKey, contentId = videoId) =>
  provider.setReaction!({ contentId, reaction, viewerKey: key });

async function counts() {
  const result = await pg.query<{ likes: number; dislikes: number }>(
    "select like_count::int as likes, dislike_count::int as dislikes from content_reaction_counts where content_item_id = $1", [videoId],
  );
  return result.rows[0] ?? { likes: 0, dislikes: 0 };
}

beforeAll(async () => {
  await pg.exec("create role cediah_runtime; create role anon; create role authenticated; create role service_role bypassrls; alter default privileges in schema public grant all on tables to anon, authenticated, service_role;");
  for (const file of ["0001_auth.sql", "0002_platform.sql", "0003_content.sql", "0004_subjects.sql", "0006_simplify_platform_roles.sql", "0007_content_views.sql"]) {
    await pg.exec(`begin;\n${await readFile(new URL(`../../../database/migrations/${file}`, import.meta.url), "utf8")}\ncommit;`);
  }
  await pg.query("insert into auth_users (id, name, email) values ($1, 'Local test', 'reactions@example.test')", [authorId]);
  for (const [id, kind, status] of [[videoId, "video", "published"], [guideId, "guide", "published"], [draftId, "video", "draft"]]) {
    await pg.query(`insert into content_items (id, kind, slug, title, summary, topic, author_user_id, status, published_by, published_at)
      values ($1, $2, $3, 'Test', 'Test summary', 'Test', $4, $5, $4, now())`,
    [id, kind, `test-${kind}-${status}`, authorId, status]);
  }
  await pg.exec(`begin;\n${await readFile(migration, "utf8")}\ncommit;`);
  await pg.exec("grant select, update on content_items to cediah_runtime; set role cediah_runtime;");
}, 30_000);

beforeEach(async () => {
  await pg.exec("reset role; truncate content_reactions, content_reaction_counts; set role cediah_runtime;");
  statements.length = 0;
});

afterAll(async () => { await database.destroy(); await pg.close(); });

describe("persistent video reactions", () => {
  it("starts empty and reads only the viewer's choice, without aggregate totals", async () => {
    expect(await provider.getReaction!({ contentId: videoId, viewerKey })).toEqual({ status: "success", value: { reaction: null } });
    await react("liked");
    expect(await provider.getReaction!({ contentId: videoId, viewerKey })).toEqual({ status: "success", value: { reaction: "liked" } });
    expect(await provider.getReaction!({ contentId: videoId, viewerKey: "b".repeat(64) })).toEqual({ status: "success", value: { reaction: null } });
  });

  it("deduplicates likes and retains one current row per viewer/video", async () => {
    await react("liked");
    await react("liked");
    expect(await counts()).toEqual({ likes: 1, dislikes: 0 });
    expect((await pg.query("select * from content_reactions")).rows).toHaveLength(1);
  });

  it("switches likes/dislikes and removes either choice without negative totals", async () => {
    await react("liked");
    await react("disliked");
    expect(await counts()).toEqual({ likes: 0, dislikes: 1 });
    await react("liked");
    expect(await counts()).toEqual({ likes: 1, dislikes: 0 });
    await react(null);
    await react(null);
    expect(await counts()).toEqual({ likes: 0, dislikes: 0 });
    await react("disliked");
    await react(null);
    expect(await counts()).toEqual({ likes: 0, dislikes: 0 });
    expect((await pg.query("select * from content_reactions")).rows).toHaveLength(0);
  });

  it("aggregates independent viewers and locks totals before reading the old choice", async () => {
    await Promise.all([react("liked"), react("disliked", "b".repeat(64)), react("liked", "c".repeat(64))]);
    expect(await counts()).toEqual({ likes: 2, dislikes: 1 });
    const lock = statements.findIndex((query) => query.includes('"content_reaction_counts"') && query.endsWith("for update"));
    const oldChoice = statements.findIndex((query) => query.startsWith('select "reaction" from "content_reactions"'));
    expect(lock).toBeGreaterThan(-1);
    expect(oldChoice).toBeGreaterThan(lock);
  });

  it("rejects drafts, guides and missing videos without storing reactions", async () => {
    for (const contentId of [guideId, draftId, "10000000-0000-4000-8000-000000000004"]) {
      expect(await react("liked", viewerKey, contentId)).toEqual({ status: "not_found" });
      expect(await provider.getReaction!({ contentId, viewerKey })).toEqual({ status: "not_found" });
    }
    expect((await pg.query("select * from content_reaction_counts")).rows).toHaveLength(0);
  });

  it("does not alter content timestamps, versions or view counts", async () => {
    const before = (await pg.query("select version, updated_at::text from content_items where id = $1", [videoId])).rows;
    await react("liked");
    await react("disliked");
    expect((await pg.query("select version, updated_at::text from content_items where id = $1", [videoId])).rows).toEqual(before);
    expect((await pg.query("select * from content_view_counts")).rows).toHaveLength(0);
  });

  it("rolls back both the choice and its count when the aggregate write fails", async () => {
    await pg.exec("reset role; alter table content_reaction_counts add constraint test_no_likes check (like_count = 0); set role cediah_runtime;");
    try {
      await expect(react("liked")).rejects.toThrow("test_no_likes");
      expect((await pg.query("select * from content_reactions")).rows).toHaveLength(0);
      expect(await counts()).toEqual({ likes: 0, dislikes: 0 });
    } finally {
      await pg.exec("reset role; alter table content_reaction_counts drop constraint test_no_likes; set role cediah_runtime;");
    }
  });

  it("denies inherited Data API grants, including roles that bypass RLS", async () => {
    await react("liked");
    for (const role of ["anon", "authenticated", "service_role"]) {
      await pg.exec(`reset role; set role ${role};`);
      await expect(pg.query("select * from content_reactions")).rejects.toThrow("permission denied");
      await expect(pg.query("select * from content_reaction_counts")).rejects.toThrow("permission denied");
    }
    await pg.exec("reset role; grant select on content_reactions, content_reaction_counts to anon; set role anon;");
    expect((await pg.query("select * from content_reactions")).rows).toHaveLength(0);
    expect((await pg.query("select * from content_reaction_counts")).rows).toHaveLength(0);
    await pg.exec("reset role; revoke all on content_reactions, content_reaction_counts from anon; set role cediah_runtime;");
  });

  it("uses cascade cleanup for a deleted publication", async () => {
    await react("liked");
    await pg.exec("reset role; begin;");
    try {
      await pg.query("delete from content_items where id = $1", [videoId]);
      expect((await pg.query("select * from content_reactions")).rows).toHaveLength(0);
      expect((await pg.query("select * from content_reaction_counts")).rows).toHaveLength(0);
    } finally {
      await pg.exec("rollback; set role cediah_runtime;");
    }
  });
});
