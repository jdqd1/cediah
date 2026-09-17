import { randomUUID } from "node:crypto";
import { sql, type Transaction } from "kysely";
import {
  GuideKnowledgeIndexSchema,
  KnowledgeTermAdminSchema,
  RichTextDocumentSchema,
  type GuideKnowledgeIndex,
  type KnowledgeTermAdmin,
  type KnowledgeTermCreateRequest,
  type KnowledgeTermUpdateRequest,
  type RichTextDocument,
} from "@cediah/contracts";
import type { CediahDatabase, DatabaseClient, JsonValue } from "../db/database.js";
import {
  KnowledgeTermMatcher,
  type KnowledgeMatcherAlias,
  type KnowledgeTextMatch,
} from "./matcher.js";

type QueryDatabase = DatabaseClient | Transaction<CediahDatabase>;
type JsonObject = Record<string, unknown>;

type ExtractedHeading = {
  heading: string;
  nodePath: string;
  ordinal: number;
};

type ExtractedText = {
  nodePath: string;
  text: string;
};

type ExistingSection = {
  anchor: string;
  heading: string;
  id: string;
  node_path: string;
  ordinal: number;
};

type IndexedSection = ExistingSection;

type StoredOccurrence = KnowledgeTextMatch & {
  nodePath: string;
  occurrenceIndex: number;
  sectionId: string | null;
};

function asObject(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function childNodes(node: unknown): unknown[] {
  const object = asObject(node);
  return object && Array.isArray(object.content) ? object.content : [];
}

function nodeText(node: unknown): string {
  const object = asObject(node);
  if (!object) return "";
  if (object.type === "text") return typeof object.text === "string" ? object.text : "";
  if (object.type === "hardBreak") return " ";
  return childNodes(object).map(nodeText).join("");
}

function paragraphNode(value: string): JsonObject {
  const content: JsonObject[] = [];
  value.replace(/\r\n?/g, "\n").split("\n").forEach((line, index, lines) => {
    if (line) content.push({ type: "text", text: line });
    if (index < lines.length - 1) content.push({ type: "hardBreak" });
  });
  return { type: "paragraph", content };
}

function legacySectionsDocument(content: JsonObject): RichTextDocument | null {
  if (!Array.isArray(content.sections) || content.sections.length === 0) return null;
  const nodes: JsonObject[] = [];
  for (const rawSection of content.sections) {
    const section = asObject(rawSection);
    const heading = typeof section?.heading === "string" ? section.heading.trim() : "";
    const body = typeof section?.body === "string" ? section.body : "";
    if (heading) {
      nodes.push({ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: heading }] });
    }
    const paragraphs = body.replace(/\r\n?/g, "\n").split(/\n[\t ]*\n+/);
    for (const paragraph of paragraphs) {
      if (paragraph) nodes.push(paragraphNode(paragraph));
    }
  }
  const parsed = RichTextDocumentSchema.safeParse({ type: "doc", content: nodes });
  return parsed.success ? parsed.data : null;
}

function documentFromContent(content: JsonValue): RichTextDocument | null {
  const object = asObject(content);
  if (!object) return null;
  const direct = RichTextDocumentSchema.safeParse(object.document);
  if (direct.success) return direct.data;
  return legacySectionsDocument(object);
}

function normalizedHeading(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

function anchorSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/-+$/g, "") || "seccion";
}

function extractGuideEvents(document: RichTextDocument) {
  const headings: ExtractedHeading[] = [];
  const events: Array<
    | { kind: "heading"; nodePath: string }
    | ({ kind: "text" } & ExtractedText)
  > = [];

  const visit = (rawNode: unknown, path: string, excluded: boolean) => {
    const node = asObject(rawNode);
    if (!node || typeof node.type !== "string") return;
    const nextExcluded = excluded || node.type === "codeBlock";

    if (node.type === "heading") {
      const level = asObject(node.attrs)?.level;
      if (level === 1 || level === 2 || level === 3) {
        const heading = nodeText(node).replace(/\s+/g, " ").trim();
        if (heading) {
          headings.push({ heading, nodePath: path, ordinal: headings.length });
          events.push({ kind: "heading", nodePath: path });
        }
      }
      return;
    }

    if (node.type === "text") {
      const marks = Array.isArray(node.marks) ? node.marks : [];
      const unsafeMark = marks.some((rawMark) => {
        const mark = asObject(rawMark);
        return mark?.type === "code" || mark?.type === "link";
      });
      const text = typeof node.text === "string" ? node.text : "";
      if (!nextExcluded && !unsafeMark && text) events.push({ kind: "text", nodePath: path, text });
      return;
    }

    childNodes(node).forEach((child, index) => visit(child, `${path}.${index}`, nextExcluded));
  };

  visit(document, "root", false);
  return { events, headings };
}

