import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import type { DatabaseClient, JsonValue } from "./db/database.js";

type JsonObject = { [key: string]: JsonValue };

export type KnowledgeTermFrequency = "first_document" | "first_section" | "all";

export type KnowledgeTermAnnotation = {
  end: number;
  path: string;
  start: number;
  termId: string;
};

export type GuideSectionAnchor = {
  anchorId: string;
  label: string;
  level: 1 | 2 | 3;
  path: string;
};

export type KnowledgeTermSummary = {
  category: string | null;
  id: string;
  link: {
    anchor: string | null;
    contentId: string;
    slug: string;
    title: string;
  } | null;
  name: string;
  shortDefinition: string;
  slug: string;
};

export type ContentKnowledgeTerms = {
  annotations: KnowledgeTermAnnotation[];
  dictionaryVersion: number;
  sectionAnchors: GuideSectionAnchor[];
  terms: KnowledgeTermSummary[];
};

type MatcherEntry = {
  alias: string;
  caseSensitive: boolean;
  frequency: KnowledgeTermFrequency;
  priority: number;
  termId: string;
};

type Match = {
  end: number;
  entry: MatcherEntry;
  start: number;
};

type TrieNode = {
  fail: number;
  next: Map<string, number>;
  output: MatcherEntry[];
};

type DraftGuideSection = GuideSectionAnchor & {
  contextKey: string | null;
  normalizedLabel: string;
  ordinal: number;
};

type StoredGuideSection = DraftGuideSection & {
  contentVersion: number;
  rowId: string;
};

const WORD_CHARACTER = /[\p{L}\p{N}_]/u;
const MAX_DOCUMENT_DEPTH = 16;
const MAX_SECTION_CONTEXT_CHARACTERS = 240;

function asObject(value: JsonValue | undefined): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function asArray(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function isWordCharacter(value: string | undefined) {
  return Boolean(value && WORD_CHARACTER.test(value));
}

function hasWordBoundaries(text: string, start: number, end: number) {
  return !isWordCharacter(text[start - 1]) && !isWordCharacter(text[end]);
}

function normalizeAlias(value: string) {
  return value.trim().toLocaleLowerCase("es");
}

function normalizeSectionText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

function sectionSlug(value: string) {
  return normalizeSectionText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "") || "seccion";
}

