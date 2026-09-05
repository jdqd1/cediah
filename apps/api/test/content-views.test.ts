import { describe, expect, it } from "vitest";
import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler, type CompiledQuery, type DatabaseConnection, type QueryResult } from "kysely";
import type { CediahDatabase } from "../src/db/database.js";
import { createPostgresContentProvider } from "../src/providers/postgres-content.js";

function recordingDatabase({ duplicate = false, published = true } = {}) {
  const statements: CompiledQuery[] = [];
  const connection: DatabaseConnection = {
    async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
      statements.push(query);
      const rows = query.sql.startsWith('select "id" from "content_items"')
        ? published ? [{ id: "content-id" }] : []
        : query.sql.startsWith('insert into "content_view_receipts"') && !duplicate ? [{ content_item_id: "content-id" }]
          : query.sql.startsWith('select "content_view_counts"') ? [{ view_count: "7", retry_after_ms: 1_500_000 }] : [];
      return { rows: rows as R[] };
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
      beginTransaction: async () => {}, commitTransaction: async () => {}, rollbackTransaction: async () => {},
    }),
  } });
  return { database, statements };
}

describe("aggregated content view persistence", () => {
  it("deduplicates atomically and increments only a counter, not editorial timestamps", async () => {
    const { database, statements } = recordingDatabase();
    const provider = createPostgresContentProvider(database);
    expect(await provider.recordView?.({ contentId: "content-id", viewerKey: "opaque" })).toEqual({ status: "success", value: { counted: true, viewCount: 7, retryAfterMs: 1_500_000 } });
    expect(statements[1]?.sql).toContain('on conflict ("content_item_id", "viewer_key")');
    expect(statements[1]?.sql).toContain("interval '30 minutes'");
    expect(statements[2]?.sql).toContain("content_view_counts.view_count + 1");
    expect(statements.some((query) => query.sql.includes('update "content_items"'))).toBe(false);
    await database.destroy();
  });
  it("does not increment a repeated view or accept unpublished content", async () => {
    for (const options of [{ duplicate: true }, { published: false }]) {
      const { database, statements } = recordingDatabase(options);
      const result = await createPostgresContentProvider(database).recordView?.({ contentId: "content-id", viewerKey: "opaque" });
      expect(result).toEqual(options.duplicate ? { status: "success", value: { counted: false, viewCount: 7, retryAfterMs: 1_500_000 } } : { status: "not_found" });
      expect(statements.some((query) => query.sql.startsWith('insert into "content_view_counts"'))).toBe(false);
      await database.destroy();
    }
  });
  it("orders the full published catalog by views before limiting the result", async () => {
    const { database, statements } = recordingDatabase();
    await createPostgresContentProvider(database).listPublished({ sort: "views", limit: 8 });
    expect(statements[0]?.sql).toMatch(/order by coalesce\(content_view_counts.view_count, 0\) desc, "content_items"\."published_at" desc/);
    expect(statements[0]?.parameters).toContain("published");
    expect(statements[0]?.parameters.at(-1)).toBe(8);
    await database.destroy();
  });
});
