import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const pg = new PGlite();
const authorId = "41000000-0000-4000-8000-000000000001";
const guideId = "41000000-0000-4000-8000-000000000002";

async function migration(name: string) {
  return readFile(new URL(`../../../database/migrations/${name}`, import.meta.url), "utf8");
}

beforeAll(async () => {
  for (const file of [
    "0001_auth.sql",
    "0002_platform.sql",
    "0003_content.sql",
    "0009_learning_content_identity.sql",
    "0024_interactive_guide_terms.sql",
    "0025_interactive_term_invalidation.sql",
  ]) {
    await pg.exec(`begin;\n${await migration(file)}\ncommit;`);
  }

  await pg.query(
    "insert into auth_users (id, name, email) values ($1, 'Term Author', 'terms@example.test')",
    [authorId],
  );
  await pg.query(
    `insert into content_items (
      id, kind, slug, title, summary, topic, content, author_user_id,
      status, published_by, published_at, catalog_visibility
    ) values (
      $1, 'guide', 'guia-terminos-prueba', 'Guía de términos', 'Prueba de términos',
      'Anatomía', $2::jsonb, $3, 'published', $3, now(), 'catalog'
    )`,
    [
      guideId,
      JSON.stringify({
        document: {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: "Vascularización" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "La arteria mesentérica superior irriga el intestino medio." }],
            },
          ],
        },
        keyPoints: [],
        linkedVideoId: null,
        quiz: { questions: [] },
        regions: ["Abdomen"],
        sections: [],
      }),
      authorId,
    ],
  );
}, 30_000);

afterAll(async () => {
  await pg.close();
});

describe("interactive-term migrations", () => {
  it("queues published guides for precomputed indexing", async () => {
    const queue = await pg.query<{ content_item_id: string; reason: string }>(
      "select content_item_id, reason from guide_term_reindex_queue where content_item_id = $1",
      [guideId],
    );

    expect(queue.rows[0]).toMatchObject({
      content_item_id: guideId,
      reason: "guide_published_or_changed",
    });
  });

  it("increments dictionary revision for matching changes but not definition-only edits", async () => {
    const before = await pg.query<{ revision: string | number }>(
      "select revision from interactive_term_dictionary_state where singleton = true",
    );
    const beforeRevision = Number(before.rows[0]?.revision);

    const inserted = await pg.query<{ id: string }>(
      `insert into interactive_terms (slug, name, short_definition, category)
       values ('arteria-mesenterica-superior', 'Arteria mesentérica superior', 'Rama impar de la aorta abdominal.', 'Anatomía')
       returning id`,
    );
    const termId = inserted.rows[0]!.id;
    const afterInsert = await pg.query<{ revision: string | number }>(
      "select revision from interactive_term_dictionary_state where singleton = true",
    );
    expect(Number(afterInsert.rows[0]?.revision)).toBe(beforeRevision + 1);

    await pg.query(
      "update interactive_terms set short_definition = 'Rama anterior de la aorta abdominal que irriga gran parte del intestino medio.' where id = $1",
      [termId],
    );
    const afterDefinition = await pg.query<{ revision: string | number }>(
      "select revision from interactive_term_dictionary_state where singleton = true",
    );
    expect(Number(afterDefinition.rows[0]?.revision)).toBe(beforeRevision + 1);

    await pg.query(
      "update interactive_terms set priority = priority + 1 where id = $1",
      [termId],
    );
    const afterPriority = await pg.query<{ revision: string | number }>(
      "select revision from interactive_term_dictionary_state where singleton = true",
    );
    expect(Number(afterPriority.rows[0]?.revision)).toBe(beforeRevision + 2);
  });
});