function nodeText(rawNode: JsonValue, depth = 0): string {
  if (depth > MAX_DOCUMENT_DEPTH) return "";
  const node = asObject(rawNode);
  if (!node) return "";
  if (node.type === "text") return typeof node.text === "string" ? node.text : "";
  if (node.type === "hardBreak") return " ";
  return asArray(node.content)
    .map((child) => nodeText(child, depth + 1))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function sectionContext(children: JsonValue[], headingIndex: number) {
  const fragments: string[] = [];
  for (let index = headingIndex + 1; index < children.length; index += 1) {
    const sibling = asObject(children[index]);
    if (!sibling) continue;
    if (sibling.type === "heading") break;
    const value = nodeText(children[index] as JsonValue);
    if (value) fragments.push(value);
    if (fragments.join(" ").length >= MAX_SECTION_CONTEXT_CHARACTERS) break;
  }
  const normalized = normalizeSectionText(fragments.join(" "))
    .slice(0, MAX_SECTION_CONTEXT_CHARACTERS)
    .trim();
  return normalized || null;
}

function collectGuideSections(document: JsonObject): DraftGuideSection[] {
  const sections: DraftGuideSection[] = [];

  const visitChildren = (children: JsonValue[], parentPath: string, depth: number) => {
    if (depth > MAX_DOCUMENT_DEPTH) return;
    children.forEach((rawNode, index) => {
      const node = asObject(rawNode);
      if (!node) return;
      const path = `${parentPath}.${index}`;
      if (node.type === "heading") {
        const attrs = asObject(node.attrs);
        const rawLevel = attrs?.level;
        const level = typeof rawLevel === "number" && rawLevel >= 1 && rawLevel <= 3
          ? rawLevel as 1 | 2 | 3
          : null;
        const label = nodeText(rawNode).replace(/\s+/g, " ").trim();
        if (level && label) {
          sections.push({
            anchorId: "",
            contextKey: sectionContext(children, index),
            label,
            level,
            normalizedLabel: normalizeSectionText(label),
            ordinal: sections.length,
            path,
          });
        }
      }
      const nested = asArray(node.content);
      if (nested.length > 0) visitChildren(nested, path, depth + 1);
    });
  };

  visitChildren(asArray(document.content), "root", 0);
  return sections;
}

function chooseUniqueStoredSection(
  stored: StoredGuideSection[],
  usedRows: Set<string>,
  predicate: (candidate: StoredGuideSection) => boolean,
) {
  const candidates = stored.filter((candidate) => !usedRows.has(candidate.rowId) && predicate(candidate));
  return candidates.length === 1 ? candidates[0] : null;
}

function allocateSectionAnchors(
  draftSections: DraftGuideSection[],
  storedSections: StoredGuideSection[],
): DraftGuideSection[] {
  const usedRows = new Set<string>();
  const usedAnchors = new Set(storedSections.map((section) => section.anchorId));
  const resolved = draftSections.map((section) => ({ ...section }));

  const claim = (section: DraftGuideSection, candidate: StoredGuideSection | null) => {
    if (!candidate) return false;
    section.anchorId = candidate.anchorId;
    usedRows.add(candidate.rowId);
    return true;
  };

  // Body context survives a heading rename and also survives reordering. This is
  // the strongest identity signal for an edited section.
  for (const section of resolved) {
    if (!section.contextKey) continue;
    claim(
      section,
      chooseUniqueStoredSection(
        storedSections,
        usedRows,
        (candidate) => candidate.level === section.level && candidate.contextKey === section.contextKey,
      ),
    );
  }

  // An unchanged heading can move without losing its anchor.
  for (const section of resolved.filter((candidate) => !candidate.anchorId)) {
    claim(
      section,
      chooseUniqueStoredSection(
        storedSections,
        usedRows,
        (candidate) =>
          candidate.level === section.level && candidate.normalizedLabel === section.normalizedLabel,
      ),
    );
  }

  // Final compatibility fallback: a heading renamed in place keeps its identity.
  for (const section of resolved.filter((candidate) => !candidate.anchorId)) {
    claim(
      section,
      chooseUniqueStoredSection(
        storedSections,
        usedRows,
        (candidate) => candidate.level === section.level && candidate.path === section.path,
      ),
    );
  }

  for (const section of resolved.filter((candidate) => !candidate.anchorId)) {
    const base = sectionSlug(section.label);
    let anchorId = `${base}-${randomUUID().slice(0, 8)}`;
    while (usedAnchors.has(anchorId)) {
      anchorId = `${base}-${randomUUID().slice(0, 8)}`;
    }
    section.anchorId = anchorId;
    usedAnchors.add(anchorId);
  }

  return resolved;
}

async function syncGuideSections(
  database: DatabaseClient,
  contentId: string,
  contentVersion: number,
  document: JsonObject | null,
): Promise<GuideSectionAnchor[]> {
  if (!document) return [];
  const draftSections = collectGuideSections(document);

  return database.transaction().execute(async (transaction) => {
    // Two first reads after a publication can arrive together. Serialize only
    // this guide's tiny reconciliation instead of locking the whole dictionary.
    await sql`select pg_advisory_xact_lock(hashtext(${contentId}))`.execute(transaction);

    const existingResult = await sql<{
      anchor_id: string;
      content_version: number;
      context_key: string | null;
      id: string;
      label: string;
      level: number;
      node_path: string;
      normalized_label: string;
      ordinal: number;
    }>`
      select
        id,
        anchor_id,
        node_path,
        label,
        normalized_label,
        context_key,
        level,
        ordinal,
        content_version
      from public.guide_sections
      where content_item_id = ${contentId}
      order by ordinal asc
    `.execute(transaction);

    const existing: StoredGuideSection[] = existingResult.rows.map((row) => ({
      anchorId: row.anchor_id,
      contentVersion: Number(row.content_version),
      contextKey: row.context_key,
      label: row.label,
      level: row.level as 1 | 2 | 3,
      nodePath: undefined,
      normalizedLabel: row.normalized_label,
      ordinal: Number(row.ordinal),
      path: row.node_path,
      rowId: row.id,
    } as StoredGuideSection));

    if (
      existing.length === draftSections.length &&
      existing.every((section) => section.contentVersion === contentVersion)
    ) {
      return existing.map(({ anchorId, label, level, path }) => ({ anchorId, label, level, path }));
    }

    const resolved = allocateSectionAnchors(draftSections, existing);
    await sql`delete from public.guide_sections where content_item_id = ${contentId}`.execute(transaction);

    for (const section of resolved) {
      await sql`
        insert into public.guide_sections (
          content_item_id,
          anchor_id,
          node_path,
          label,
          normalized_label,
          context_key,
          level,
          ordinal,
          content_version
        ) values (
          ${contentId},
          ${section.anchorId},
          ${section.path},
          ${section.label},
          ${section.normalizedLabel},
          ${section.contextKey},
          ${section.level},
          ${section.ordinal},
          ${contentVersion}
        )
      `.execute(transaction);
    }

    return resolved.map(({ anchorId, label, level, path }) => ({ anchorId, label, level, path }));
  });
}

function buildTrie(entries: MatcherEntry[]): TrieNode[] {
  const nodes: TrieNode[] = [{ fail: 0, next: new Map(), output: [] }];

  for (const entry of entries) {
    const key = normalizeAlias(entry.alias);
    if (key.length < 2) continue;
    let state = 0;
    for (const character of key) {
      const existing = nodes[state]?.next.get(character);
      if (existing !== undefined) {
        state = existing;
        continue;
      }
      const nextState = nodes.length;
      nodes.push({ fail: 0, next: new Map(), output: [] });
      nodes[state]?.next.set(character, nextState);
      state = nextState;
    }
    nodes[state]?.output.push(entry);
  }

  const queue: number[] = [];
  for (const child of nodes[0]?.next.values() ?? []) {
    queue.push(child);
  }

  while (queue.length > 0) {
    const state = queue.shift();
    if (state === undefined) break;
    const node = nodes[state];
    if (!node) continue;

    for (const [character, child] of node.next) {
      queue.push(child);
      let fallback = node.fail;
      while (fallback !== 0 && !nodes[fallback]?.next.has(character)) {
        fallback = nodes[fallback]?.fail ?? 0;
      }
      const transition = nodes[fallback]?.next.get(character);
      nodes[child]!.fail = transition !== undefined && transition !== child ? transition : 0;
      nodes[child]!.output.push(...(nodes[nodes[child]!.fail]?.output ?? []));
    }
  }

  return nodes;
}

function findMatches(text: string, trie: TrieNode[]): Match[] {
  const normalized = text.toLocaleLowerCase("es");
  const matches: Match[] = [];
  let state = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index]!;
    while (state !== 0 && !trie[state]?.next.has(character)) {
      state = trie[state]?.fail ?? 0;
    }
    state = trie[state]?.next.get(character) ?? 0;

    for (const entry of trie[state]?.output ?? []) {
      const length = normalizeAlias(entry.alias).length;
      const start = index - length + 1;
      const end = index + 1;
      if (start < 0 || !hasWordBoundaries(text, start, end)) continue;
      if (entry.caseSensitive && text.slice(start, end) !== entry.alias) continue;
      matches.push({ end, entry, start });
    }
  }

  // Longest, then explicit priority. This resolves "arteria" vs
  // "arteria mesentérica superior" without nested interactive wrappers.
  matches.sort((left, right) =>
    left.start - right.start ||
    (right.end - right.start) - (left.end - left.start) ||
    right.entry.priority - left.entry.priority,
  );

  const selected: Match[] = [];
  let occupiedUntil = -1;
  for (const match of matches) {
    if (match.start < occupiedUntil) continue;
    selected.push(match);
    occupiedUntil = match.end;
  }
  return selected;
}