async function loadMatcher(database: QueryDatabase) {
  const result = await sql<{
    alias: string;
    alias_id: string;
    case_sensitive: boolean;
    frequency: "all" | "first_guide" | "first_section";
    normalized_alias: string;
    priority: number;
    term_id: string;
  }>`
    select
      alias.id as alias_id,
      alias.alias,
      alias.case_sensitive,
      alias.normalized_alias,
      alias.priority + term.priority as priority,
      term.frequency,
      term.id as term_id
    from public.knowledge_term_aliases as alias
    join public.knowledge_terms as term on term.id = alias.term_id
    where term.active = true
      and term.auto_link = true
      and alias.auto_link = true
    order by char_length(alias.normalized_alias) desc, priority desc
  `.execute(database);

  const aliases: KnowledgeMatcherAlias[] = result.rows.map((row) => ({
    aliasId: row.alias_id,
    caseSensitive: row.case_sensitive,
    frequency: row.frequency,
    normalizedAlias: row.normalized_alias,
    priority: row.priority,
    sourceAlias: row.alias,
    termId: row.term_id,
  }));
  return new KnowledgeTermMatcher(aliases);
}

async function reconcileSections(
  database: QueryDatabase,
  contentId: string,
  headings: ExtractedHeading[],
): Promise<IndexedSection[]> {
  const stored = await sql<ExistingSection>`
    select id, anchor, heading, node_path, ordinal
    from public.guide_sections
    where content_item_id = ${contentId}
    order by ordinal asc
  `.execute(database);
  const existing = stored.rows;
  const used = new Set<string>();
  const assigned = new Map<number, ExistingSection>();

  for (const heading of headings) {
    const normalized = normalizedHeading(heading.heading);
    const candidates = existing
      .filter((section) => !used.has(section.id) && normalizedHeading(section.heading) === normalized)
      .sort((left, right) =>
        Math.abs(left.ordinal - heading.ordinal) - Math.abs(right.ordinal - heading.ordinal),
      );
    const match = candidates[0];
    if (match) {
      used.add(match.id);
      assigned.set(heading.ordinal, match);
    }
  }

  // A pure rename with the same outline shape should preserve the section ID.
  if (existing.length === headings.length) {
    for (const heading of headings) {
      if (assigned.has(heading.ordinal)) continue;
      const positional = existing.find(
        (section) => section.ordinal === heading.ordinal && !used.has(section.id),
      );
      if (positional) {
        used.add(positional.id);
        assigned.set(heading.ordinal, positional);
      }
    }
  }

  if (existing.length > 0) {
    await sql`
      update public.guide_sections
      set node_path = '__reindex__:' || id::text
      where content_item_id = ${contentId}
    `.execute(database);
  }

  const indexed: IndexedSection[] = [];
  for (const heading of headings) {
    const match = assigned.get(heading.ordinal);
    if (match) {
      await sql`
        update public.guide_sections
        set node_path = ${heading.nodePath}, heading = ${heading.heading}, ordinal = ${heading.ordinal}
        where id = ${match.id}
      `.execute(database);
      indexed.push({
        ...match,
        heading: heading.heading,
        node_path: heading.nodePath,
        ordinal: heading.ordinal,
      });
      continue;
    }

    const id = randomUUID();
    const anchor = `${anchorSlug(heading.heading)}-${id.slice(0, 8)}`;
    await sql`
      insert into public.guide_sections (id, content_item_id, node_path, anchor, heading, ordinal)
      values (${id}, ${contentId}, ${heading.nodePath}, ${anchor}, ${heading.heading}, ${heading.ordinal})
    `.execute(database);
    indexed.push({ id, anchor, heading: heading.heading, node_path: heading.nodePath, ordinal: heading.ordinal });
  }

  const retainedIds = indexed.map((section) => section.id);
  if (retainedIds.length === 0) {
    await sql`delete from public.guide_sections where content_item_id = ${contentId}`.execute(database);
  } else {
    await sql`
      delete from public.guide_sections
      where content_item_id = ${contentId}
        and id not in (${sql.join(retainedIds.map((id) => sql`${id}`))})
    `.execute(database);
  }
  return indexed;
}

