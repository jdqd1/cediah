import type { FastifyInstance } from "fastify";
import { sql } from "kysely";
import { z } from "zod";
import {
  StudyCatalogItemSchema,
  StudyCatalogResponseSchema,
  StudyCatalogKindSchema,
  SubjectStudyCatalogResponseSchema,
  type StudyCatalogItem,
} from "@cediah/contracts";
import type { DatabaseClient, JsonValue } from "./db/database.js";

const maxStudyCatalogLimit = 2_000;
const publicStudyCatalogLimit = 1_000;

const StudyCatalogQuerySchema = z.object({
  kind: StudyCatalogKindSchema.optional(),
  limit: z.coerce.number().int().min(1).max(publicStudyCatalogLimit).default(500),
  sort: z.enum(["recent", "views"]).optional(),
});

const SubjectSlugParamsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

type StudyCatalogQuery = {
  kind?: z.infer<typeof StudyCatalogKindSchema>;
  limit?: number;
  sort?: "recent" | "views";
  subjectId?: string;
};

function toIsoString(value: Date | string) {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function regionsFromJson(value: JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

export async function loadPublishedStudyCatalog(
  database: DatabaseClient,
  input: StudyCatalogQuery = {},
): Promise<StudyCatalogItem[]> {
  const limit = Math.min(Math.max(input.limit ?? 500, 1), maxStudyCatalogLimit);
  const rows = await database
    .selectFrom("content_items")
    .$if(Boolean(input.subjectId), (query) =>
      query
        .innerJoin(
          "content_subjects",
          "content_subjects.content_item_id",
          "content_items.id",
        )
        .where("content_subjects.subject_id", "=", input.subjectId ?? ""),
    )
    .leftJoin(
      "content_view_counts",
      "content_view_counts.content_item_id",
      "content_items.id",
    )
    .select([
      "content_items.estimated_minutes",
      "content_items.id",
      "content_items.is_featured",
      "content_items.kind",
      "content_items.published_at",
      "content_items.slug",
      "content_items.summary",
      "content_items.title",
      "content_items.topic",
      "content_items.updated_at",
      sql<JsonValue>`coalesce(content_items.content->'regions', '[]'::jsonb)`.as("regions"),
      sql<string | null>`case
        when content_items.kind = 'guide' then nullif(content_items.content->>'linkedVideoId', '')
        else null
      end`.as("linked_video_id"),
      sql<boolean>`case
        when content_items.kind = 'video' then
          coalesce(jsonb_array_length(content_items.content->'guide'->'sections'), 0) > 0
          or coalesce(jsonb_array_length(content_items.content->'guide'->'document'->'content'), 0) > 0
        else false
      end`.as("has_embedded_guide"),
      sql<boolean>`case
        when content_items.kind in ('video', 'guide') then
          coalesce(jsonb_array_length(content_items.content->'quiz'->'questions'), 0) > 0
        when content_items.kind = 'quiz' then
          coalesce(jsonb_array_length(content_items.content->'questions'), 0) > 0
        else false
      end`.as("has_quiz"),
      sql<boolean>`case
        when content_items.kind in ('video', 'guide') then
          coalesce(jsonb_array_length(content_items.content->'quiz'->'questions'), 0) > 0
        when content_items.kind = 'flashcards' then
          coalesce(jsonb_array_length(content_items.content->'cards'), 0) > 0
        else false
      end`.as("has_flashcards"),
      sql<string[]>`coalesce(
        (
          select array_agg(link.subject_id::text order by link.subject_id)
          from public.content_subjects as link
          where link.content_item_id = content_items.id
        ),
        '{}'::text[]
      )`.as("subject_ids"),
      sql<number>`coalesce(content_view_counts.view_count, 0)`.as("view_count"),
    ])
    .where("content_items.status", "=", "published")
    .where("content_items.catalog_visibility", "=", "catalog")
    .$if(Boolean(input.kind), (query) =>
      query.where("content_items.kind", "=", input.kind ?? "topic"),
    )
    .$if(input.sort === "views", (query) =>
      query.orderBy(sql<number>`coalesce(content_view_counts.view_count, 0)`, "desc"),
    )
    .orderBy("content_items.published_at", "desc")
    .orderBy("content_items.id", "asc")
    .limit(limit)
    .execute();

  return rows.map((row) => StudyCatalogItemSchema.parse({
    estimatedMinutes: row.estimated_minutes,
    featured: row.is_featured,
    hasEmbeddedGuide: row.has_embedded_guide,
    hasFlashcards: row.has_flashcards,
    hasQuiz: row.has_quiz,
    id: row.id,
    kind: row.kind,
    linkedVideoId: row.linked_video_id,
    publishedAt: row.published_at ? toIsoString(row.published_at) : null,
    regions: regionsFromJson(row.regions),
    slug: row.slug,
    subjectIds: row.subject_ids,
    summary: row.summary,
    title: row.title,
    topic: row.topic,
    updatedAt: toIsoString(row.updated_at),
    viewCount: Number(row.view_count),
  }));
}

async function loadSubject(database: DatabaseClient, slug: string) {
  return database
    .selectFrom("subjects")
    .select([
      "subjects.id",
      "subjects.name",
      "subjects.slug",
      sql<number>`(
        select count(*)::integer
        from public.content_subjects as link
        inner join public.content_items as item on item.id = link.content_item_id
        where link.subject_id = subjects.id
          and item.status = 'published'
          and item.catalog_visibility = 'catalog'
      )`.as("content_count"),
    ])
    .where("subjects.slug", "=", slug)
    .executeTakeFirst();
}

export function registerPublishedStudyCatalogRoutes(
  app: FastifyInstance,
  database: DatabaseClient | undefined,
) {
  app.get<{ Querystring: unknown }>("/v1/study/catalog", async (request, reply) => {
    if (!database) {
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }
    const query = StudyCatalogQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).header("Cache-Control", "no-store").send({ error: "invalid_content_query" });
    }

    try {
      const items = await loadPublishedStudyCatalog(database, query.data);
      return reply
        .header("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
        .send(StudyCatalogResponseSchema.parse({ items }));
    } catch (error) {
      request.log.error({ err: error }, "Published study-catalog request failed");
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }
  });

  app.get<{ Params: { slug: string } }>("/v1/study/subjects/:slug", async (request, reply) => {
    if (!database) {
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }
    const params = SubjectSlugParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
    }

    try {
      const subject = await loadSubject(database, params.data.slug);
      if (!subject) {
        return reply.status(404).header("Cache-Control", "no-store").send({ error: "not_found" });
      }

      const subjectItems = await loadPublishedStudyCatalog(database, {
        limit: maxStudyCatalogLimit,
        subjectId: subject.id,
      });
      const videoIds = new Set(
        subjectItems.filter((item) => item.kind === "video").map((item) => item.id),
      );
      let linkedGuides: StudyCatalogItem[] = [];
      if (videoIds.size > 0) {
        const guides = await loadPublishedStudyCatalog(database, {
          kind: "guide",
          limit: maxStudyCatalogLimit,
        });
        linkedGuides = guides.filter(
          (guide) => guide.linkedVideoId && videoIds.has(guide.linkedVideoId),
        );
      }

      const itemsById = new Map(subjectItems.map((item) => [item.id, item]));
      for (const guide of linkedGuides) itemsById.set(guide.id, guide);

      return reply
        .header("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
        .send(SubjectStudyCatalogResponseSchema.parse({
          items: [...itemsById.values()],
          subject: {
            contentCount: Number(subject.content_count),
            id: subject.id,
            name: subject.name,
            slug: subject.slug,
          },
        }));
    } catch (error) {
      request.log.error({ err: error }, "Published subject study-catalog request failed");
      return reply.status(503).header("Cache-Control", "no-store").send({ error: "content_unavailable" });
    }
  });
}
