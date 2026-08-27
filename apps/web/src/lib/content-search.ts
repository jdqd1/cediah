import type { ContentItem, RichTextDocument } from "@cediah/contracts";
import { publishedContentHref } from "./content-navigation";
import { richTextDocumentToPlainText } from "./guide-document";

export const contentSearchResultLimit = 4;

export type ContentSearchResult = {
  excerpt: string;
  excerptType: "content" | "metadata";
  href: string;
  id: string;
  kind: "guide" | "video";
  title: string;
  topic: string;
};

export type ContentSearchResponse = {
  guides: ContentSearchResult[];
  query: string;
  videos: ContentSearchResult[];
};

type SearchField = {
  source: "content" | "metadata" | "title";
  value: string;
  weight: number;
};

type SearchableContentItem =
  | Extract<ContentItem, { kind: "guide" }>
  | Extract<ContentItem, { kind: "video" }>;

type RankedContentItem = {
  contentText: string;
  contentMatch: boolean;
  item: SearchableContentItem;
  score: number;
};

const diacriticPattern = /\p{Diacritic}/gu;
const searchCharacterPattern = /[^\p{L}\p{N}]+/gu;

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(diacriticPattern, "")
    .toLocaleLowerCase("es");
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizedSearchValue(value: string) {
  return normalizeSearchText(value).replace(/\s+/g, " ").trim();
}

function queryTokens(query: string) {
  return Array.from(
    new Set(
      normalizeSearchText(query)
        .split(searchCharacterPattern)
        .filter(Boolean),
    ),
  );
}

function occurrences(value: string, needle: string) {
  if (!needle) return 0;

  let count = 0;
  let index = value.indexOf(needle);
  while (index >= 0) {
    count += 1;
    index = value.indexOf(needle, index + needle.length);
  }
  return count;
}

function guideSectionsText(sections: Array<{ body: string; heading: string }>) {
  return sections.map((section) => `${section.heading}. ${section.body}`).join("\n\n");
}

function guideDocumentText(
  document: RichTextDocument | null,
  sections: Array<{ body: string; heading: string }>,
) {
  const richText = document ? richTextDocumentToPlainText(document) : "";
  return richText || guideSectionsText(sections);
}

function questionsText(questions: Array<{ explanation?: string; options: string[]; prompt: string }>) {
  return questions
    .map((question) =>
      [question.prompt, ...question.options, question.explanation].filter(Boolean).join(" "),
    )
    .join("\n");
}

