import { randomUUID } from "node:crypto";
import { sql, type Transaction } from "kysely";
import type { CediahDatabase, DatabaseClient, JsonValue } from "../db/database.js";

type QueryDatabase = DatabaseClient | Transaction<CediahDatabase>;

type OccurrencePolicy = "first_per_section" | "first_per_guide" | "all";

type DictionaryEntry = {
  normalized: string;
  occurrencePolicy: OccurrencePolicy;
  priority: number;
  termId: string;
};

type AutomatonNode = {
  fail: number;
  next: Map<string, number>;
  outputs: DictionaryEntry[];
};

type GuideOccurrence = {
  e: number;
  p: string;
  s: number;
  t: string;
};

type GuideSection = {
  anchor: string;
  heading: string;
  headingKey: string;
  id: string;
  level: number;
  nodePath: string;
  ordinal: number;
};

type JsonObject = Record<string, unknown>;

type DictionaryCache = {
  automaton: AutomatonNode[];
  revision: number;
};

let dictionaryCache: DictionaryCache | null = null;

function asObject(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function childrenOf(value: unknown): unknown[] {
  const object = asObject(value);
  return object && Array.isArray(object.content) ? object.content : [];
}

function textOf(value: unknown): string {
  const object = asObject(value);
  return object?.type === "text" && typeof object.text === "string" ? object.text : "";
}

function inlineText(value: unknown): string {
  const object = asObject(value);
  if (!object) return "";
  if (object.type === "text") return typeof object.text === "string" ? object.text : "";
  if (object.type === "hardBreak") return " ";
  return childrenOf(object).map(inlineText).join("");
}

function normalizeTermKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function headingSlug(value: string) {
  return normalizeTermKey(value).replace(/ /g, "-").slice(0, 80).replace(/-+$/g, "") || "seccion";
}

function legacyGuideDocument(content: JsonObject) {
  const sections = Array.isArray(content.sections) ? content.sections : [];
  const nodes: JsonObject[] = [];
  for (const rawSection of sections) {
    const section = asObject(rawSection);
    const heading = typeof section?.heading === "string" ? section.heading : "";
    const body = typeof section?.body === "string" ? section.body.replace(/\r\n?/g, "\n") : "";
    nodes.push({ type: "heading", attrs: { level: 1 }, content: heading ? [{ type: "text", text: heading }] : [] });
    for (const paragraph of body.split(/\n[\t ]*\n+/)) {
      const inline: JsonObject[] = [];
      const lines = paragraph.split("\n");
      lines.forEach((line, index) => {
        if (line) inline.push({ type: "text", text: line });
        if (index < lines.length - 1) inline.push({ type: "hardBreak" });
      });
      nodes.push({ type: "paragraph", content: inline });
    }
  }
  return { type: "doc", content: nodes };
}

function guideDocument(content: JsonValue): JsonObject | null {
  const object = asObject(content);
  if (!object) return null;
  const document = asObject(object.document);
  if (document?.type === "doc") return document;
  return legacyGuideDocument(object);
}

function collectHeadingDrafts(document: JsonObject) {
  const headings: Array<Omit<GuideSection, "anchor" | "id">> = [];
  function visit(value: unknown, path: number[]) {
    const node = asObject(value);
    if (!node) return;
    if (node.type === "heading") {
      const attrs = asObject(node.attrs);
      const level = typeof attrs?.level === "number" && Number.isInteger(attrs.level)
        ? Math.min(6, Math.max(1, attrs.level))
        : 2;
      const heading = inlineText(node).replace(/\s+/g, " ").trim();
      if (heading) {
        headings.push({
          heading,
          headingKey: normalizeTermKey(heading),
          level,
          nodePath: path.join("."),
          ordinal: headings.length,
        });
      }
    }
    childrenOf(node).forEach((child, index) => visit(child, [...path, index]));
  }
  childrenOf(document).forEach((child, index) => visit(child, [index]));
  return headings;
}

async function reconcileGuideSections(
  database: QueryDatabase,
  contentId: string,
  document: JsonObject,
): Promise<GuideSection[]> {
  const existingResult = await sql<{
    anchor: string;
    heading: string;
    heading_key: string;
    id: string;
    level: number;
    node_path: string;
    ordinal: number;
  }>`
    select id, anchor, heading, heading_key, node_path, ordinal, level
    from public.guide_sections
    where content_item_id = ${contentId}
    order by ordinal asc
  `.execute(database);

  const drafts = collectHeadingDrafts(document);
  const existing = existingResult.rows;
  const used = new Set<string>();
  const byPath = new Map(existing.map((section) => [section.node_path, section]));
  const byHeading = new Map<string, typeof existing>();
  for (const section of existing) {
    byHeading.set(section.heading_key, [...(byHeading.get(section.heading_key) ?? []), section]);
  }
  const usedAnchors = new Set(existing.map((section) => section.anchor));
  const sections: GuideSection[] = [];

  for (const draft of drafts) {
    let matched = byPath.get(draft.nodePath);
    if (matched && used.has(matched.id)) matched = undefined;
    if (!matched) {
      const sameHeading = (byHeading.get(draft.headingKey) ?? []).filter((candidate) => !used.has(candidate.id));
      if (sameHeading.length === 1) matched = sameHeading[0];
    }

    if (matched) {
      used.add(matched.id);
      sections.push({ ...draft, anchor: matched.anchor, id: matched.id });
      continue;
    }

    const id = randomUUID();
    const base = headingSlug(draft.heading);
    let anchor = base;
    if (usedAnchors.has(anchor)) anchor = `${base}--${id.replace(/-/g, "").slice(0, 8)}`;
    usedAnchors.add(anchor);
    sections.push({ ...draft, anchor, id });
  }

  for (const section of sections) {
    await sql`
      insert into public.guide_sections (
        id, content_item_id, anchor, heading, heading_key, node_path, ordinal, level
      ) values (
        ${section.id}, ${contentId}, ${section.anchor}, ${section.heading}, ${section.headingKey},
        ${section.nodePath}, ${section.ordinal}, ${section.level}
      )
      on conflict (id) do update
      set heading = excluded.heading,
          heading_key = excluded.heading_key,
          node_path = excluded.node_path,
          ordinal = excluded.ordinal,
          level = excluded.level,
          updated_at = now()
    `.execute(database);
  }

  const retainedIds = sections.map((section) => section.id);
  if (retainedIds.length === 0) {
    await sql`delete from public.guide_sections where content_item_id = ${contentId}`.execute(database);
  } else {
    await sql`
      delete from public.guide_sections
      where content_item_id = ${contentId}
        and id <> all(${sql.val(retainedIds)}::uuid[])
    `.execute(database);
  }

  return sections;
}

function buildAutomaton(entries: DictionaryEntry[]): AutomatonNode[] {
  const nodes: AutomatonNode[] = [{ fail: 0, next: new Map(), outputs: [] }];
  for (const entry of entries) {
    let state = 0;
    for (const character of entry.normalized) {
      let next = nodes[state]!.next.get(character);
      if (next === undefined) {
        next = nodes.length;
        nodes[state]!.next.set(character, next);
        nodes.push({ fail: 0, next: new Map(), outputs: [] });
      }
      state = next;
    }
    nodes[state]!.outputs.push(entry);
  }

  const queue: number[] = [];
  for (const child of nodes[0]!.next.values()) queue.push(child);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const state = queue[cursor]!;
    for (const [character, child] of nodes[state]!.next) {
      queue.push(child);
      let fallback = nodes[state]!.fail;
      while (fallback !== 0 && !nodes[fallback]!.next.has(character)) fallback = nodes[fallback]!.fail;
      const transition = nodes[fallback]!.next.get(character);
      nodes[child]!.fail = transition !== undefined && transition !== child ? transition : 0;
      nodes[child]!.outputs.push(...nodes[nodes[child]!.fail]!.outputs);
    }
  }
  return nodes;
}