function materializeOccurrences(
  matcher: KnowledgeTermMatcher,
  events: ReturnType<typeof extractGuideEvents>["events"],
  sections: IndexedSection[],
) {
  const sectionByPath = new Map(sections.map((section) => [section.node_path, section]));
  const seenGuide = new Set<string>();
  const seenSection = new Set<string>();
  const occurrences: StoredOccurrence[] = [];
  let currentSectionId: string | null = null;

  for (const event of events) {
    if (event.kind === "heading") {
      currentSectionId = sectionByPath.get(event.nodePath)?.id ?? currentSectionId;
      continue;
    }

    for (const match of matcher.find(event.text)) {
      if (match.frequency === "first_guide" && seenGuide.has(match.termId)) continue;
      const sectionKey = `${currentSectionId ?? "root"}:${match.termId}`;
      if (match.frequency === "first_section" && seenSection.has(sectionKey)) continue;

      occurrences.push({
        ...match,
        nodePath: event.nodePath,
        occurrenceIndex: occurrences.length,
        sectionId: currentSectionId,
      });
      seenGuide.add(match.termId);
      seenSection.add(sectionKey);
    }
  }
  return occurrences;
}

async function insertOccurrences(
  database: QueryDatabase,
  contentId: string,
  occurrences: StoredOccurrence[],
) {
  if (occurrences.length === 0) return;
  const values = occurrences.map((occurrence) => sql`(
    ${contentId},
    ${occurrence.termId},
    ${occurrence.aliasId},
    ${occurrence.sectionId},
    ${occurrence.nodePath},
    ${occurrence.startOffset},
    ${occurrence.endOffset},
    ${occurrence.occurrenceIndex}
  )`);
  await sql`
    insert into public.guide_term_occurrences (
      content_item_id, term_id, alias_id, section_id, node_path,
      start_offset, end_offset, occurrence_index
    ) values ${sql.join(values)}
  `.execute(database);
}

export async function refreshGuideKnowledge(
  database: DatabaseClient,
  contentId: string,
  sharedMatcher?: KnowledgeTermMatcher,
) {
  return database.transaction().execute(async (transaction) => {
    const result = await sql<{ content: JsonValue; kind: string; status: string }>`
      select content, kind::text as kind, status::text as status
      from public.content_items
      where id = ${contentId}
      for update
    `.execute(transaction);
    const item = result.rows[0];
    if (!item) return false;

    await sql`delete from public.guide_term_occurrences where content_item_id = ${contentId}`.execute(transaction);
    if (item.kind !== "guide" || item.status !== "published") {
      await sql`delete from public.knowledge_reindex_queue where content_item_id = ${contentId}`.execute(transaction);
      return true;
    }

    const document = documentFromContent(item.content);
    if (!document) {
      await sql`delete from public.knowledge_reindex_queue where content_item_id = ${contentId}`.execute(transaction);
      return true;
    }

    const extracted = extractGuideEvents(document);
    const sections = await reconcileSections(transaction, contentId, extracted.headings);
    const matcher = sharedMatcher ?? await loadMatcher(transaction);
    const occurrences = materializeOccurrences(matcher, extracted.events, sections);
    await insertOccurrences(transaction, contentId, occurrences);
    await sql`delete from public.knowledge_reindex_queue where content_item_id = ${contentId}`.execute(transaction);
    return true;
  });
}

