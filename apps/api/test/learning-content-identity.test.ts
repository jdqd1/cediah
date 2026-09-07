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
import { createLearningContentResolver } from "../src/guided-learning/content-resolver.js";
import { createPostgresContentProvider } from "../src/providers/postgres-content.js";

const pg = new PGlite();
const authorId = "10000000-0000-4000-8000-000000000099";
const visibleId = "10000000-0000-4000-8000-000000000001";
const guidedId = "10000000-0000-4000-8000-000000000002";

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
      acquireConnection: async () => connection,
      beginTransaction: async () => { await pg.exec("begin"); },
      commitTransaction: async () => { await pg.exec("commit"); },
      destroy: async () => {},
      init: async () => {},
      releaseConnection: async () => {},
      rollbackTransaction: async () => { await pg.exec("rollback"); },
    }),
  },
});

const provider = createPostgresContentProvider(database);
const resolver = createLearningContentResolver(database);

async function applyMigration(file: string) {
  const sql = await readFile(
    new URL(`../../../database/migrations/${file}`, import.meta.url),
    "utf8",
  );
  await pg.exec(`begin;\n${sql}\ncommit;`);
}

beforeAll(async () => {
  await pg.exec(
    "create role cediah_runtime; create role anon; create role authenticated; " +
      "alter default privileges in schema public grant all on tables to anon, authenticated;",
  );
  for (const file of [
    "0001_auth.sql",
    "0002_platform.sql",
    "0003_content.sql",
    "0004_subjects.sql",
    "0006_simplify_platform_roles.sql",
    "0007_content_views.sql",
    "0008_content_reactions.sql",
  ]) {
    await applyMigration(file);
  }
  await pg.query(
    "insert into auth_users (id, name, email) values ($1, 'Test', 'identity@example.test')",
    [authorId],
  );
  const content = {
    document: null,
    keyPoints: ["Punto verificable"],
    linkedVideoId: null,
    quiz: {
      questions: [
        {
          correctOptionIndex: 1,
          explanation: "Explicación",
          options: ["Distractor", "Respuesta"],
          prompt: "Pregunta estable",
        },
      ],
    },
    regions: ["Tórax"],
    sections: [{ body: "Contenido", heading: "Sección" }],
  };
  for (const [id, slug] of [[visibleId, "visible-guide"], [guidedId, "guided-guide"]]) {
    await pg.query(
      `insert into content_items
        (id, kind, slug, title, summary, topic, content, author_user_id, status, published_by, published_at)
       values ($1, 'guide', $2, 'Guía', 'Resumen', 'Tórax', $3, $4, 'published', $4, now())`,
      [id, slug, content, authorId],
    );
  }
  await applyMigration("0009_learning_content_identity.sql");
  await pg.query(
    "update content_items set catalog_visibility = 'guided_only' where id = $1",
    [guidedId],
  );
}, 30_000);

afterAll(async () => {
  await database.destroy();
  await pg.close();
});

describe("learning content identity migration", () => {
  it("adds stable item and option identities without changing authored material", async () => {
    const result = await pg.query<{
      content: {
        quiz: { questions: Array<Record<string, unknown>> };
      };
      version: number;
    }>("select content, version from content_items where id = $1", [visibleId]);
    const row = result.rows[0];
    const question = row?.content.quiz.questions[0];

    expect(row?.version).toBe(2);
    expect(question).toMatchObject({
      correctOptionIndex: 1,
      explanation: "Explicación",
      memoryVersion: 1,
      options: ["Distractor", "Respuesta"],
      prompt: "Pregunta estable",
    });
    expect(question?.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(question?.optionIds).toEqual([
      expect.stringMatching(/^[0-9a-f-]{36}$/i),
      expect.stringMatching(/^[0-9a-f-]{36}$/i),
    ]);
  });

  it("is idempotent when normalization is evaluated again", async () => {
    const result = await pg.query<{ content: unknown; normalized: unknown }>(
      `select content,
        private.normalize_learning_content_identity(content, kind) as normalized
       from content_items where id = $1`,
      [visibleId],
    );
    expect(result.rows[0]?.normalized).toEqual(result.rows[0]?.content);
  });

  it("hides guided-only material from every generic provider lookup", async () => {
    const catalog = await provider.listPublished({ limit: 20 });
    expect(catalog.map((item) => item.id)).toContain(visibleId);
    expect(catalog.map((item) => item.id)).not.toContain(guidedId);
    expect(await provider.getPublishedBySlug("guided-guide")).toBeNull();
  });

  it("freezes immutable revisions and never exposes quiz answers or card backs", async () => {
    const quiz = await resolver.resolvePublishedRevision({
      allowGuidedOnly: false,
      projection: "quiz",
      sourceContentId: visibleId,
    });
    expect(quiz.status).toBe("success");
    if (quiz.status !== "success") throw new Error("Expected a quiz revision");

    const publicQuestion = (quiz.value.studentPayload as {
      questions: Array<Record<string, unknown>>;
    }).questions[0];
    expect(publicQuestion).toMatchObject({ prompt: "Pregunta estable" });
    expect(publicQuestion).not.toHaveProperty("correctOptionIndex");
    expect(publicQuestion).not.toHaveProperty("correctOptionId");
    expect(publicQuestion).not.toHaveProperty("explanation");

    const repeated = await resolver.resolvePublishedRevision({
      allowGuidedOnly: false,
      projection: "quiz",
      sourceContentId: visibleId,
    });
    expect(repeated.status).toBe("success");
    if (repeated.status !== "success") throw new Error("Expected an existing revision");
    expect(repeated.value.resourceRevisionId).toBe(quiz.value.resourceRevisionId);

    const cards = await resolver.resolvePublishedRevision({
      allowGuidedOnly: false,
      projection: "flashcards",
      sourceContentId: visibleId,
    });
    expect(cards.status).toBe("success");
    if (cards.status !== "success") throw new Error("Expected a card revision");
    expect((cards.value.studentPayload as { cards: Array<Record<string, unknown>> }).cards[0])
      .toEqual({
        front: "Pregunta estable",
        itemId: publicQuestion?.itemId,
      });
    expect((cards.value.studentPayload as { cards: Array<Record<string, unknown>> }).cards[0])
      .not.toHaveProperty("back");

    const revisionCount = await pg.query<{ count: string }>(
      "select count(*)::text as count from learning_resource_revisions where resource_id = $1",
      [quiz.value.resourceId],
    );
    expect(revisionCount.rows[0]?.count).toBe("1");
  });

  it("only resolves guided-only material through an explicitly privileged call", async () => {
    expect(await resolver.resolvePublishedRevision({
      allowGuidedOnly: false,
      projection: "quiz",
      sourceContentId: guidedId,
    })).toEqual({ status: "not_found" });
    expect((await resolver.resolvePublishedRevision({
      allowGuidedOnly: true,
      projection: "quiz",
      sourceContentId: guidedId,
    })).status).toBe("success");
  });

  it("revokes inherited Data API access to private learning tables", async () => {
    for (const role of ["anon", "authenticated"]) {
      await pg.exec(`set role ${role};`);
      await expect(pg.query("select * from learning_resources")).rejects.toThrow(
        "permission denied",
      );
      await expect(pg.query("select * from learning_items")).rejects.toThrow(
        "permission denied",
      );
      await pg.exec("reset role;");
    }
  });
});