async function loadDictionary(database: QueryDatabase): Promise<DictionaryCache> {
  const revisionResult = await sql<{ revision: string | number }>`
    select revision from public.interactive_term_dictionary_state where singleton = true
  `.execute(database);
  const revision = Number(revisionResult.rows[0]?.revision ?? 1);
  if (dictionaryCache?.revision === revision) return dictionaryCache;

  const result = await sql<{
    occurrence_policy: OccurrencePolicy;
    pattern: string;
    priority: number;
    source_rank: number;
    term_id: string;
  }>`
    select id as term_id, name as pattern, occurrence_policy, priority, 1 as source_rank
    from public.interactive_terms
    where is_active = true and auto_match = true
    union all
    select term.id as term_id, alias.alias as pattern, term.occurrence_policy,
           term.priority, 0 as source_rank
    from public.interactive_term_aliases as alias
    join public.interactive_terms as term on term.id = alias.term_id
    where term.is_active = true and term.auto_match = true and alias.auto_match = true
  `.execute(database);

  const byPattern = new Map<string, DictionaryEntry & { sourceRank: number }>();
  for (const row of result.rows) {
    const normalized = normalizeTermKey(row.pattern);
    if (normalized.length < 2) continue;
    const candidate = {
      normalized,
      occurrencePolicy: row.occurrence_policy,
      priority: row.priority,
      sourceRank: Number(row.source_rank),
      termId: row.term_id,
    };
    const current = byPattern.get(normalized);
    if (
      !current ||
      candidate.priority > current.priority ||
      (candidate.priority === current.priority && candidate.sourceRank > current.sourceRank)
    ) byPattern.set(normalized, candidate);
  }

  dictionaryCache = {
    automaton: buildAutomaton([...byPattern.values()].map(({ sourceRank: _sourceRank, ...entry }) => entry)),
    revision,
  };
  return dictionaryCache;
}