export function contentItemSearchText(item: ContentItem) {
  if (item.kind === "guide") {
    return [
      guideDocumentText(item.content.document, item.content.sections),
      item.content.keyPoints.join("\n"),
      questionsText(item.content.quiz.questions),
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  if (item.kind === "video") {
    return [
      item.content.description,
      item.content.keyPoints.join("\n"),
      guideDocumentText(item.content.guide.document, item.content.guide.sections),
      questionsText(item.content.quiz.questions),
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  if (item.kind === "quiz") return questionsText(item.content.questions);
  if (item.kind === "flashcards") {
    return item.content.cards.map((card) => `${card.front}. ${card.back}`).join("\n\n");
  }

  return [item.content.introduction, item.content.objectives.join("\n")]
    .filter(Boolean)
    .join("\n\n");
}

function itemSearchFields(item: SearchableContentItem): SearchField[] {
  const contentText = contentItemSearchText(item);
  return [
    { source: "title", value: item.title, weight: 120 },
    { source: "metadata", value: item.topic, weight: 74 },
    { source: "metadata", value: item.summary, weight: 66 },
    { source: "metadata", value: item.content.regions.join(" "), weight: 52 },
    { source: "content", value: contentText, weight: 36 },
  ];
}

function rankContentItem(
  item: SearchableContentItem,
  query: string,
): RankedContentItem | null {
  const normalizedQuery = normalizedSearchValue(query);
  const tokens = queryTokens(query);
  if (!normalizedQuery || tokens.length === 0) return null;

  const fields = itemSearchFields(item).map((field) => ({
    ...field,
    normalized: normalizedSearchValue(field.value),
  }));
  const combined = fields.map((field) => field.normalized).join(" ");
  if (tokens.some((token) => !combined.includes(token))) return null;

  let score = 0;
  let matchedFieldCount = 0;
  for (const field of fields) {
    const matchedTokens = tokens.filter((token) => field.normalized.includes(token));
    if (matchedTokens.length === 0) continue;

    matchedFieldCount += 1;
    score += field.weight;
    score += (matchedTokens.length / tokens.length) * field.weight * 0.55;
    score += matchedTokens.reduce(
      (total, token) => total + Math.min(occurrences(field.normalized, token), 3) * 4,
      0,
    );
    if (field.normalized.includes(normalizedQuery)) score += field.weight * 0.85;
    if (field.source === "title") score += matchedTokens.length * 42;
  }

  const normalizedTitle = normalizedSearchValue(item.title);
  if (normalizedTitle === normalizedQuery) score += 260;
  else if (normalizedTitle.startsWith(normalizedQuery)) score += 140;
  else if (tokens.every((token) => normalizedTitle.includes(token))) score += 115;

  const contentText = fields.find((field) => field.source === "content")?.value ?? "";
  const normalizedContent = normalizedSearchValue(contentText);
  const contentMatch = tokens.every((token) => normalizedContent.includes(token));
  if (normalizedContent.includes(normalizedQuery)) score += 48;
  score += matchedFieldCount * 5;

  return { contentMatch, contentText, item, score };
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

export function getContentSearchExcerpt(value: string, query: string) {
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

function metadataExcerpt(item: SearchableContentItem) {
  return compactText(item.summary || item.topic || item.title);
}

function toSearchResult(ranked: RankedContentItem, query: string): ContentSearchResult {
  const { item } = ranked;
  const shouldUseContentExcerpt = ranked.contentMatch;
  return {
    excerpt: shouldUseContentExcerpt
      ? getContentSearchExcerpt(ranked.contentText, query)
      : metadataExcerpt(item),
    excerptType: shouldUseContentExcerpt ? "content" : "metadata",
    href: publishedContentHref(item),
    id: item.id,
    kind: item.kind,
    title: item.title,
    topic: item.topic,
  };
}

export function searchPublishedContent(items: ContentItem[], query: string): ContentSearchResponse {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return { guides: [], query: "", videos: [] };

  const ranked = items
    .filter((item): item is SearchableContentItem =>
      item.kind === "guide" || item.kind === "video",
    )
    .map((item) => rankContentItem(item, trimmedQuery))
    .filter((item): item is RankedContentItem => Boolean(item))
    .sort((left, right) => {
      const scoreDifference = right.score - left.score;
      if (scoreDifference !== 0) return scoreDifference;
      return left.item.title.localeCompare(right.item.title, "es");
    });

  return {
    guides: ranked
      .filter((item) => item.item.kind === "guide")
      .slice(0, contentSearchResultLimit)
      .map((item) => toSearchResult(item, trimmedQuery)),
    query: trimmedQuery,
    videos: ranked
      .filter((item) => item.item.kind === "video")
      .slice(0, contentSearchResultLimit)
      .map((item) => toSearchResult(item, trimmedQuery)),
  };
}

export function getSearchMatchRanges(value: string, query: string) {
  const source = value;
  const { normalized, sourceEnds, sourceStarts } = normalizedTextWithSourceMap(source);
  const ranges: Array<{ end: number; start: number }> = [];

  for (const token of queryTokens(query)) {
    let matchIndex = normalized.indexOf(token);
    while (matchIndex >= 0) {
      ranges.push({
        end: sourceEnds[matchIndex + token.length - 1] ?? source.length,
        start: sourceStarts[matchIndex] ?? 0,
      });
      matchIndex = normalized.indexOf(token, matchIndex + token.length);
    }
  }

  ranges.sort((left, right) => left.start - right.start || left.end - right.end);
  return ranges.reduce<Array<{ end: number; start: number }>>((merged, range) => {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
      return merged;
    }
    merged.push(range);
    return merged;
  }, []);
}

function isContentSearchResult(value: unknown): value is ContentSearchResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.excerpt === "string" &&
    (result.excerptType === "content" || result.excerptType === "metadata") &&
    typeof result.href === "string" &&
    typeof result.id === "string" &&
    (result.kind === "guide" || result.kind === "video") &&
    typeof result.title === "string" &&
    typeof result.topic === "string"
  );
}

export function isContentSearchResponse(value: unknown): value is ContentSearchResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Record<string, unknown>;
  return (
    typeof response.query === "string" &&
    Array.isArray(response.guides) &&
    response.guides.every(isContentSearchResult) &&
    Array.isArray(response.videos) &&
    response.videos.every(isContentSearchResult)
  );
}