function legacySectionsToDocument(sections: JsonValue[]): JsonObject {
  const content: JsonValue[] = [];
  for (const rawSection of sections) {
    const section = asObject(rawSection);
    const heading = typeof section?.heading === "string" ? section.heading : "";
    const body = typeof section?.body === "string" ? section.body : "";
    if (heading) {
      content.push({
        attrs: { level: 1 },
        content: [{ text: heading, type: "text" }],
        type: "heading",
      });
    }
    for (const paragraph of body.replace(/\r\n?/g, "\n").split(/\n[\t ]*\n+/)) {
      if (!paragraph) continue;
      content.push({
        content: [{ text: paragraph, type: "text" }],
        type: "paragraph",
      });
    }
  }
  return { content, type: "doc" };
}

function guideDocumentFromContent(kind: string, rawContent: JsonValue): JsonObject | null {
  const content = asObject(rawContent);
  if (!content) return null;
  const guide = kind === "video" ? asObject(content.guide) : content;
  if (!guide) return null;
  const document = asObject(guide.document);
  if (document?.type === "doc") return document;
  const sections = asArray(guide.sections);
  return sections.length > 0 ? legacySectionsToDocument(sections) : null;
}

export function compileKnowledgeTermAnnotations(
  document: JsonObject,
  entries: MatcherEntry[],
): KnowledgeTermAnnotation[] {
  if (entries.length === 0) return [];
  const trie = buildTrie(entries);
  const annotations: KnowledgeTermAnnotation[] = [];
  const seenDocument = new Set<string>();
  const seenSection = new Set<string>();
  let sectionKey = "root";

  const visit = (rawNode: JsonValue, path: string, depth: number, insideCode = false) => {
    if (depth > MAX_DOCUMENT_DEPTH) return;
    const node = asObject(rawNode);
    if (!node || typeof node.type !== "string") return;

    const nodeInsideCode = insideCode || node.type === "codeBlock";
    if (node.type === "heading") {
      const attrs = asObject(node.attrs);
      const level = typeof attrs?.level === "number" ? attrs.level : 6;
      if (level <= 3) {
        sectionKey = path;
        seenSection.clear();
      }
    }

    if (node.type === "text" && !nodeInsideCode && typeof node.text === "string") {
      const marks = asArray(node.marks);
      const unsafe = marks.some((rawMark) => {
        const mark = asObject(rawMark);
        return mark?.type === "link" || mark?.type === "code";
      });
      if (!unsafe) {
        for (const match of findMatches(node.text, trie)) {
          const { entry } = match;
          if (entry.frequency === "first_document" && seenDocument.has(entry.termId)) continue;
          const sectionIdentity = `${sectionKey}:${entry.termId}`;
          if (entry.frequency === "first_section" && seenSection.has(sectionIdentity)) continue;

          annotations.push({
            end: match.end,
            path,
            start: match.start,
            termId: entry.termId,
          });
          seenDocument.add(entry.termId);
          seenSection.add(sectionIdentity);
        }
      }
      return;
    }

    const children = asArray(node.content);
    children.forEach((child, index) => visit(child, `${path}.${index}`, depth + 1, nodeInsideCode));
  };

  visit(document, "root", 0);
  return annotations;
}