function normalizeWithSourceMap(value: string) {
  let normalized = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let sourceOffset = 0;
  let previousSpace = false;

  for (const character of value) {
    const sourceStart = sourceOffset;
    sourceOffset += character.length;
    const folded = character
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("es")
      .replace(/[^a-z0-9]/g, " ");
    for (const rawCharacter of folded) {
      const outputCharacter = /[a-z0-9]/.test(rawCharacter) ? rawCharacter : " ";
      if (outputCharacter === " " && previousSpace) continue;
      normalized += outputCharacter;
      starts.push(sourceStart);
      ends.push(sourceOffset);
      previousSpace = outputCharacter === " ";
    }
  }
  return { normalized, starts, ends };
}

function isWordCharacter(value: string | undefined) {
  return Boolean(value && /[a-z0-9]/.test(value));
}

function findTextMatches(value: string, automaton: AutomatonNode[]) {
  const normalizedText = normalizeWithSourceMap(value);
  const matches: Array<GuideOccurrence & { length: number; policy: OccurrencePolicy; priority: number }> = [];
  let state = 0;

  for (let index = 0; index < normalizedText.normalized.length; index += 1) {
    const character = normalizedText.normalized[index]!;
    while (state !== 0 && !automaton[state]!.next.has(character)) state = automaton[state]!.fail;
    state = automaton[state]!.next.get(character) ?? 0;

    for (const output of automaton[state]!.outputs) {
      const normalizedStart = index - output.normalized.length + 1;
      if (normalizedStart < 0) continue;
      const before = normalizedText.normalized[normalizedStart - 1];
      const after = normalizedText.normalized[index + 1];
      if (isWordCharacter(before) || isWordCharacter(after)) continue;
      const sourceStart = normalizedText.starts[normalizedStart];
      const sourceEnd = normalizedText.ends[index];
      if (sourceStart === undefined || sourceEnd === undefined || sourceEnd <= sourceStart) continue;
      matches.push({
        e: sourceEnd,
        length: sourceEnd - sourceStart,
        p: "",
        policy: output.occurrencePolicy,
        priority: output.priority,
        s: sourceStart,
        t: output.termId,
      });
    }
  }

  return matches
    .sort((left, right) => left.s - right.s || right.length - left.length || right.priority - left.priority)
    .filter((candidate, index, all) => {
      for (let previous = index - 1; previous >= 0; previous -= 1) {
        const accepted = all[previous]!;
        if (accepted.s < candidate.s && accepted.e <= candidate.s) break;
        if (accepted.s <= candidate.s && accepted.e > candidate.s) return false;
      }
      return true;
    });
}

function hasUnsafeMarks(node: JsonObject) {
  if (!Array.isArray(node.marks)) return false;
  return node.marks.some((rawMark) => {
    const mark = asObject(rawMark);
    return mark?.type === "link" || mark?.type === "code";
  });
}

function collectOccurrences(
  document: JsonObject,
  sections: GuideSection[],
  automaton: AutomatonNode[],
) {
  const sectionByPath = new Map(sections.map((section) => [section.nodePath, section]));
  const occurrences: Array<GuideOccurrence & { policy: OccurrencePolicy; section: string }> = [];
  let activeSection = "__root";

  function visit(value: unknown, path: number[], insideCodeBlock = false) {
    const node = asObject(value);
    if (!node) return;
    const nodePath = path.join(".");
    if (node.type === "heading") {
      activeSection = sectionByPath.get(nodePath)?.anchor ?? activeSection;
      return;
    }
    const nextInsideCodeBlock = insideCodeBlock || node.type === "codeBlock";
    if (node.type === "text") {
      if (nextInsideCodeBlock || hasUnsafeMarks(node)) return;
      const value = textOf(node);
      for (const match of findTextMatches(value, automaton)) {
        occurrences.push({ ...match, p: nodePath, section: activeSection });
      }
      return;
    }
    childrenOf(node).forEach((child, index) => visit(child, [...path, index], nextInsideCodeBlock));
  }

  childrenOf(document).forEach((child, index) => visit(child, [index]));

  const seenGuide = new Set<string>();
  const seenSection = new Set<string>();
  return occurrences.filter((occurrence) => {
    if (occurrence.policy === "all") return true;
    if (occurrence.policy === "first_per_guide") {
      if (seenGuide.has(occurrence.t)) return false;
      seenGuide.add(occurrence.t);
      return true;
    }
    const key = `${occurrence.section}\u0000${occurrence.t}`;
    if (seenSection.has(key)) return false;
    seenSection.add(key);
    return true;
  }).map(({ policy: _policy, section: _section, ...occurrence }) => occurrence);
}

