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

export const EDITOR_CONTENT_INDEX_DEFAULT_LIMIT = 500;
export const EDITOR_CONTENT_INDEX_MAX_LIMIT = 500;

export type EditorContentCursor = {
  id: string;
  updatedAt: string;
};

export type EditorContentIndexInput = {
  actorUserId: string;
  canEditAll: boolean;
  cursor?: EditorContentCursor;
  kind?: ContentKind;
  limit?: number;
  query?: string;
  scope?: "all" | "publications";
  status?: ContentStatus;
};

export type EditorContentIndexPage = {
  index: {
    nextCursor: string | null;
    totalItems: number;
    totalPublications: number;
  };
  items: ContentItem[];
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toIso(value: Date | string) {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

export function encodeEditorContentCursor(cursor: EditorContentCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeEditorContentCursor(value: string): EditorContentCursor | null {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!decoded || typeof decoded !== "object") return null;
    const id = "id" in decoded ? decoded.id : null;
    const updatedAt = "updatedAt" in decoded ? decoded.updatedAt : null;
    if (typeof id !== "string" || !uuidPattern.test(id)) return null;
    if (typeof updatedAt !== "string" || !Number.isFinite(Date.parse(updatedAt))) return null;
    return { id, updatedAt: new Date(updatedAt).toISOString() };
  } catch {
    return null;
  }
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

type CountRow = { count: number | string };

type NormalizedEditorContentIndexInput = EditorContentIndexInput & {
  limit: number;
  query: string;
  scope: "all" | "publications";
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

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .trim();
}

function searchTsquery(value: string) {
  const tokens = normalizeSearch(value).match(/[a-z0-9]+/g) ?? [];
  return tokens.slice(0, 12).map((token) => `${token}:*`).join(" & ");
}

function accessPredicate(input: NormalizedEditorContentIndexInput, alias = "item") {
  if (alias === "linked_video") {
    return sql<boolean>`(${input.canEditAll} or linked_video.author_user_id = ${input.actorUserId})`;
  }
  return sql<boolean>`(${input.canEditAll} or item.author_user_id = ${input.actorUserId})`;
}

function independentPublicationPredicate(input: NormalizedEditorContentIndexInput) {
  return sql<boolean>`not (
    item.kind::text = 'guide'
    and nullif(item.content ->> 'linkedVideoId', '') is not null
    and exists (
      select 1
      from public.content_items as linked_video
      where linked_video.id::text = nullif(item.content ->> 'linkedVideoId', '')
        and linked_video.kind::text = 'video'
        and ${accessPredicate(input, "linked_video")}
    )
  )`;
}

function editorFilterPredicate(
  input: NormalizedEditorContentIndexInput,
  forcePublications = false,
) {
  const tsquery = searchTsquery(input.query);
  const normalizedQuery = normalizeSearch(input.query);
  const slugNeedle = normalizedQuery.replace(/\s+/g, "-");
  const kindPredicate = input.kind
    ? sql<boolean>`item.kind::text = ${input.kind}`
    : sql<boolean>`true`;
  const statusPredicate = input.status
    ? sql<boolean>`item.status::text = ${input.status}`
    : sql<boolean>`true`;
  const searchPredicate = input.scope === "publications" && normalizedQuery
    ? sql<boolean>`public.cediah_search_normalize(item.title) like ${`%${normalizedQuery}%`}`
    : tsquery
      ? sql<boolean>`(
          coalesce(item.search_vector, ''::tsvector) @@ to_tsquery('simple', ${tsquery})
          or public.cediah_search_normalize(item.slug) like ${`%${slugNeedle}%`}
        )`
      : sql<boolean>`true`;
  const scopePredicate = forcePublications || input.scope === "publications"
    ? independentPublicationPredicate(input)
    : sql<boolean>`true`;
  return sql<boolean>`
    ${accessPredicate(input)}
    and ${kindPredicate}
    and ${statusPredicate}
    and ${searchPredicate}
    and ${scopePredicate}
  `;
}

function cursorPredicate(cursor: EditorContentCursor | undefined) {
  if (!cursor) return sql<boolean>`true`;
  return sql<boolean>`(
    item.updated_at < ${cursor.updatedAt}::timestamptz
    or (item.updated_at = ${cursor.updatedAt}::timestamptz and item.id > ${cursor.id}::uuid)
  )`;
}

function normalizeIndexInput(input: EditorContentIndexInput): NormalizedEditorContentIndexInput {
  return {
    ...input,
    limit: Math.min(
      EDITOR_CONTENT_INDEX_MAX_LIMIT,
      Math.max(1, input.limit ?? EDITOR_CONTENT_INDEX_DEFAULT_LIMIT),
    ),
    query: input.query?.trim() ?? "",
    scope: input.scope ?? "all",
  };
}

export async function listEditorContentIndex(
  database: DatabaseClient,
  rawInput: EditorContentIndexInput,
): Promise<EditorContentIndexPage> {
  const input = normalizeIndexInput(rawInput);
  const selectRows = sql<IndexRow>`
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
    where ${editorFilterPredicate(input)}
      and ${cursorPredicate(input.cursor)}
    order by item.updated_at desc, item.id asc
    limit ${input.limit + 1}
  `.execute(database);
  const countItems = sql<CountRow>`
    select count(*)::integer as count
    from public.content_items as item
    where ${editorFilterPredicate(input)}
  `.execute(database);
  const countPublications = sql<CountRow>`
    select count(*)::integer as count
    from public.content_items as item
    where ${editorFilterPredicate(input, true)}
  `.execute(database);

  const [result, totalItemsResult, totalPublicationsResult] = await Promise.all([
    selectRows,
    countItems,
    countPublications,
  ]);
  const hasMore = result.rows.length > input.limit;
  const pageRows = hasMore ? result.rows.slice(0, input.limit) : result.rows;
  const ids = pageRows.map((row) => row.id);
  const [subjects, assets] = await Promise.all([
    subjectIdsByContent(database, ids),
    latestAssetsByContent(database, ids),
  ]);
  const items = pageRows.map((row) => compactItem(
    row,
    subjects.get(row.id) ?? [],
    assets.get(row.id),
  ));
  const last = hasMore ? pageRows.at(-1) : undefined;

  return {
    index: {
      nextCursor: last
        ? encodeEditorContentCursor({ id: last.id, updatedAt: toIso(last.updated_at) })
        : null,
      totalItems: Number(totalItemsResult.rows[0]?.count ?? 0),
      totalPublications: Number(totalPublicationsResult.rows[0]?.count ?? 0),
    },
    items,
  };
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