async function dictionaryVersion(database: DatabaseClient) {
  const result = await sql<{ version: string | number }>`
    select version from public.knowledge_term_dictionary where singleton = true
  `.execute(database);
  return Number(result.rows[0]?.version ?? 1);
}

async function matcherEntries(database: DatabaseClient): Promise<MatcherEntry[]> {
  const result = await sql<{
    alias: string;
    case_sensitive: boolean;
    frequency: KnowledgeTermFrequency;
    priority: number;
    term_id: string;
  }>`
    select source.term_id, source.alias, source.case_sensitive, source.frequency, source.priority
    from (
      select
        term.id as term_id,
        term.name as alias,
        false as case_sensitive,
        term.frequency,
        term.priority
      from public.knowledge_terms as term
      where term.is_active = true and term.auto_link = true
      union all
      select
        term.id as term_id,
        alias.alias,
        alias.case_sensitive,
        term.frequency,
        term.priority
      from public.knowledge_term_aliases as alias
      join public.knowledge_terms as term on term.id = alias.term_id
      where term.is_active = true and term.auto_link = true and alias.auto_link = true
    ) as source
    order by char_length(source.alias) desc, source.priority desc
  `.execute(database);
  return result.rows.map((row) => ({
    alias: row.alias,
    caseSensitive: row.case_sensitive,
    frequency: row.frequency,
    priority: Number(row.priority),
    termId: row.term_id,
  }));
}

