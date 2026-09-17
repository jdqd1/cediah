import type { FastifyInstance } from "fastify";
import { sql } from "kysely";
import { z } from "zod";
import type { DatabaseClient, JsonValue } from "./db/database.js";

export type PublishedContentSearchResult = {
  excerpt: string;
  excerptType: "content" | "metadata";
  href: string;
  id: string;
  kind: "guide" | "video";
  title: string;
  topic: string;
};

export type PublishedContentSearchResponse = {
  guides: PublishedContentSearchResult[];
  query: string;
  videos: PublishedContentSearchResult[];
};

type SearchRow = {
  content: JsonValue;
  id: string;
  kind: string;
  score: number | string;
  slug: string;
  summary: string;
  title: string;
  topic: string;
};

type RankedSearchResult = PublishedContentSearchResult & { score: number };

const SearchQuerySchema = z.object({
  query: z.string().trim().min(1).max(120),
});
const diacriticPattern = /\p{Diacritic}/gu;
const searchCharacterPattern = /[^\p{L}\p{N}]+/gu;
const maxSearchTokens = 8;

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(diacriticPattern, "")
    .toLocaleLowerCase("es");
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizedSearchValue(value: string) {
  return compactText(normalizeSearchText(value));
}

function queryTokens(query: string) {
  return Array.from(
    new Set(
      normalizeSearchText(query)
        .split(searchCharacterPattern)
        .filter(Boolean),
    ),
  ).slice(0, maxSearchTokens);
}

function collectStrings(value: unknown, output: string[]) {
  if (typeof value === "string") {
    if (value.trim()) output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const nested of Object.values(value)) collectStrings(nested, output);
}

function contentSearchText(kind: "guide" | "video", content: JsonValue) {
  if (!content || typeof content !== "object" || Array.isArray(content)) return "";
  const record = content as Record<string, unknown>;
  const searchable = kind === "video"
    ? [record.description, record.keyPoints, record.guide, record.quiz, record.regions]
    : [record.document, record.keyPoints, record.quiz, record.regions, record.sections];
  const strings: string[] = [];
  for (const value of searchable) collectStrings(value, strings);
  return strings.join("\n");
}

type TextMap = {
  normalized: string;
  sourceEnds: number[];
  sourceStarts: number[];
};

function normalizedTextWithSourceMap(value: string): TextMap {
  let normalized = "";
  const sourceStarts: number[] = [];
  const sourceEnds: number[] = [];
  let sourceIndex = 0;

  for (const character of value) {
    const comparable = normalizeSearchText(character);
    for (let comparableIndex = 0; comparableIndex < comparable.length; comparableIndex += 1) {
      normalized += comparable[comparableIndex];
      sourceStarts.push(sourceIndex);
      sourceEnds.push(sourceIndex + character.length);
    }
    sourceIndex += character.length;
  }

  return { normalized, sourceEnds, sourceStarts };
}

function firstMatchRange(value: string, query: string) {
  const source = compactText(value);
  const { normalized, sourceEnds, sourceStarts } = normalizedTextWithSourceMap(source);
  const normalizedQuery = normalizedSearchValue(query);
  const tokens = queryTokens(query);
  const candidates = [
    normalizedQuery,
    ...tokens
      .filter((token) => token !== normalizedQuery)
      .sort((left, right) => right.length - left.length),
  ];

  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate);
    if (index < 0) continue;
    return {
      end: sourceEnds[index + candidate.length - 1] ?? source.length,
      start: sourceStarts[index] ?? 0,
    };
  }

  return null;
}

function searchExcerpt(value: string, query: string) {
  const source = compactText(value);
  const range = firstMatchRange(source, query);
  if (!range) return source.slice(0, 180);

  let start = Math.max(0, range.start - 52);
  let end = Math.min(source.length, range.end + 68);
  if (start > 0) {
    const boundary = source.lastIndexOf(" ", start);
    start = boundary >= 0 ? boundary + 1 : start;
  }
  if (end < source.length) {
    const boundary = source.indexOf(" ", end);
    end = boundary >= 0 ? boundary : end;
  }

  return `${start > 0 ? "…" : ""}${source.slice(start, end).trim()}${end < source.length ? "…" : ""}`;
}