export async function drainKnowledgeReindexQueue(database: DatabaseClient, limit = 12) {
  const queue = await sql<{ content_item_id: string }>`
    select content_item_id
    from public.knowledge_reindex_queue
    where requested_at <= now()
      and attempts < 5
    order by requested_at asc
    limit ${limit}
  `.execute(database);
  if (queue.rows.length === 0) return 0;

  const matcher = await loadMatcher(database);
  let processed = 0;
  for (const row of queue.rows) {
    try {
      await refreshGuideKnowledge(database, row.content_item_id, matcher);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "knowledge_reindex_failed";
      await sql`
        update public.knowledge_reindex_queue
        set attempts = attempts + 1,
            last_error = ${message},
            requested_at = now() + interval '1 minute'
        where content_item_id = ${row.content_item_id}
      `.execute(database);
    }
  }
  return processed;
}

async function ensureGuideIsFresh(database: DatabaseClient, contentId: string) {
  const queued = await sql<{ queued: boolean }>`
    select exists(
      select 1 from public.knowledge_reindex_queue where content_item_id = ${contentId}
    ) as queued
  `.execute(database);
  if (queued.rows[0]?.queued) await refreshGuideKnowledge(database, contentId);
}

export async function getGuideKnowledge(
  database: DatabaseClient,
  slug: string,
): Promise<GuideKnowledgeIndex | null> {
  const itemResult = await sql<{ id: string }>`
    select id
    from public.content_items
    where slug = ${slug}
      and kind = 'guide'
      and status = 'published'
      and catalog_visibility = 'catalog'
    limit 1
  `.execute(database);
  const contentId = itemResult.rows[0]?.id;
  if (!contentId) return null;

  await ensureGuideIsFresh(database, contentId);
  const [sectionResult, occurrenceResult] = await Promise.all([
    sql<{ anchor: string; heading: string; node_path: string; ordinal: number }>`
      select anchor, heading, node_path, ordinal
      from public.guide_sections
      where content_item_id = ${contentId}
      order by ordinal asc
    `.execute(database),
    sql<{
      category: string | null;
      end_offset: number;
      node_path: string;
      short_definition: string;
      start_offset: number;
      target_anchor: string | null;
      target_content_id: string | null;
      target_label: string | null;
      target_slug: string | null;
      target_title: string | null;
      term_id: string;
      term_name: string;
      term_slug: string;
    }>`
      select
        occurrence.term_id,
        occurrence.node_path,
        occurrence.start_offset,
        occurrence.end_offset,
        term.slug as term_slug,
        term.name as term_name,
        term.short_definition,
        term.category,
        destination.content_item_id as target_content_id,
        destination.slug as target_slug,
        destination.title as target_title,
        destination.anchor as target_anchor,
        destination.label as target_label
      from public.guide_term_occurrences as occurrence
      join public.knowledge_terms as term on term.id = occurrence.term_id
      left join lateral (
        select
          target.content_item_id,
          item.slug,
          item.title,
          section.anchor,
          target.label
        from public.knowledge_term_targets as target
        join public.content_items as item on item.id = target.content_item_id
        left join public.guide_sections as section on section.id = target.section_id
        where target.term_id = term.id
          and item.kind = 'guide'
          and item.status = 'published'
          and item.catalog_visibility = 'catalog'
        order by target.priority desc, target.created_at asc
        limit 1
      ) as destination on true
      where occurrence.content_item_id = ${contentId}
        and term.active = true
      order by occurrence.occurrence_index asc
    `.execute(database),
  ]);

  const terms = new Map<string, GuideKnowledgeIndex["terms"][number]>();
  const occurrences = occurrenceResult.rows.map((row) => {
    if (!terms.has(row.term_id)) {
      terms.set(row.term_id, {
        category: row.category,
        id: row.term_id,
        name: row.term_name,
        shortDefinition: row.short_definition,
        slug: row.term_slug,
        target: row.target_content_id && row.target_slug && row.target_title
          ? {
              anchor: row.target_anchor,
              contentId: row.target_content_id,
              label: row.target_label,
              slug: row.target_slug,
              title: row.target_title,
            }
          : null,
      });
    }
    return {
      endOffset: row.end_offset,
      nodePath: row.node_path,
      startOffset: row.start_offset,
      termId: row.term_id,
    };
  });

  return GuideKnowledgeIndexSchema.parse({
    occurrences,
    sections: sectionResult.rows.map((section) => ({
      anchor: section.anchor,
      heading: section.heading,
      nodePath: section.node_path,
      ordinal: section.ordinal,
    })),
    terms: [...terms.values()],
  });
}