async function termSummaries(database: DatabaseClient, ids: string[]): Promise<KnowledgeTermSummary[]> {
  if (ids.length === 0) return [];
  const result = await sql<{
    anchor: string | null;
    category: string | null;
    id: string;
    link_content_id: string | null;
    link_slug: string | null;
    link_title: string | null;
    name: string;
    short_definition: string;
    slug: string;
  }>`
    select
      term.id,
      term.slug,
      term.name,
      term.short_definition,
      term.category,
      destination.content_item_id as link_content_id,
      destination.section_anchor as anchor,
      linked.slug as link_slug,
      linked.title as link_title
    from public.knowledge_terms as term
    left join lateral (
      select link.content_item_id, link.section_anchor
      from public.knowledge_term_links as link
      join public.content_items as target
        on target.id = link.content_item_id
       and target.status = 'published'
      where link.term_id = term.id
      order by link.priority desc, link.created_at asc
      limit 1
    ) as destination on true
    left join public.content_items as linked on linked.id = destination.content_item_id
    where term.id = any(${sql.val(ids)}::uuid[])
      and term.is_active = true
  `.execute(database);

  return result.rows.map((row) => ({
    category: row.category,
    id: row.id,
    link: row.link_content_id && row.link_slug && row.link_title
      ? {
          anchor: row.anchor,
          contentId: row.link_content_id,
          slug: row.link_slug,
          title: row.link_title,
        }
      : null,
    name: row.name,
    shortDefinition: row.short_definition,
    slug: row.slug,
  }));
}

export async function getContentKnowledgeTerms(
  database: DatabaseClient,
  contentId: string,
): Promise<ContentKnowledgeTerms | null> {
  const itemResult = await sql<{
    content: JsonValue;
    id: string;
    kind: string;
    version: number;
  }>`
    select id, kind::text, content, version
    from public.content_items
    where id = ${contentId}
      and status = 'published'
      and kind in ('guide', 'video')
    limit 1
  `.execute(database);
  const item = itemResult.rows[0];
  if (!item) return null;

  const document = guideDocumentFromContent(item.kind, item.content);
  const [currentDictionaryVersion, sectionAnchors] = await Promise.all([
    dictionaryVersion(database),
    syncGuideSections(database, contentId, Number(item.version), document),
  ]);
  const cached = await sql<{
    annotations: KnowledgeTermAnnotation[];
    content_version: number;
    dictionary_version: string | number;
    term_ids: string[];
  }>`
    select annotations, content_version, dictionary_version, term_ids
    from public.content_term_annotations
    where content_item_id = ${contentId}
    limit 1
  `.execute(database);
  const snapshot = cached.rows[0];

  let annotations: KnowledgeTermAnnotation[];
  let termIds: string[];
  if (
    snapshot &&
    Number(snapshot.content_version) === Number(item.version) &&
    Number(snapshot.dictionary_version) === currentDictionaryVersion
  ) {
    annotations = Array.isArray(snapshot.annotations) ? snapshot.annotations : [];
    termIds = Array.isArray(snapshot.term_ids) ? snapshot.term_ids : [];
  } else {
    annotations = document
      ? compileKnowledgeTermAnnotations(document, await matcherEntries(database))
      : [];
    termIds = [...new Set(annotations.map((annotation) => annotation.termId))];

    await sql`
      insert into public.content_term_annotations (
        content_item_id,
        content_version,
        dictionary_version,
        annotations,
        term_ids,
        compiled_at
      )
      values (
        ${contentId},
        ${item.version},
        ${currentDictionaryVersion},
        ${JSON.stringify(annotations)}::jsonb,
        ${sql.val(termIds)}::uuid[],
        now()
      )
      on conflict (content_item_id) do update set
        content_version = excluded.content_version,
        dictionary_version = excluded.dictionary_version,
        annotations = excluded.annotations,
        term_ids = excluded.term_ids,
        compiled_at = excluded.compiled_at
    `.execute(database);
  }

  return {
    annotations,
    dictionaryVersion: currentDictionaryVersion,
    sectionAnchors,
    terms: await termSummaries(database, termIds),
  };
}