function toSearchResult(row: SearchRow, query: string): RankedSearchResult | null {
  if (row.kind !== "guide" && row.kind !== "video") return null;
  const tokens = queryTokens(query);
  const contentText = contentSearchText(row.kind, row.content);
  const normalizedContent = normalizedSearchValue(contentText);
  const contentMatch = tokens.length > 0 && tokens.every((token) => normalizedContent.includes(token));
  return {
    excerpt: contentMatch
      ? searchExcerpt(contentText, query)
      : compactText(row.summary || row.topic || row.title).slice(0, 180),
    excerptType: contentMatch ? "content" : "metadata",
    href: row.kind === "guide" ? `/guias/${row.slug}` : `/contenido/${row.slug}`,
    id: row.id,
    kind: row.kind,
    score: Number(row.score),
    title: row.title,
    topic: row.topic,
  };
}

export async function searchPublishedContent(
  database: DatabaseClient,
  input: { limitPerKind?: number; query: string },
): Promise<PublishedContentSearchResponse> {
  const query = input.query.trim().slice(0, 120);
  const tokens = queryTokens(query);
  if (!query || tokens.length === 0) return { guides: [], query: "", videos: [] };

  const normalizedQuery = normalizedSearchValue(query);
  const tsQuery = tokens.map((token) => `${token}:*`).join(" & ");
  const limitPerKind = Math.min(Math.max(input.limitPerKind ?? 4, 1), 10);
  // Ranking already happens in PostgreSQL. Pulling extra full rich documents only
  // made the request heavier without changing the final ordering.
  const candidateLimit = limitPerKind;

  const result = await sql<SearchRow>`
    with search_query as (
      select to_tsquery('simple', ${tsQuery}) as query
    ),
    scored as (
      select
        item.id,
        item.kind,
        item.slug,
        item.title,
        item.topic,
        item.summary,
        item.published_at,
        (
          ts_rank_cd(item.search_vector, search_query.query, 32)
          + case
              when public.cediah_search_normalize(item.title) = ${normalizedQuery} then 20
              when public.cediah_search_normalize(item.title) like ${`${normalizedQuery}%`} then 10
              else 0
            end
        )::double precision as score
      from public.content_items as item
      cross join search_query
      where item.status = 'published'
        and item.catalog_visibility = 'catalog'
        and item.kind in ('guide', 'video')
        and item.search_vector @@ search_query.query
    ),
    ranked as (
      select
        scored.*,
        row_number() over (
          partition by scored.kind
          order by scored.score desc, scored.published_at desc nulls last, scored.title asc, scored.id asc
        ) as search_position
      from scored
    ),
    candidates as (
      select id, kind, slug, title, topic, summary, score, search_position
      from ranked
      where search_position <= ${candidateLimit}
    )
    select
      candidate.id,
      candidate.kind,
      candidate.slug,
      candidate.title,
      candidate.topic,
      candidate.summary,
      item.content,
      candidate.score
    from candidates as candidate
    join public.content_items as item on item.id = candidate.id
    order by candidate.kind asc, candidate.search_position asc
  `.execute(database);

  const ranked = result.rows
    .map((row) => toSearchResult(row, query))
    .filter((row): row is RankedSearchResult => Boolean(row));

  const byScore = (left: RankedSearchResult, right: RankedSearchResult) =>
    right.score - left.score || left.title.localeCompare(right.title, "es");
  const stripScore = (result: RankedSearchResult): PublishedContentSearchResult => ({
    excerpt: result.excerpt,
    excerptType: result.excerptType,
    href: result.href,
    id: result.id,
    kind: result.kind,
    title: result.title,
    topic: result.topic,
  });

  return {
    guides: ranked
      .filter((item) => item.kind === "guide")
      .sort(byScore)
      .slice(0, limitPerKind)
      .map(stripScore),
    query,
    videos: ranked
      .filter((item) => item.kind === "video")
      .sort(byScore)
      .slice(0, limitPerKind)
      .map(stripScore),
  };
}

export function registerPublishedContentSearchRoute(
  app: FastifyInstance,
  database: DatabaseClient | undefined,
) {
  app.get<{ Querystring: unknown }>("/v1/content/search", async (request, reply) => {
    if (!database) {
      return reply
        .status(503)
        .header("Cache-Control", "no-store")
        .send({ error: "search_unavailable" });
    }

    const query = SearchQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply
        .status(400)
        .header("Cache-Control", "no-store")
        .send({ error: "invalid_search_query" });
    }

    try {
      const response = await searchPublishedContent(database, {
        limitPerKind: 4,
        query: query.data.query,
      });
      return reply
        .header("Cache-Control", "public, max-age=30, stale-while-revalidate=120")
        .send(response);
    } catch (error) {
      request.log.error({ err: error }, "Published-content search failed");
      return reply
        .status(503)
        .header("Cache-Control", "no-store")
        .send({ error: "search_unavailable" });
    }
  });
}