async function replaceAliases(
  database: QueryDatabase,
  termId: string,
  name: string,
  aliases: KnowledgeTermCreateRequest["aliases"],
) {
  await sql`delete from public.knowledge_term_aliases where term_id = ${termId}`.execute(database);
  const seen = new Set<string>();
  const rows = [
    { alias: name, autoLink: true, caseSensitive: false, priority: 0, canonical: true },
    ...aliases.map((alias) => ({ ...alias, canonical: false })),
  ];
  for (const row of rows) {
    const key = normalizedHeading(row.alias);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    await sql`
      insert into public.knowledge_term_aliases (
        term_id, alias, is_canonical, auto_link, case_sensitive, priority
      ) values (
        ${termId}, ${row.alias}, ${row.canonical}, ${row.autoLink}, ${row.caseSensitive}, ${row.priority}
      )
    `.execute(database);
  }
}

async function replaceTarget(
  database: QueryDatabase,
  termId: string,
  target: KnowledgeTermCreateRequest["target"],
) {
  await sql`delete from public.knowledge_term_targets where term_id = ${termId}`.execute(database);
  if (!target) return;
  let sectionId: string | null = null;
  if (target.sectionAnchor) {
    const section = await sql<{ id: string }>`
      select id
      from public.guide_sections
      where content_item_id = ${target.contentId}
        and anchor = ${target.sectionAnchor}
      limit 1
    `.execute(database);
    sectionId = section.rows[0]?.id ?? null;
    if (!sectionId) throw new Error("knowledge_target_section_not_found");
  }
  await sql`
    insert into public.knowledge_term_targets (
      term_id, content_item_id, section_id, label, priority
    ) values (
      ${termId}, ${target.contentId}, ${sectionId}, ${target.label ?? null}, ${target.priority}
    )
  `.execute(database);
}

async function readAdminTerm(database: QueryDatabase, termId: string): Promise<KnowledgeTermAdmin | null> {
  const termResult = await sql<{
    active: boolean;
    auto_link: boolean;
    category: string | null;
    frequency: "all" | "first_guide" | "first_section";
    id: string;
    name: string;
    priority: number;
    short_definition: string;
    slug: string;
  }>`
    select id, slug, name, short_definition, category, active, auto_link, priority, frequency
    from public.knowledge_terms
    where id = ${termId}
    limit 1
  `.execute(database);
  const term = termResult.rows[0];
  if (!term) return null;

  const [aliasesResult, targetResult] = await Promise.all([
    sql<{
      alias: string;
      auto_link: boolean;
      case_sensitive: boolean;
      id: string;
      is_canonical: boolean;
      priority: number;
    }>`
      select id, alias, auto_link, case_sensitive, priority, is_canonical
      from public.knowledge_term_aliases
      where term_id = ${termId}
      order by is_canonical desc, char_length(alias) desc, alias asc
    `.execute(database),
    sql<{
      anchor: string | null;
      content_id: string;
      label: string | null;
      priority: number;
      section_anchor: string | null;
      slug: string;
      title: string;
    }>`
      select
        target.content_item_id as content_id,
        target.label,
        target.priority,
        section.anchor as section_anchor,
        section.anchor,
        item.slug,
        item.title
      from public.knowledge_term_targets as target
      join public.content_items as item on item.id = target.content_item_id
      left join public.guide_sections as section on section.id = target.section_id
      where target.term_id = ${termId}
      order by target.priority desc, target.created_at asc
      limit 1
    `.execute(database),
  ]);
  const target = targetResult.rows[0];

  return KnowledgeTermAdminSchema.parse({
    active: term.active,
    aliases: aliasesResult.rows
      .filter((alias) => !alias.is_canonical)
      .map((alias) => ({
        alias: alias.alias,
        autoLink: alias.auto_link,
        caseSensitive: alias.case_sensitive,
        id: alias.id,
        priority: alias.priority,
      })),
    autoLink: term.auto_link,
    category: term.category,
    frequency: term.frequency,
    id: term.id,
    name: term.name,
    priority: term.priority,
    shortDefinition: term.short_definition,
    slug: term.slug,
    target: target
      ? {
          anchor: target.anchor,
          contentId: target.content_id,
          label: target.label,
          priority: target.priority,
          sectionAnchor: target.section_anchor,
          slug: target.slug,
          title: target.title,
        }
      : null,
  });
}