export async function reindexPublishedGuide(database: QueryDatabase, contentId: string) {
  const guideResult = await sql<{
    content: JsonValue;
    id: string;
    kind: string;
    status: string;
    version: number;
  }>`
    select id, kind::text as kind, status::text as status, content, version
    from public.content_items
    where id = ${contentId}
    limit 1
  `.execute(database);
  const guide = guideResult.rows[0];
  if (!guide || guide.kind !== "guide" || guide.status !== "published") {
    await sql`delete from public.guide_term_reindex_queue where content_item_id = ${contentId}`.execute(database);
    return false;
  }

  const document = guideDocument(guide.content);
  if (!document) return false;
  const dictionary = await loadDictionary(database);
  const sections = await reconcileGuideSections(database, contentId, document);
  const occurrences = collectOccurrences(document, sections, dictionary.automaton);
  const counts = new Map<string, number>();
  for (const occurrence of occurrences) counts.set(occurrence.t, (counts.get(occurrence.t) ?? 0) + 1);

  await sql`delete from public.guide_term_usage where content_item_id = ${contentId}`.execute(database);
  for (const [termId, occurrenceCount] of counts) {
    await sql`
      insert into public.guide_term_usage (content_item_id, term_id, occurrence_count)
      values (${contentId}, ${termId}, ${occurrenceCount})
    `.execute(database);
  }

  await sql`
    insert into public.guide_term_manifests (
      content_item_id, content_version, dictionary_revision, occurrences, updated_at
    ) values (
      ${contentId}, ${guide.version}, ${dictionary.revision}, ${JSON.stringify(occurrences)}::jsonb, now()
    )
    on conflict (content_item_id) do update
    set content_version = excluded.content_version,
        dictionary_revision = excluded.dictionary_revision,
        occurrences = excluded.occurrences,
        updated_at = now()
  `.execute(database);
  await sql`delete from public.guide_term_reindex_queue where content_item_id = ${contentId}`.execute(database);
  return true;
}

export async function ensurePublishedGuideManifest(database: DatabaseClient, slug: string) {
  const state = await sql<{
    content_id: string;
    content_version: number;
    dictionary_revision: string | number;
    manifest_revision: string | number | null;
    manifest_version: number | null;
  }>`
    select item.id as content_id,
           item.version as content_version,
           state.revision as dictionary_revision,
           manifest.dictionary_revision as manifest_revision,
           manifest.content_version as manifest_version
    from public.content_items as item
    cross join public.interactive_term_dictionary_state as state
    left join public.guide_term_manifests as manifest on manifest.content_item_id = item.id
    where item.slug = ${slug}
      and item.kind = 'guide'
      and item.status = 'published'
      and item.catalog_visibility = 'catalog'
    limit 1
  `.execute(database);
  const row = state.rows[0];
  if (!row) return null;
  const stale = row.manifest_version !== row.content_version || Number(row.manifest_revision ?? 0) !== Number(row.dictionary_revision);
  if (stale) {
    await database.transaction().execute((transaction) => reindexPublishedGuide(transaction, row.content_id));
  }
  return row.content_id;
}

async function processOneQueuedGuide(database: DatabaseClient) {
  return database.transaction().execute(async (transaction) => {
    const claimed = await sql<{ content_item_id: string }>`
      select content_item_id
      from public.guide_term_reindex_queue
      where requested_at <= now()
      order by requested_at asc
      for update skip locked
      limit 1
    `.execute(transaction);
    const contentId = claimed.rows[0]?.content_item_id;
    if (!contentId) return false;

    try {
      await reindexPublishedGuide(transaction, contentId);
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 800) : "interactive_term_index_failed";
      await sql`
        update public.guide_term_reindex_queue
        set attempt_count = attempt_count + 1,
            last_error = ${message},
            requested_at = now() + (least(attempt_count + 1, 10) * interval '30 seconds')
        where content_item_id = ${contentId}
      `.execute(transaction);
    }
    return true;
  });
}

export function startInteractiveTermIndexer(database: DatabaseClient) {
  let running = false;
  let stopped = false;

  const run = async () => {
    if (running || stopped) return;
    running = true;
    try {
      for (let index = 0; index < 8; index += 1) {
        if (!(await processOneQueuedGuide(database))) break;
      }
    } finally {
      running = false;
    }
  };

  void run();
  const timer = setInterval(() => void run(), 2_000);
  timer.unref?.();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

export const interactiveTermTesting = {
  buildAutomaton,
  findTextMatches,
  normalizeTermKey,
};
