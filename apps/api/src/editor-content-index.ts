import { sql } from "kysely";
import {
  ContentDraftSchema,
  ContentItemSchema,
  ContentTopicSchema,
  SubjectSchema,
  type ContentItem,
  type ContentKind,
  type ContentStatus,
  type ContentTopic,
  type Subject,
} from "@cediah/contracts";
import type { DatabaseClient, JsonValue } from "./db/database.js";

function toIso(value: Date | string) {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function stringArray(value: JsonValue | null) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function compactContent(input: {
  externalUrl: string | null;
  kind: ContentKind;
  linkedVideoId: string | null;
  regions: JsonValue | null;
}) {
  const regions = stringArray(input.regions);
  if (input.kind === "video") {
    return {
      description: "",
      durationSeconds: null,
      externalUrl: input.externalUrl,
      guide: { document: null, sections: [] },
      keyPoints: [],
      quiz: { questions: [] },
      regions,
    };
  }
  if (input.kind === "guide") {
    return {
      document: null,
      keyPoints: [],
      linkedVideoId: input.linkedVideoId,
      quiz: { questions: [] },
      regions,
      sections: [],
    };
  }
  if (input.kind === "quiz") return { questions: [], regions };
  if (input.kind === "flashcards") return { cards: [], regions };
  return { introduction: "", objectives: [], regions };
}

type IndexRow = {
  author_user_id: string;
  catalog_visibility: "catalog" | "hidden";
  created_at: Date | string;
  estimated_minutes: number | null;
  external_url: string | null;
  id: string;
  is_featured: boolean;
  kind: ContentKind;
  linked_video_id: string | null;
  published_at: Date | string | null;
  regions: JsonValue | null;
  slug: string;
  status: ContentStatus;
  summary: string;
  title: string;
  topic: string;
  updated_at: Date | string;
};

async function subjectIdsByContent(database: DatabaseClient, ids: string[]) {
  if (ids.length === 0) return new Map<string, string[]>();
  const rows = await database
    .selectFrom("content_subjects")
    .select(["content_item_id", "subject_id"])
    .where("content_item_id", "in", ids)
    .execute();
  const byContent = new Map<string, string[]>();
  for (const row of rows) {
    byContent.set(row.content_item_id, [
      ...(byContent.get(row.content_item_id) ?? []),
      row.subject_id,
    ]);
  }
  return byContent;
}

async function latestAssetsByContent(database: DatabaseClient, ids: string[]) {
  if (ids.length === 0) return new Map<string, {
    content_item_id: string;
    id: string;
    kind: "video" | "document" | "image";
    mime_type: string;
    original_file_name: string;
    size_bytes: string;
    status: "pending" | "ready";
  }>();
  const assets = await database
    .selectFrom("content_assets")
    .select([
      "content_item_id",
      "created_at",
      "id",
      "kind",
      "mime_type",
      "original_file_name",
      "size_bytes",
      "status",
    ])
    .where("content_item_id", "in", ids)
    .execute();
  assets.sort((left, right) => {
    if (left.status !== right.status) return left.status === "ready" ? -1 : 1;
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
  const byContent = new Map<string, (typeof assets)[number]>();
  for (const asset of assets) {
    if (!byContent.has(asset.content_item_id)) byContent.set(asset.content_item_id, asset);
  }
  return byContent;
}

function compactItem(
  row: IndexRow,
  subjectIds: string[],
  asset: Awaited<ReturnType<typeof latestAssetsByContent>> extends Map<string, infer T> ? T | undefined : never,
): ContentItem {
  return ContentItemSchema.parse({
    asset: asset
      ? {
          contentId: asset.content_item_id,
          downloadUrl: null,
          fileName: asset.original_file_name,
          id: asset.id,
          kind: asset.kind,
          mimeType: asset.mime_type,
          sizeBytes: Number(asset.size_bytes),
          status: asset.status,
        }
      : null,
    authorUserId: row.author_user_id,
    catalogVisibility: row.catalog_visibility,
    content: compactContent({
      externalUrl: row.external_url,
      kind: row.kind,
      linkedVideoId: row.linked_video_id,
      regions: row.regions,
    }),
    createdAt: toIso(row.created_at),
    estimatedMinutes: row.estimated_minutes,
    featured: row.is_featured,
    id: row.id,
    kind: row.kind,
    publishedAt: row.published_at ? toIso(row.published_at) : null,
    slug: row.slug,
    status: row.status,
    subjectIds,
    summary: row.summary,
    title: row.title,
    topic: row.topic,
    updatedAt: toIso(row.updated_at),
  });
}

export async function listEditorContentIndex(
  database: DatabaseClient,
  input: { actorUserId: string; canEditAll: boolean },
): Promise<ContentItem[]> {
  const result = await sql<IndexRow>`
    select
      item.author_user_id,
      item.catalog_visibility,
      item.created_at,
      item.estimated_minutes,
      nullif(item.content ->> 'externalUrl', '') as external_url,
      item.id,
      item.is_featured,
      item.kind,
      nullif(item.content ->> 'linkedVideoId', '') as linked_video_id,
      item.published_at,
      case
        when jsonb_typeof(item.content -> 'regions') = 'array' then item.content -> 'regions'
        else '[]'::jsonb
      end as regions,
      item.slug,
      item.status,
      item.summary,
      item.title,
      item.topic,
      item.updated_at
    from public.content_items as item
    where (${input.canEditAll} or item.author_user_id = ${input.actorUserId})
    order by item.updated_at desc, item.id asc
    limit 200
  `.execute(database);
  const ids = result.rows.map((row) => row.id);
  const [subjects, assets] = await Promise.all([
    subjectIdsByContent(database, ids),
    latestAssetsByContent(database, ids),
  ]);
  return result.rows.map((row) => compactItem(
    row,
    subjects.get(row.id) ?? [],
    assets.get(row.id),
  ));
}

export async function getEditorContentItem(
  database: DatabaseClient,
  input: { actorUserId: string; canEditAll: boolean; contentId: string },
): Promise<ContentItem | null> {
  const row = await database
    .selectFrom("content_items")
    .selectAll()
    .where("id", "=", input.contentId)
    .$if(!input.canEditAll, (query) => query.where("author_user_id", "=", input.actorUserId))
    .executeTakeFirst();
  if (!row) return null;

  const [subjects, assets] = await Promise.all([
    subjectIdsByContent(database, [row.id]),
    latestAssetsByContent(database, [row.id]),
  ]);
  const draft = ContentDraftSchema.parse({
    catalogVisibility: row.catalog_visibility,
    content: row.content,
    estimatedMinutes: row.estimated_minutes,
    featured: row.is_featured,
    kind: row.kind,
    slug: row.slug,
    subjectIds: subjects.get(row.id) ?? [],
    summary: row.summary,
    title: row.title,
    topic: row.topic,
  });
  const asset = assets.get(row.id);
  return ContentItemSchema.parse({
    ...draft,
    asset: asset
      ? {
          contentId: asset.content_item_id,
          downloadUrl: null,
          fileName: asset.original_file_name,
          id: asset.id,
          kind: asset.kind,
          mimeType: asset.mime_type,
          sizeBytes: Number(asset.size_bytes),
          status: asset.status,
        }
      : null,
    authorUserId: row.author_user_id,
    createdAt: toIso(row.created_at),
    id: row.id,
    publishedAt: row.published_at ? toIso(row.published_at) : null,
    status: row.status,
    updatedAt: toIso(row.updated_at),
  });
}

export async function listEditorSubjects(database: DatabaseClient): Promise<Subject[]> {
  const rows = await database
    .selectFrom("subjects")
    .leftJoin("content_subjects", "content_subjects.subject_id", "subjects.id")
    .leftJoin("content_items", "content_items.id", "content_subjects.content_item_id")
    .select([
      "subjects.id as id",
      "subjects.name as name",
      "subjects.slug as slug",
      sql<number>`count(content_items.id)::integer`.as("contentCount"),
    ])
    .groupBy(["subjects.id", "subjects.name", "subjects.slug"])
    .orderBy("subjects.name", "asc")
    .execute();
  return rows.map((row) => SubjectSchema.parse(row));
}

export async function listEditorTopics(database: DatabaseClient): Promise<ContentTopic[]> {
  const rows = await sql<{ name: string; subject_id: string | null }>`
    select topic.name, link.subject_id
    from public.content_topics as topic
    left join public.content_topic_subjects as link on link.topic_id = topic.id
    order by topic.name asc, link.subject_id asc
  `.execute(database);
  const topics = new Map<string, { name: string; subjectIds: Set<string> }>();
  for (const row of rows.rows) {
    const key = row.name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim()
      .toLocaleLowerCase("es");
    const current = topics.get(key) ?? { name: row.name, subjectIds: new Set<string>() };
    if (row.subject_id) current.subjectIds.add(row.subject_id);
    topics.set(key, current);
  }
  return [...topics.values()].map((topic) => ContentTopicSchema.parse({
    name: topic.name,
    subjectIds: [...topic.subjectIds].sort(),
  }));
}