export async function listKnowledgeTerms(database: DatabaseClient, query?: string) {
  const normalizedQuery = query?.trim() ?? "";
  const result = normalizedQuery
    ? await sql<{ id: string }>`
        select distinct term.id
        from public.knowledge_terms as term
        left join public.knowledge_term_aliases as alias on alias.term_id = term.id
        where public.cediah_term_normalize(term.name) like '%' || public.cediah_term_normalize(${normalizedQuery}) || '%'
           or alias.normalized_alias like '%' || public.cediah_term_normalize(${normalizedQuery}) || '%'
        order by term.id
        limit 100
      `.execute(database)
    : await sql<{ id: string }>`
        select id from public.knowledge_terms order by updated_at desc limit 100
      `.execute(database);
  const terms = await Promise.all(result.rows.map((row) => readAdminTerm(database, row.id)));
  return terms.filter((term): term is KnowledgeTermAdmin => term !== null);
}

export async function createKnowledgeTerm(
  database: DatabaseClient,
  input: KnowledgeTermCreateRequest,
) {
  return database.transaction().execute(async (transaction) => {
    const result = await sql<{ id: string }>`
      insert into public.knowledge_terms (
        slug, name, short_definition, category, active, auto_link, priority, frequency
      ) values (
        ${input.slug}, ${input.name}, ${input.shortDefinition}, ${input.category},
        true, ${input.autoLink}, ${input.priority}, ${input.frequency}
      )
      returning id
    `.execute(transaction);
    const termId = result.rows[0]!.id;
    await replaceAliases(transaction, termId, input.name, input.aliases);
    await replaceTarget(transaction, termId, input.target);
    return (await readAdminTerm(transaction, termId))!;
  });
}

export async function updateKnowledgeTerm(
  database: DatabaseClient,
  termId: string,
  input: KnowledgeTermUpdateRequest,
) {
  return database.transaction().execute(async (transaction) => {
    const current = await readAdminTerm(transaction, termId);
    if (!current) return null;
    const name = input.name ?? current.name;
    const slug = input.slug ?? current.slug;
    const shortDefinition = input.shortDefinition ?? current.shortDefinition;
    const category = input.category === undefined ? current.category : input.category;
    const active = input.active ?? current.active;
    const autoLink = input.autoLink ?? current.autoLink;
    const priority = input.priority ?? current.priority;
    const frequency = input.frequency ?? current.frequency;

    await sql`
      update public.knowledge_terms
      set slug = ${slug},
          name = ${name},
          short_definition = ${shortDefinition},
          category = ${category},
          active = ${active},
          auto_link = ${autoLink},
          priority = ${priority},
          frequency = ${frequency}
      where id = ${termId}
    `.execute(transaction);

    if (input.aliases !== undefined || input.name !== undefined) {
      await replaceAliases(
        transaction,
        termId,
        name,
        input.aliases ?? current.aliases.map(({ id: _id, ...alias }) => alias),
      );
    }
    if (input.target !== undefined) await replaceTarget(transaction, termId, input.target);
    return readAdminTerm(transaction, termId);
  });
}

export async function deactivateKnowledgeTerm(database: DatabaseClient, termId: string) {
  const result = await sql<{ id: string }>`
    update public.knowledge_terms
    set active = false
    where id = ${termId}
    returning id
  `.execute(database);
  return result.rows.length > 0;
}

export async function listGuideKnowledgeSections(database: DatabaseClient, contentId: string) {
  const result = await sql<{ anchor: string; heading: string; ordinal: number }>`
    select anchor, heading, ordinal
    from public.guide_sections
    where content_item_id = ${contentId}
    order by ordinal asc
  `.execute(database);
  return result.rows;
}
