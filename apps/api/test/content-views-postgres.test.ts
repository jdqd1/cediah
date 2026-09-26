import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler, type CompiledQuery, type DatabaseConnection, type QueryResult } from "kysely";
import type { CediahDatabase } from "../src/db/database.js";
import { createPostgresContentProvider } from "../src/providers/postgres-content.js";

const pg = new PGlite();
const author = "10000000-0000-4000-8000-000000000099";
const video = "10000000-0000-4000-8000-000000000001";
const firstGuide = "10000000-0000-4000-8000-000000000002";
const secondGuide = "10000000-0000-4000-8000-000000000003";
const otherReader = "10000000-0000-4000-8000-000000000098";
const viewerKey = "a".repeat(64);
const connection: DatabaseConnection = {
  async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
    const result = await pg.query<R>(query.sql, [...query.parameters]);
    return { rows: result.rows, numAffectedRows: BigInt(result.affectedRows ?? 0) };
  },
  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> { yield { rows: [] }; },
};
const database = new Kysely<CediahDatabase>({ dialect: {
  createAdapter: () => new PostgresAdapter(),
  createIntrospector: (db) => new PostgresIntrospector(db),
  createQueryCompiler: () => new PostgresQueryCompiler(),
  createDriver: () => ({
    init: async () => {}, destroy: async () => {},
    acquireConnection: async () => connection, releaseConnection: async () => {},
    beginTransaction: async () => { await pg.exec("begin"); },
    commitTransaction: async () => { await pg.exec("commit"); },
    rollbackTransaction: async () => { await pg.exec("rollback"); },
  }),
} });
const provider = createPostgresContentProvider(database);
const record = (key = viewerKey) => provider.recordView!({ contentId: video, viewerKey: key });

beforeAll(async () => {
  await pg.exec("create role cediah_runtime;");
  for (const file of ["0001_auth.sql", "0002_platform.sql", "0003_content.sql", "0004_subjects.sql", "0006_simplify_platform_roles.sql", "0007_content_views.sql", "0009_learning_content_identity.sql", "0029_recent_guide_reading.sql"]) {
    await pg.exec(`begin;\n${await readFile(new URL(`../../../database/migrations/${file}`, import.meta.url), "utf8")}\ncommit;`);
  }
  await pg.query("insert into auth_users (id, name, email) values ($1, 'Test', 'views@example.test')", [author]);
  await pg.query("insert into auth_users (id, name, email) values ($1, 'Other', 'other-views@example.test')", [otherReader]);
  await pg.query(`insert into content_items (id, kind, slug, title, summary, topic, author_user_id, status, published_by, published_at)
    values ($1, 'video', 'test-video', 'Test', 'Summary', 'Topic', $2, 'published', $2, now())`, [video, author]);
  for (const [id, slug] of [[firstGuide, "first-guide"], [secondGuide, "second-guide"]]) {
    await pg.query(`insert into content_items (id, kind, slug, title, summary, topic, content, author_user_id, status, published_by, published_at)
      values ($1, 'guide', $2, $2, 'Study guide', 'Topic', $3::jsonb, $4, 'published', $4, now())`, [id, slug,
      JSON.stringify({ document: null, keyPoints: [], linkedVideoId: null, quiz: { questions: [] }, regions: [], sections: [{ heading: "Introduction", body: "Guide content" }] }), author]);
  }
  await pg.exec("grant select, update on content_items to cediah_runtime; grant select on content_assets, content_subjects to cediah_runtime;");
}, 30_000);
beforeEach(async () => { await pg.exec("reset role; truncate user_recent_guides, content_view_receipts, content_view_counts; set role cediah_runtime;"); });
afterAll(async () => { await database.destroy(); await pg.close(); });

describe("view receipts in PostgreSQL with runtime permissions", () => {
  it("resumes the latest available guide for each account", async () => {
    expect(await provider.getLastReadGuide?.(author)).toBeNull();
    await provider.recordView?.({ contentId: firstGuide, viewerKey: "c".repeat(64), userId: author });
    await provider.recordView?.({ contentId: secondGuide, viewerKey: "d".repeat(64), userId: author });
    expect((await provider.getLastReadGuide?.(author))?.id).toBe(secondGuide);
    expect(await provider.getLastReadGuide?.(otherReader)).toBeNull();
    await pg.exec("reset role; update content_items set status = 'archived' where id = '" + secondGuide + "'; set role cediah_runtime;");
    expect((await provider.getLastReadGuide?.(author))?.id).toBe(firstGuide);
    await pg.exec("reset role; update content_items set status = 'published' where id = '" + secondGuide + "'; set role cediah_runtime;");
  });

  it("counts once, returns current totals on retries and preserves the original receipt", async () => {
    const first = await record();
    expect(first).toMatchObject({ status: "success", value: { counted: true, viewCount: 1 } });
    expect(first.status === "success" && first.value.retryAfterMs).toBeGreaterThan(1_790_000);
    const timestamp = (await pg.query("select last_viewed_at::text from content_view_receipts")).rows;
    expect(await record()).toMatchObject({ status: "success", value: { counted: false, viewCount: 1 } });
    expect((await pg.query("select last_viewed_at::text from content_view_receipts")).rows).toEqual(timestamp);
    expect(await record("b".repeat(64))).toMatchObject({ status: "success", value: { counted: true, viewCount: 2 } });
    expect(await record()).toMatchObject({ status: "success", value: { counted: false, viewCount: 2 } });
  });

  it("returns the remaining window without extending it, then admits a later playback", async () => {
    await record();
    await pg.exec("update content_view_receipts set last_viewed_at = now() - interval '29 minutes';");
    const repeated = await record();
    expect(repeated).toMatchObject({ status: "success", value: { counted: false, viewCount: 1 } });
    if (repeated.status !== "success") throw new Error("Missing receipt");
    expect(repeated.value.retryAfterMs).toBeGreaterThan(55_000);
    expect(repeated.value.retryAfterMs).toBeLessThanOrEqual(60_000);
    await pg.exec("update content_view_receipts set last_viewed_at = now() - interval '31 minutes';");
    expect(await record()).toMatchObject({ status: "success", value: { counted: true, viewCount: 2 } });
    expect((await pg.query("select * from content_view_receipts")).rows).toHaveLength(1);
  });

  it("does not alter editorial versions and refuses unpublished content", async () => {
    const before = (await pg.query("select version, updated_at::text from content_items")).rows;
    await record();
    expect((await pg.query("select version, updated_at::text from content_items")).rows).toEqual(before);
    await pg.exec("reset role; update content_items set status = 'archived'; set role cediah_runtime;");
    expect(await record("b".repeat(64))).toEqual({ status: "not_found" });
    expect((await pg.query("select view_count::int from content_view_counts")).rows).toEqual([{ view_count: 1 }]);
    await pg.exec("reset role; update content_items set status = 'published'; set role cediah_runtime;");
  });
});
